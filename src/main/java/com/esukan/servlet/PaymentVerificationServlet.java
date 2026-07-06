package com.esukan.servlet;

import com.esukan.model.Booking;
import com.esukan.model.EquipmentRental;
import com.esukan.model.Payment;
import com.esukan.util.DBConnection;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class PaymentVerificationServlet extends BaseHttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length == 1) {
            String referenceId = segs[0];
            try (Connection conn = DBConnection.getConnection()) {
                Optional<Payment> p = findByReferenceId(conn, referenceId);
                if (p.isEmpty()) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Payment not found"));
                    return;
                }
                
                Payment payment = p.get();
                Map<String, Object> result = new HashMap<>();
                result.put("status", payment.getStatus().name());
                result.put("amount", payment.getAmount());
                result.put("method", payment.getMethod() != null ? payment.getMethod().name() : null);
                result.put("paidAt", payment.getPaidAt() != null ? payment.getPaidAt().toString() : null);
                result.put("referenceId", payment.getReferenceId());
                
                if (payment.getBookingId() != null) {
                    result.put("type", "BOOKING");
                    Optional<Booking> booking = BookingServlet.findById(conn, payment.getBookingId());
                    booking.ifPresent(b -> {
                        result.put("studentName", b.getStudentName());
                        result.put("bookingDate", b.getBookingDate().toString());
                        result.put("facilityName", b.getFacility() != null ? b.getFacility().getName() : null);
                    });
                } else if (payment.getRentalId() != null) {
                    result.put("type", "RENTAL");
                    Optional<EquipmentRental> rental = RentalQueries.findById(conn, payment.getRentalId());
                    rental.ifPresent(r -> {
                        result.put("studentName", r.getStudentName());
                        result.put("rentalDate", r.getRentalDate().toString());
                        result.put("equipmentName", r.getEquipment() != null ? r.getEquipment().getName() : null);
                    });
                }
                
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, result);
                return;
            } catch (Exception e) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
                return;
            }
        }
        ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Not found"));
    }

    private Optional<Payment> findByReferenceId(Connection conn, String referenceId) throws java.sql.SQLException {
        if (referenceId != null && referenceId.startsWith("ESP-")) {
            String[] parts = referenceId.split("-");
            if (parts.length == 3) {
                try {
                    long id = Long.parseLong(parts[2]);
                    Optional<Payment> p = findById(conn, id);
                    if (p.isPresent()) {
                        Payment pay = p.get();
                        if (pay.getCreatedAt() != null) {
                            String computed = "ESP-" + pay.getCreatedAt().toLocalDate().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE) + "-"
                                    + String.format("%05d", pay.getId());
                            if (computed.equals(referenceId)) {
                                return p;
                            }
                        }
                    }
                } catch (NumberFormatException ignored) {
                }
            }
        }

        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT id, rental_id, booking_id, method, amount, status, reference_id, paid_at, created_at FROM payments WHERE reference_id = ?")) {
            ps.setString(1, referenceId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(JdbcSupport.mapPayment(rs));
            }
        }
    }

    private Optional<Payment> findById(Connection conn, long id) throws java.sql.SQLException {
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
}
