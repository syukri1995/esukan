package com.esukan.servlet;

import com.esukan.model.Equipment;
import com.esukan.model.UserRole;
import com.esukan.security.UserPrincipal;
import com.esukan.util.DBConnection;
import com.esukan.util.Jsons;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class EquipmentServlet extends BaseHttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null) {
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        try (Connection conn = DBConnection.getConnection()) {
            if (segs.length == 0) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listAll(conn));
                return;
            }
            if (segs.length == 1 && "categories".equals(segs[0])) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, categories(conn));
                return;
            }
            if (segs.length == 1 && "health-report".equals(segs[0])) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, healthReport(conn));
                return;
            }
            if (segs.length == 2 && "status".equals(segs[0])) {
                Equipment.EquipmentStatus st = Equipment.EquipmentStatus.valueOf(segs[1]);
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, byStatus(conn, st));
                return;
            }
            if (segs.length == 1) {
                long id = Long.parseLong(segs[0]);
                Optional<Equipment> e = findById(conn, id);
                if (e.isEmpty()) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                    return;
                }
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, e.get());
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
        if (auth == null || auth.getRole() != UserRole.ADMIN) {
            if (auth != null) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
            }
            return;
        }
        Equipment e = Jsons.gson().fromJson(ServletUtil.readBody(req), Equipment.class);
        try (Connection conn = DBConnection.getConnection()) {
            String sql = "INSERT INTO equipment (name, category, status, quantity, description) VALUES (?,?,?,?,?)";
            try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, e.getName());
                ps.setString(2, e.getCategory());
                ps.setString(3, e.getStatus() != null ? e.getStatus().name() : Equipment.EquipmentStatus.AVAILABLE.name());
                ps.setInt(4, e.getQuantity() != null ? e.getQuantity() : 1);
                ps.setString(5, e.getDescription());
                ps.executeUpdate();
                ResultSet k = ps.getGeneratedKeys();
                k.next();
                e.setId(k.getLong(1));
            }
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, e.getId()).orElse(e));
        } catch (Exception ex) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", ex.getMessage()));
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null || auth.getRole() != UserRole.ADMIN) {
            if (auth != null) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
            }
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length != 1) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
            return;
        }
        long id = Long.parseLong(segs[0]);
        Equipment e = Jsons.gson().fromJson(ServletUtil.readBody(req), Equipment.class);
        try (Connection conn = DBConnection.getConnection()) {
            String sql = "UPDATE equipment SET name=?, category=?, status=?, quantity=?, description=?, last_updated=CURRENT_TIMESTAMP WHERE id=?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, e.getName());
                ps.setString(2, e.getCategory());
                ps.setString(3, e.getStatus().name());
                ps.setInt(4, e.getQuantity());
                ps.setString(5, e.getDescription());
                ps.setLong(6, id);
                if (ps.executeUpdate() == 0) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                    return;
                }
            }
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, id).orElseThrow());
        } catch (Exception ex) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
        }
    }

    @Override
    protected void doPatch(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null || auth.getRole() != UserRole.ADMIN) {
            if (auth != null) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
            }
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length != 2 || !"status".equals(segs[1])) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
            return;
        }
        long id = Long.parseLong(segs[0]);
        String st = req.getParameter("status");
        if (st == null) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "status required"));
            return;
        }
        Equipment.EquipmentStatus status = Equipment.EquipmentStatus.valueOf(st);
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "UPDATE equipment SET status=?, last_updated=CURRENT_TIMESTAMP WHERE id=?")) {
            ps.setString(1, status.name());
            ps.setLong(2, id);
            if (ps.executeUpdate() == 0) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                return;
            }
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, id).orElseThrow());
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null || auth.getRole() != UserRole.ADMIN) {
            if (auth != null) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
            }
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length != 1) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
            return;
        }
        long id = Long.parseLong(segs[0]);
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("DELETE FROM equipment WHERE id = ?")) {
            ps.setLong(1, id);
            ps.executeUpdate();
            resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    private static List<Equipment> listAll(Connection conn) throws java.sql.SQLException {
        return query(conn, "SELECT id, name, category, status, quantity, description, last_updated FROM equipment ORDER BY id");
    }

    private static List<Equipment> byStatus(Connection conn, Equipment.EquipmentStatus st) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT id, name, category, status, quantity, description, last_updated FROM equipment WHERE status = ? ORDER BY id")) {
            ps.setString(1, st.name());
            try (ResultSet rs = ps.executeQuery()) {
                return read(rs);
            }
        }
    }

    private static List<Equipment> query(Connection conn, String sql) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return read(rs);
        }
    }

    private static List<Equipment> read(ResultSet rs) throws java.sql.SQLException {
        List<Equipment> list = new ArrayList<>();
        while (rs.next()) {
            list.add(JdbcSupport.mapEquipment(rs, ""));
        }
        return list;
    }

    private static Optional<Equipment> findById(Connection conn, long id) throws java.sql.SQLException {
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

    private static List<String> categories(Connection conn) throws java.sql.SQLException {
        List<String> list = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement("SELECT DISTINCT category FROM equipment ORDER BY category");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(rs.getString(1));
            }
        }
        return list;
    }

    private static Map<String, Long> healthReport(Connection conn) throws java.sql.SQLException {
        Map<String, Long> m = new HashMap<>();
        m.put("available", countStatus(conn, Equipment.EquipmentStatus.AVAILABLE));
        m.put("damaged", countStatus(conn, Equipment.EquipmentStatus.DAMAGED));
        m.put("inMaintenance", countStatus(conn, Equipment.EquipmentStatus.IN_MAINTENANCE));
        m.put("totalUnhealthy", m.get("damaged") + m.get("inMaintenance"));
        return m;
    }

    private static long countStatus(Connection conn, Equipment.EquipmentStatus st) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT COUNT(*) FROM equipment WHERE status = ?")) {
            ps.setString(1, st.name());
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getLong(1);
            }
        }
    }
}
