package com.esukan.servlet;

import com.esukan.model.EquipmentRental;
import com.esukan.model.Payment;
import com.esukan.security.JwtHelper;
import com.esukan.security.UserPrincipal;
import com.esukan.util.DBConnection;
import com.google.gson.reflect.TypeToken;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.lang.reflect.Type;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
                Optional<EquipmentRental> rental = RentalQueries.findById(conn, p.get().getRentalId());
                if (rental.isEmpty() || !RentalQueries.canAccess(rental.get(), full)) {
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
        Type mapType = new TypeToken<Map<String, Object>>() {}.getType();
        Map<String, Object> body = com.esukan.util.Jsons.gson().fromJson(ServletUtil.readBody(req), mapType);
        try (Connection conn = DBConnection.getConnection()) {
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            long rentalId = Long.parseLong(body.get("rentalId").toString());
            Payment.PaymentMethod method = Payment.PaymentMethod.valueOf(String.valueOf(body.get("method")).trim());
            Optional<EquipmentRental> rental = RentalQueries.findById(conn, rentalId);
            if (rental.isEmpty() || !RentalQueries.canAccess(rental.get(), full)) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
                return;
            }
            String sql = "INSERT INTO payments (rental_id, method, amount, status) VALUES (?,?,?, 'PENDING')";
            try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, rentalId);
                ps.setString(2, method.name());
                ps.setBigDecimal(3, rental.get().getDepositAmount());
                ps.executeUpdate();
                ResultSet k = ps.getGeneratedKeys();
                k.next();
                long newId = k.getLong(1);
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, newId).orElseThrow());
            }
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
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
            Optional<EquipmentRental> rental = RentalQueries.findById(conn, pay.get().getRentalId());
            if (rental.isEmpty() || !RentalQueries.canAccess(rental.get(), full)) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE payments SET status='PAID', paid_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'")) {
                ps.setLong(1, paymentId);
                if (ps.executeUpdate() == 0) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Payment not pending"));
                    return;
                }
            }
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, paymentId).orElseThrow());
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    private static Optional<Payment> findById(Connection conn, long id) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT id, rental_id, method, amount, status, paid_at, created_at FROM payments WHERE id = ?")) {
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
                "SELECT id, rental_id, method, amount, status, paid_at, created_at FROM payments WHERE rental_id = ? ORDER BY id")) {
            ps.setLong(1, rentalId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(JdbcSupport.mapPayment(rs));
                }
            }
        }
        return list;
    }
}
