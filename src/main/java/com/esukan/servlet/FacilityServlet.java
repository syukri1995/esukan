package com.esukan.servlet;

import com.esukan.model.Facility;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class FacilityServlet extends BaseHttpServlet {

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
            if (segs.length == 1 && "active".equals(segs[0])) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listActive(conn));
                return;
            }
            if (segs.length == 2 && "type".equals(segs[0])) {
                Facility.FacilityType t = Facility.FacilityType.valueOf(segs[1]);
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listByType(conn, t));
                return;
            }
            if (segs.length == 1) {
                long id = Long.parseLong(segs[0]);
                Optional<Facility> f = findById(conn, id);
                if (f.isEmpty()) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                    return;
                }
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, f.get());
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
        if (auth == null || !requireAdmin(resp, auth)) {
            return;
        }
        Facility f = Jsons.gson().fromJson(ServletUtil.readBody(req), Facility.class);
        try (Connection conn = DBConnection.getConnection()) {
            String sql = "INSERT INTO facilities (name, type, description, is_active) VALUES (?,?,?,?)";
            try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, f.getName());
                ps.setString(2, f.getType().name());
                ps.setString(3, f.getDescription());
                ps.setBoolean(4, f.getIsActive() != null && f.getIsActive());
                ps.executeUpdate();
                ResultSet k = ps.getGeneratedKeys();
                k.next();
                f.setId(k.getLong(1));
            }
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, f);
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null || !requireAdmin(resp, auth)) {
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length != 1) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
            return;
        }
        long id = Long.parseLong(segs[0]);
        Facility f = Jsons.gson().fromJson(ServletUtil.readBody(req), Facility.class);
        try (Connection conn = DBConnection.getConnection()) {
            String sql = "UPDATE facilities SET name=?, type=?, description=?, is_active=? WHERE id=?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, f.getName());
                ps.setString(2, f.getType().name());
                ps.setString(3, f.getDescription());
                ps.setBoolean(4, f.getIsActive() != null && f.getIsActive());
                ps.setLong(5, id);
                if (ps.executeUpdate() == 0) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                    return;
                }
            }
            Optional<Facility> out = findById(conn, id);
            if (out.isPresent()) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, out.get());
            }
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null || !requireAdmin(resp, auth)) {
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length != 1) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
            return;
        }
        long id = Long.parseLong(segs[0]);
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("DELETE FROM facilities WHERE id = ?")) {
            ps.setLong(1, id);
            ps.executeUpdate();
            resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    private static boolean requireAdmin(HttpServletResponse resp, UserPrincipal auth) throws IOException {
        if (auth.getRole() != UserRole.ADMIN) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
            return false;
        }
        return true;
    }

    private static List<Facility> listAll(Connection conn) throws java.sql.SQLException {
        return queryFacilities(conn, "SELECT id, name, type, description, is_active, created_at FROM facilities ORDER BY id");
    }

    private static List<Facility> listActive(Connection conn) throws java.sql.SQLException {
        return queryFacilities(conn, "SELECT id, name, type, description, is_active, created_at FROM facilities WHERE is_active = TRUE ORDER BY id");
    }

    private static List<Facility> listByType(Connection conn, Facility.FacilityType t) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT id, name, type, description, is_active, created_at FROM facilities WHERE type = ? AND is_active = TRUE ORDER BY id")) {
            ps.setString(1, t.name());
            try (ResultSet rs = ps.executeQuery()) {
                return readList(rs);
            }
        }
    }

    private static List<Facility> queryFacilities(Connection conn, String sql) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return readList(rs);
        }
    }

    private static List<Facility> readList(ResultSet rs) throws java.sql.SQLException {
        List<Facility> list = new ArrayList<>();
        while (rs.next()) {
            list.add(JdbcSupport.mapFacility(rs, ""));
        }
        return list;
    }

    private static Optional<Facility> findById(Connection conn, long id) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT id, name, type, description, is_active, created_at FROM facilities WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(JdbcSupport.mapFacility(rs, ""));
            }
        }
    }
}
