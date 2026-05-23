package com.esukan.servlet;

import com.esukan.model.Equipment;
import com.esukan.model.EquipmentRental;
import com.esukan.model.User;
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
import java.math.RoundingMode;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class RentalServlet extends BaseHttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null) {
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        try (Connection conn = DBConnection.getConnection()) {
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            if (segs.length == 0) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listVisible(conn, full));
                return;
            }
            if (segs.length == 1 && "active".equals(segs[0])) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listActive(conn, full));
                return;
            }
            if (segs.length == 2 && "student".equals(segs[0])) {
                if (full.getRole() != UserRole.ADMIN) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of());
                    return;
                }
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listByStudent(conn, segs[1]));
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
        Map<String, Object> payload = com.esukan.util.Jsons.gson().fromJson(ServletUtil.readBody(req), mapType);
        try (Connection conn = DBConnection.getConnection()) {
            User u = UserQueries.loadUser(conn, auth.getId());
            int qty = ServletUtil.parseIntValue(payload.get("quantity"));
            LocalDate rentalDate = LocalDate.parse(String.valueOf(payload.get("rentalDate")));
            long equipmentId = ServletUtil.parseLongValue(payload.get("equipmentId"));
            Equipment equipment = loadEquipment(conn, equipmentId)
                    .orElseThrow(() -> new RuntimeException("Equipment not found"));

            BigDecimal deposit;
            if (payload.get("depositAmount") != null) {
                deposit = new BigDecimal(payload.get("depositAmount").toString()).setScale(2, RoundingMode.HALF_UP);
            } else {
                deposit = new BigDecimal(qty).multiply(new BigDecimal("10")).setScale(2, RoundingMode.HALF_UP);
                if (deposit.compareTo(new BigDecimal("20")) < 0) {
                    deposit = new BigDecimal("20.00");
                }
            }

            String sql = """
                    INSERT INTO equipment_rentals (student_name, student_id, equipment_id, user_id, quantity,
                    rental_date, status, deposit_amount)
                    VALUES (?,?,?,?,?,?,'ACTIVE',?)
                    """;
            try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, u.getFullName());
                ps.setString(2, u.getStudentIdNumber() != null && !u.getStudentIdNumber().isBlank()
                        ? u.getStudentIdNumber()
                        : "U" + u.getId());
                ps.setLong(3, equipmentId);
                ps.setLong(4, u.getId());
                ps.setInt(5, qty);
                ps.setObject(6, rentalDate);
                ps.setBigDecimal(7, deposit);
                ps.executeUpdate();
                ResultSet k = ps.getGeneratedKeys();
                k.next();
                long newId = k.getLong(1);
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, newId).orElseThrow());
            }
        } catch (RuntimeException e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
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
        if (segs.length != 2 || !"return".equals(segs[1])) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
            return;
        }
        long id = Long.parseLong(segs[0]);
        try (Connection conn = DBConnection.getConnection()) {
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            Optional<EquipmentRental> r = RentalQueries.findById(conn, id);
            if (r.isEmpty()) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                return;
            }
            if (full.getRole() != UserRole.ADMIN && !RentalQueries.canAccess(r.get(), full)) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of());
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE equipment_rentals SET status='RETURNED', return_date=CURRENT_DATE WHERE id=?")) {
                ps.setLong(1, id);
                ps.executeUpdate();
            }
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, id).orElseThrow());
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null) {
            return;
        }
        if (auth.getRole() != UserRole.ADMIN) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of());
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length != 1) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
            return;
        }
        long id = Long.parseLong(segs[0]);
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("DELETE FROM equipment_rentals WHERE id = ?")) {
            ps.setLong(1, id);
            ps.executeUpdate();
            resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    private static List<EquipmentRental> listVisible(Connection conn, UserPrincipal p) throws java.sql.SQLException {
        if (p.getRole() == UserRole.ADMIN) {
            return listAll(conn);
        }
        return listForUser(conn, p);
    }

    private static List<EquipmentRental> listAll(Connection conn) throws java.sql.SQLException {
        String sql = RentalQueries.RENTAL_JOIN + " ORDER BY r.id DESC";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return read(rs);
        }
    }

    private static List<EquipmentRental> listForUser(Connection conn, UserPrincipal p) throws java.sql.SQLException {
        String sid = p.getStudentIdNumber();
        if (sid != null && !sid.isBlank()) {
            String sql = RentalQueries.RENTAL_JOIN + " WHERE r.user_id = ? OR r.student_id = ? ORDER BY r.id DESC";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setLong(1, p.getId());
                ps.setString(2, sid);
                try (ResultSet rs = ps.executeQuery()) {
                    return read(rs);
                }
            }
        }
        String sql = RentalQueries.RENTAL_JOIN + " WHERE r.user_id = ? ORDER BY r.id DESC";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, p.getId());
            try (ResultSet rs = ps.executeQuery()) {
                return read(rs);
            }
        }
    }

    private static List<EquipmentRental> listActive(Connection conn, UserPrincipal p) throws java.sql.SQLException {
        List<EquipmentRental> base = p.getRole() == UserRole.ADMIN
                ? queryActiveAll(conn)
                : listForUser(conn, p).stream().filter(r -> r.getStatus() == EquipmentRental.RentalStatus.ACTIVE).toList();
        return base;
    }

    private static List<EquipmentRental> queryActiveAll(Connection conn) throws java.sql.SQLException {
        String sql = RentalQueries.RENTAL_JOIN + " WHERE r.status = 'ACTIVE' ORDER BY r.id DESC";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return read(rs);
        }
    }

    private static List<EquipmentRental> listByStudent(Connection conn, String studentId) throws java.sql.SQLException {
        String sql = RentalQueries.RENTAL_JOIN + " WHERE r.student_id = ? ORDER BY r.id DESC";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                return read(rs);
            }
        }
    }

    private static List<EquipmentRental> read(ResultSet rs) throws java.sql.SQLException {
        List<EquipmentRental> list = new ArrayList<>();
        while (rs.next()) {
            list.add(JdbcSupport.mapRentalJoined(rs));
        }
        return list;
    }

    private static Optional<EquipmentRental> findById(Connection conn, long id) throws java.sql.SQLException {
        return RentalQueries.findById(conn, id);
    }

    private static Optional<Equipment> loadEquipment(Connection conn, long id) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT id, name, category, status, quantity, description, last_updated FROM equipment WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(JdbcSupport.mapEquipment(rs, ""));
            }
        }
    }

}
