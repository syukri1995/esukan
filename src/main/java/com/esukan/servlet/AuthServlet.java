package com.esukan.servlet;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.esukan.dto.AuthResponse;
import com.esukan.dto.ForgotPasswordRequest;
import com.esukan.dto.LoginRequest;
import com.esukan.dto.RegisterRequest;
import com.esukan.dto.ResetPasswordRequest;
import com.esukan.dto.UserResponse;
import com.esukan.model.User;
import com.esukan.model.UserRole;
import com.esukan.security.JwtHelper;
import com.esukan.security.UserPrincipal;
import com.esukan.util.DBConnection;
import com.esukan.util.Jsons;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;

public class AuthServlet extends BaseHttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length == 1 && "me".equals(segs[0])) {
            UserPrincipal partial = ServletUtil.optionalAuth(req);
            if (partial == null) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_UNAUTHORIZED, Map.of());
                return;
            }
            try (Connection conn = DBConnection.getConnection()) {
                User u = UserQueries.loadUser(conn, partial.getId());
                UserResponse ur = toUserResponse(u);
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, ur);
            } catch (Exception e) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_UNAUTHORIZED, Map.of());
            }
            return;
        }
        ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Not found"));
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String[] segs = ServletUtil.pathSegments(req);
        String body = ServletUtil.readBody(req);
        try {
            if (segs.length == 1 && "login".equals(segs[0])) {
                LoginRequest lr = Jsons.gson().fromJson(body, LoginRequest.class);
                if (lr.username() == null || lr.username().isBlank() || lr.password() == null) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_UNAUTHORIZED, Map.of("error", "Invalid credentials"));
                    return;
                }
                try (Connection conn = DBConnection.getConnection()) {
                    User u = UserQueries.loadUserByUsername(conn, lr.username().trim());
                    if (u == null || !u.isEnabled()) {
                        ServletUtil.writeJson(resp, HttpServletResponse.SC_UNAUTHORIZED, Map.of("error", "Invalid credentials"));
                        return;
                    }
                    if (!BCrypt.verifyer().verify(lr.password().toCharArray(), u.getPasswordHash()).verified) {
                        ServletUtil.writeJson(resp, HttpServletResponse.SC_UNAUTHORIZED, Map.of("error", "Invalid credentials"));
                        return;
                    }
                    UserPrincipal p = toPrincipal(u);
                    String token = JwtHelper.generateToken(p);
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, new AuthResponse(token, toUserResponse(u)));
                }
                return;
            }
            if (segs.length == 1 && "register".equals(segs[0])) {
                RegisterRequest rr = Jsons.gson().fromJson(body, RegisterRequest.class);
                try (Connection conn = DBConnection.getConnection()) {
                    if (existsUsername(conn, rr.username())) {
                        ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Username already taken"));
                        return;
                    }
                    if (existsEmail(conn, rr.email())) {
                        ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Email already registered"));
                        return;
                    }
                    UserRole role;
                    try {
                        role = resolveRegistrationRole(rr.role());
                    } catch (IllegalArgumentException ex) {
                        ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", ex.getMessage()));
                        return;
                    }
                    User u = new User();
                    u.setUsername(rr.username().trim());
                    u.setEmail(rr.email().trim().toLowerCase());
                    u.setPasswordHash(BCrypt.withDefaults().hashToString(10, rr.password().toCharArray()));
                    u.setFullName(rr.fullName().trim());
                    u.setStudentIdNumber(rr.studentIdNumber() != null && !rr.studentIdNumber().isBlank()
                            ? rr.studentIdNumber().trim() : null);
                    u.setRole(role);
                    u.setEnabled(true);
                    insertUser(conn, u);
                    User loaded = UserQueries.loadUserByUsername(conn, u.getUsername());
                    UserPrincipal p = toPrincipal(loaded);
                    String token = JwtHelper.generateToken(p);
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, new AuthResponse(token, toUserResponse(loaded)));
                }
                return;
            }
            if (segs.length == 1 && "forgot-password".equals(segs[0])) {
                ForgotPasswordRequest fr = Jsons.gson().fromJson(body, ForgotPasswordRequest.class);
                try (Connection conn = DBConnection.getConnection()) {
                    try (PreparedStatement ps = conn.prepareStatement(
                            "SELECT id FROM users WHERE LOWER(email) = LOWER(?)")) {
                        ps.setString(1, fr.email().trim());
                        try (ResultSet rs = ps.executeQuery()) {
                            if (rs.next()) {
                                long userId = rs.getLong(1);
                                byte[] raw = new byte[32];
                                new SecureRandom().nextBytes(raw);
                                String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
                                try (PreparedStatement ins = conn.prepareStatement(
                                        "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?,?,?)")) {
                                    ins.setString(1, token);
                                    ins.setLong(2, userId);
                                    ins.setTimestamp(3, Timestamp.valueOf(LocalDateTime.now().plusHours(24)));
                                    ins.executeUpdate();
                                }
                            }
                        }
                    }
                }
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, Map.of(
                        "message", "If an account exists for that email, reset instructions have been sent."));
                return;
            }
            if (segs.length == 1 && "reset-password".equals(segs[0])) {
                ResetPasswordRequest rr = Jsons.gson().fromJson(body, ResetPasswordRequest.class);
                try (Connection conn = DBConnection.getConnection()) {
                    try (PreparedStatement ps = conn.prepareStatement(
                            "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ?")) {
                        ps.setString(1, rr.token());
                        try (ResultSet rs = ps.executeQuery()) {
                            if (!rs.next()) {
                                ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Invalid or expired token"));
                                return;
                            }
                            if (rs.getTimestamp("used_at") != null
                                    || rs.getTimestamp("expires_at").toLocalDateTime().isBefore(LocalDateTime.now())) {
                                ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Invalid or expired token"));
                                return;
                            }
                            long tokenId = rs.getLong("id");
                            long userId = rs.getLong("user_id");
                            String hash = BCrypt.withDefaults().hashToString(10, rr.newPassword().toCharArray());
                            try (PreparedStatement up = conn.prepareStatement("UPDATE users SET password_hash = ? WHERE id = ?")) {
                                up.setString(1, hash);
                                up.setLong(2, userId);
                                up.executeUpdate();
                            }
                            try (PreparedStatement up = conn.prepareStatement(
                                    "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?")) {
                                up.setLong(1, tokenId);
                                up.executeUpdate();
                            }
                        }
                    }
                }
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, Map.of("message", "Password updated"));
                return;
            }
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
            return;
        }
        ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Not found"));
    }

    private static UserRole resolveRegistrationRole(UserRole requested) {
        if (requested == null || requested == UserRole.STUDENT) {
            return UserRole.STUDENT;
        }
        if (requested == UserRole.ADMIN) {
            throw new IllegalArgumentException("Cannot register as administrator");
        }
        if (requested == UserRole.LECTURER) {
            boolean allow = Boolean.parseBoolean(firstNonBlank(
                    System.getenv("ESUKAN_ALLOW_LECTURER_SELF_REGISTER"),
                    System.getProperty("esukan.auth.allow-lecturer-self-register"),
                    DBConnection.getAppProperties().getProperty("esukan.auth.allow-lecturer-self-register", "true")));
            return allow ? UserRole.LECTURER : UserRole.STUDENT;
        }
        return UserRole.STUDENT;
    }

    private static String firstNonBlank(String... v) {
        for (String s : v) {
            if (s != null && !s.isBlank()) {
                return s;
            }
        }
        return "";
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
        String sql = "INSERT INTO users (username, email, password_hash, role, full_name, student_id_number, enabled) VALUES (?,?,?,?,?,?,?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
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

    private static UserPrincipal toPrincipal(User u) {
        return new UserPrincipal(
                u.getId(),
                u.getUsername(),
                u.getPasswordHash(),
                u.isEnabled(),
                u.getRole(),
                u.getStudentIdNumber(),
                u.getEmail(),
                u.getFullName()
        );
    }

    private static UserResponse toUserResponse(User u) {
        return new UserResponse(
                u.getId(),
                u.getUsername(),
                u.getEmail(),
                u.getFullName(),
                u.getStudentIdNumber(),
                u.getRole()
        );
    }
}
