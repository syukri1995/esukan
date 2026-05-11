package com.esukan.servlet;

import com.esukan.dto.AdminCreateUserRequest;
import com.esukan.dto.AdminUserUpdateRequest;
import com.esukan.dto.UserResponse;
import com.esukan.model.User;
import com.esukan.model.UserRole;
import com.esukan.security.JwtHelper;
import com.esukan.security.UserPrincipal;
import com.esukan.util.DBConnection;
import com.esukan.util.Jsons;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import at.favre.lib.crypto.bcrypt.BCrypt;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class AdminUserServlet extends BaseHttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null) {
            return;
        }
        UserPrincipal full = auth;
        try (Connection c = DBConnection.getConnection()) {
            full = JwtHelper.enrich(auth, UserQueries.loadUser(c, auth.getId()));
        } catch (Exception ignored) {
        }
        if (full.getRole() != UserRole.ADMIN) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of());
            return;
        }
        String q = req.getParameter("q");
        try (Connection conn = DBConnection.getConnection()) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, searchUsers(conn, q));
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
        if (auth.getRole() != UserRole.ADMIN) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of());
            return;
        }
        AdminCreateUserRequest cr = Jsons.gson().fromJson(ServletUtil.readBody(req), AdminCreateUserRequest.class);
        try (Connection conn = DBConnection.getConnection()) {
            if (existsUsername(conn, cr.username())) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Username already taken"));
                return;
            }
            if (existsEmail(conn, cr.email())) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Email already registered"));
                return;
            }
            if (cr.role() == UserRole.ADMIN) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Cannot create another admin via this endpoint"));
                return;
            }
            User u = new User();
            u.setUsername(cr.username().trim());
            u.setEmail(cr.email().trim().toLowerCase());
            u.setPasswordHash(BCrypt.withDefaults().hashToString(10, cr.password().toCharArray()));
            u.setFullName(cr.fullName().trim());
            u.setStudentIdNumber(cr.studentIdNumber() != null && !cr.studentIdNumber().isBlank()
                    ? cr.studentIdNumber().trim() : null);
            u.setRole(cr.role());
            u.setEnabled(true);
            insertUser(conn, u);
            User loaded = UserQueries.loadUserByUsername(conn, u.getUsername());
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, toResponse(loaded));
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
        AdminUserUpdateRequest ur = Jsons.gson().fromJson(ServletUtil.readBody(req), AdminUserUpdateRequest.class);
        try (Connection conn = DBConnection.getConnection()) {
            User u = loadUserById(conn, id);
            if (u == null) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Not found"));
                return;
            }
            if (ur.role() != null) {
                u.setRole(ur.role());
            }
            if (ur.enabled() != null) {
                u.setEnabled(ur.enabled());
            }
            try (PreparedStatement ps = conn.prepareStatement("UPDATE users SET role = ?, enabled = ? WHERE id = ?")) {
                ps.setString(1, u.getRole().name());
                ps.setBoolean(2, u.isEnabled());
                ps.setLong(3, id);
                ps.executeUpdate();
            }
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, toResponse(loadUserById(conn, id)));
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    private static List<UserResponse> searchUsers(Connection conn, String q) throws java.sql.SQLException {
        String sql = """
                SELECT id, username, email, password_hash, role, full_name, student_id_number, enabled, created_at
                FROM users
                """;
        String suffix = (q == null || q.isBlank()) ? " ORDER BY id" : " WHERE LOWER(username) LIKE ? OR LOWER(email) LIKE ? OR LOWER(full_name) LIKE ? ORDER BY id";
        try (PreparedStatement ps = conn.prepareStatement(sql + suffix)) {
            if (q != null && !q.isBlank()) {
                String term = "%" + q.trim().toLowerCase() + "%";
                ps.setString(1, term);
                ps.setString(2, term);
                ps.setString(3, term);
            }
            try (ResultSet rs = ps.executeQuery()) {
                List<UserResponse> list = new ArrayList<>();
                while (rs.next()) {
                    list.add(toResponse(JdbcSupport.mapUserShallow(rs, "")));
                }
                return list;
            }
        }
    }

    private static User loadUserById(Connection conn, long id) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT id, username, email, password_hash, role, full_name, student_id_number, enabled, created_at FROM users WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return JdbcSupport.mapUserShallow(rs, "");
            }
        }
    }

    private static boolean existsUsername(Connection conn, String username) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM users WHERE username = ?")) {
            ps.setString(1, username.trim());
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static boolean existsEmail(Connection conn, String email) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM users WHERE LOWER(email) = LOWER(?)")) {
            ps.setString(1, email.trim());
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static void insertUser(Connection conn, User u) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO users (username, email, password_hash, role, full_name, student_id_number, enabled) VALUES (?,?,?,?,?,?,?)")) {
            ps.setString(1, u.getUsername());
            ps.setString(2, u.getEmail());
            ps.setString(3, u.getPasswordHash());
            ps.setString(4, u.getRole().name());
            ps.setString(5, u.getFullName());
            ps.setString(6, u.getStudentIdNumber());
            ps.setBoolean(7, u.isEnabled());
            ps.executeUpdate();
        }
    }

    private static UserResponse toResponse(User u) {
        return new UserResponse(u.getId(), u.getUsername(), u.getEmail(), u.getFullName(), u.getStudentIdNumber(), u.getRole());
    }
}
