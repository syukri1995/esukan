package com.esukan.servlet;

import com.esukan.model.Booking;
import com.esukan.model.EquipmentRental;
import com.esukan.model.Payment;
import com.esukan.model.UserRole;
import com.esukan.security.JwtHelper;
import com.esukan.security.UserPrincipal;
import com.esukan.util.DBConnection;
import com.google.gson.reflect.TypeToken;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.lang.reflect.Type;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public class PaymentServlet extends BaseHttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null) {
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        try (Connection conn = DBConnection.getConnection()) {
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            if (segs.length == 2 && "rental".equals(segs[0])) {
                long rentalId = Long.parseLong(segs[1]);
                Optional<EquipmentRental> rental = RentalQueries.findById(conn, rentalId);
                if (rental.isEmpty() || !RentalQueries.canAccess(rental.get(), full)) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
                    return;
                }
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listByRental(conn, rentalId));
                return;
            }
            if (segs.length == 1) {
                long id = Long.parseLong(segs[0]);
                Optional<Payment> p = findById(conn, id);
                if (p.isEmpty()) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                    return;
                }
                if (!canAccessPayment(conn, p.get(), full)) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
                    return;
                }
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, p.get());
                return;
            }
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Not found"));
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null) {
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        Type mapType = new TypeToken<Map<String, Object>>() {}.getType();
        String rawBody = ServletUtil.readBody(req);
        Map<String, Object> body = rawBody != null && !rawBody.isBlank()
                ? com.esukan.util.Jsons.gson().fromJson(rawBody, mapType)
                : Map.of();
        try (Connection conn = DBConnection.getConnection()) {
            SchemaMigration.ensureBookingPaymentSchema(conn);
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            if (segs.length == 2 && "process".equals(segs[1])) {
                long paymentId = Long.parseLong(segs[0]);
                processPayment(conn, resp, full, paymentId, body);
                return;
            }
            if (segs.length != 0) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Not found"));
                return;
            }
            Payment.PaymentMethod method = Payment.PaymentMethod.valueOf(String.valueOf(body.get("method")).trim());
            boolean hasRental = body.get("rentalId") != null && !String.valueOf(body.get("rentalId")).isBlank();
            boolean hasBooking = body.get("bookingId") != null && !String.valueOf(body.get("bookingId")).isBlank();
            if (hasRental == hasBooking) {
                throw new RuntimeException("Provide exactly one of rentalId or bookingId");
            }
            BigDecimal amount;
            String sql;
            if (hasBooking) {
                long bookingId = ServletUtil.parseLongValue(body.get("bookingId"));
                Optional<Booking> booking = BookingServlet.findById(conn, bookingId);
                if (booking.isEmpty() || !canAccessBooking(booking.get(), full)) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
                    return;
                }
                Booking b = booking.get();
                if (b.getStatus() != Booking.BookingStatus.PENDING) {
                    throw new RuntimeException("Booking is not awaiting payment");
                }
                amount = b.getEstimatedCost() != null ? b.getEstimatedCost() : BigDecimal.ZERO;
                if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new RuntimeException("This booking has no fee to pay");
                }
                if ("PAID".equalsIgnoreCase(b.getPaymentStatus())) {
                    throw new RuntimeException("Booking is already paid");
                }
                String refId = UUID.randomUUID().toString();
                sql = "INSERT INTO payments (rental_id, booking_id, method, amount, status, reference_id) VALUES (NULL, ?, ?, ?, 'PENDING', ?)";
                try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
                    ps.setLong(1, bookingId);
                    ps.setString(2, method.name());
                    ps.setBigDecimal(3, amount);
                    ps.setString(4, refId);
                    ps.executeUpdate();
                    long newId = readGeneratedId(ps);
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, newId).orElseThrow());
                }
                return;
            }
            long rentalId = ServletUtil.parseLongValue(body.get("rentalId"));
            Optional<EquipmentRental> rental = RentalQueries.findById(conn, rentalId);
            if (rental.isEmpty() || !RentalQueries.canAccess(rental.get(), full)) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
                return;
            }
            amount = rental.get().getDepositAmount();
            String refId = UUID.randomUUID().toString();
            sql = "INSERT INTO payments (rental_id, booking_id, method, amount, status, reference_id) VALUES (?, NULL, ?, ?, 'PENDING', ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, rentalId);
                ps.setString(2, method.name());
                ps.setBigDecimal(3, amount);
                ps.setString(4, refId);
                ps.executeUpdate();
                long newId = readGeneratedId(ps);
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, newId).orElseThrow());
            }
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    private static void processPayment(Connection conn, HttpServletResponse resp, UserPrincipal full,
            long paymentId, Map<String, Object> body) throws Exception {
        Optional<Payment> payOpt = findById(conn, paymentId);
        if (payOpt.isEmpty()) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Payment not found"));
            return;
        }
        Payment pay = payOpt.get();
        if (!canAccessPayment(conn, pay, full)) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
            return;
        }
        if (pay.getStatus() != Payment.PaymentStatus.PENDING) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Payment not pending"));
            return;
        }

        boolean fail = shouldMockFail(pay.getMethod(), body);
        if (fail) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE payments SET status='FAILED' WHERE id=? AND status='PENDING'")) {
                ps.setLong(1, paymentId);
                if (ps.executeUpdate() == 0) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Payment not pending"));
                    return;
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("status", "FAILED");
            result.put("message", "Payment declined by mock gateway. Please try another method or card.");
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, result);
            return;
        }

        markPaymentPaid(conn, paymentId);
        if (pay.getBookingId() != null) {
            confirmBookingAfterPayment(conn, pay.getBookingId());
        }
        if (pay.getRentalId() != null) {
            returnRentalAfterPayment(conn, pay.getRentalId());
        }
        
        String txnRef = pay.getReferenceId() != null ? pay.getReferenceId() : "ESP-" + pay.getCreatedAt().toLocalDate().format(DateTimeFormatter.BASIC_ISO_DATE) + "-"
                + String.format("%05d", paymentId);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "PAID");
        result.put("transactionRef", txnRef);
        result.put("message", "Payment successful");
        ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, result);
    }

    private static boolean shouldMockFail(Payment.PaymentMethod method, Map<String, Object> body) {
        if (method == Payment.PaymentMethod.CASH) {
            return false;
        }
        if (body.get("cardNumber") != null) {
            String digits = String.valueOf(body.get("cardNumber")).replaceAll("\\D", "");
            return digits.endsWith("0002");
        }
        if (body.get("bankCode") != null && "demo-fail".equals(String.valueOf(body.get("bankCode")).trim())) {
            return true;
        }
        if (body.get("walletProvider") != null && "demo-fail".equals(String.valueOf(body.get("walletProvider")).trim())) {
            return true;
        }
        return false;
    }

    @Override
    protected void doPatch(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null) {
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length != 2 || !"pay".equals(segs[1])) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
            return;
        }
        long paymentId = Long.parseLong(segs[0]);
        try (Connection conn = DBConnection.getConnection()) {
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            Optional<Payment> pay = findById(conn, paymentId);
            if (pay.isEmpty()) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                return;
            }
            if (!canAccessPayment(conn, pay.get(), full)) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
                return;
            }
            markPaymentPaid(conn, paymentId);
            if (pay.get().getBookingId() != null) {
                confirmBookingAfterPayment(conn, pay.get().getBookingId());
            }
            if (pay.get().getRentalId() != null) {
                returnRentalAfterPayment(conn, pay.get().getRentalId());
            }
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, paymentId).orElseThrow());
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    private static long readGeneratedId(PreparedStatement ps) throws java.sql.SQLException {
        ResultSet k = ps.getGeneratedKeys();
        k.next();
        return k.getLong(1);
    }

    private static void markPaymentPaid(Connection conn, long paymentId) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE payments SET status='PAID', paid_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'")) {
            ps.setLong(1, paymentId);
            if (ps.executeUpdate() == 0) {
                throw new RuntimeException("Payment not pending");
            }
        }
    }

    private static void confirmBookingAfterPayment(Connection conn, long bookingId) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE bookings SET status='CONFIRMED' WHERE id=? AND status='PENDING'")) {
            ps.setLong(1, bookingId);
            ps.executeUpdate();
        }
    }

    private static boolean canAccessBooking(Booking b, UserPrincipal p) {
        if (p.getRole() == UserRole.ADMIN) {
            return true;
        }
        if (b.getUser() != null && b.getUser().getId().equals(p.getId())) {
            return true;
        }
        return p.getStudentIdNumber() != null && p.getStudentIdNumber().equals(b.getStudentId());
    }

    private static boolean canAccessPayment(Connection conn, Payment pay, UserPrincipal full) throws java.sql.SQLException {
        if (pay.getBookingId() != null) {
            Optional<Booking> booking = BookingServlet.findById(conn, pay.getBookingId());
            return booking.isPresent() && canAccessBooking(booking.get(), full);
        }
        if (pay.getRentalId() != null) {
            Optional<EquipmentRental> rental = RentalQueries.findById(conn, pay.getRentalId());
            return rental.isPresent() && RentalQueries.canAccess(rental.get(), full);
        }
        return false;
    }

    private static Optional<Payment> findById(Connection conn, long id) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT id, rental_id, booking_id, method, amount, status, reference_id, paid_at, created_at FROM payments WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(JdbcSupport.mapPayment(rs));
            }
        }
    }

    private static List<Payment> listByRental(Connection conn, long rentalId) throws java.sql.SQLException {
        List<Payment> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT id, rental_id, booking_id, method, amount, status, reference_id, paid_at, created_at FROM payments WHERE rental_id = ? ORDER BY id")) {
            ps.setLong(1, rentalId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(JdbcSupport.mapPayment(rs));
                }
            }
        }
        return list;
    }

    private static void returnRentalAfterPayment(Connection conn, long rentalId) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE equipment_rentals SET status='RETURNED', return_date=CURRENT_DATE WHERE id=?")) {
            ps.setLong(1, rentalId);
            ps.executeUpdate();
        }
    }
}
