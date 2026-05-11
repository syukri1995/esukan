package com.esukan.servlet;

import com.esukan.model.User;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public final class UserQueries {

    private UserQueries() {}

    public static User loadUser(Connection conn, long id) throws SQLException {
        String sql = "SELECT id, username, email, password_hash, role, full_name, student_id_number, enabled, created_at FROM users WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new SQLException("User not found");
                }
                return JdbcSupport.mapUserShallow(rs, "");
            }
        }
    }

    public static User loadUserByUsername(Connection conn, String username) throws SQLException {
        String sql = "SELECT id, username, email, password_hash, role, full_name, student_id_number, enabled, created_at FROM users WHERE username = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return JdbcSupport.mapUserShallow(rs, "");
            }
        }
    }
}
