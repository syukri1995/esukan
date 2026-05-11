package com.esukan.listener;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.esukan.model.User;
import com.esukan.model.UserRole;
import com.esukan.util.DBConnection;

import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Arrays;
import java.util.List;

public class EsukanContextListener implements ServletContextListener {

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        try {
            DBConnection.init();
            try (Connection conn = DBConnection.getConnection()) {
                runBootstrapSql(conn);
                seedIfEmpty(conn);
            }
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize database", e);
        }
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        DBConnection.shutdown();
    }

    private static void runBootstrapSql(Connection conn) throws IOException, java.sql.SQLException {
        try (InputStream in = EsukanContextListener.class.getClassLoader().getResourceAsStream("schema-bootstrap.sql")) {
            if (in == null) {
                throw new IOException("schema-bootstrap.sql missing");
            }
            String sql = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            try (Statement st = conn.createStatement()) {
                for (String stmt : splitStatements(sql)) {
                    if (!stmt.isBlank()) {
                        st.execute(stmt);
                    }
                }
            }
        }
    }

    private static List<String> splitStatements(String sql) {
        return Arrays.stream(sql.split(";"))
                .map(String::trim)
                .filter(s -> !s.isEmpty() && !s.startsWith("--"))
                .toList();
    }

    private static void seedIfEmpty(Connection conn) throws java.sql.SQLException {
        try (Statement st = conn.createStatement()) {
            if (count(conn, "SELECT COUNT(*) FROM facilities") == 0) {
                st.executeUpdate("INSERT INTO facilities (name, type, description) VALUES "
                        + "('Badminton Court 1', 'BADMINTON', 'Main badminton court near sports complex entrance'),"
                        + "('Badminton Court 2', 'BADMINTON', 'Indoor badminton court with air conditioning'),"
                        + "('Badminton Court 3', 'BADMINTON', 'Outdoor badminton court'),"
                        + "('Futsal Court A', 'FUTSAL', 'Full-size futsal court with synthetic turf'),"
                        + "('Futsal Court B', 'FUTSAL', 'Indoor futsal court, capacity 10 players')");
            }
            if (count(conn, "SELECT COUNT(*) FROM equipment") == 0) {
                st.executeUpdate("INSERT INTO equipment (name, category, status, quantity, description) VALUES "
                        + "('Badminton Racket', 'Racket Sports', 'AVAILABLE', 20, 'Yonex standard rackets'),"
                        + "('Shuttlecock (tube)', 'Racket Sports', 'AVAILABLE', 50, 'Feather shuttlecocks'),"
                        + "('Futsal Ball', 'Ball Sports', 'AVAILABLE', 10, 'Size 4 futsal balls'),"
                        + "('Goalkeeper Gloves', 'Protective Gear', 'AVAILABLE', 5, 'Standard goalkeeper gloves'),"
                        + "('Knee Guard', 'Protective Gear', 'IN_MAINTENANCE', 8, 'Knee protection for futsal'),"
                        + "('Bibs / Vests', 'Apparel', 'AVAILABLE', 30, 'Team differentiation bibs'),"
                        + "('Score Counter', 'Accessories', 'DAMAGED', 2, 'Manual score counters'),"
                        + "('Badminton Net', 'Court Equipment', 'AVAILABLE', 3, 'Portable badminton nets')");
            }
        }
        if (count(conn, "SELECT COUNT(*) FROM users") > 0) {
            return;
        }
        insertUser(conn, user("admin", "admin@esukan.local", "admin123", "System Admin", null, UserRole.ADMIN));
        insertUser(conn, user("lecturer", "lecturer@esukan.local", "lecturer123", "Dr. Sports", "L001", UserRole.LECTURER));
        insertUser(conn, user("student", "student@esukan.local", "student123", "Ali Student", "S001234", UserRole.STUDENT));
    }

    private static User user(String username, String email, String raw, String fullName, String sid, UserRole role) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setPasswordHash(BCrypt.withDefaults().hashToString(10, raw.toCharArray()));
        u.setFullName(fullName);
        u.setStudentIdNumber(sid);
        u.setRole(role);
        u.setEnabled(true);
        return u;
    }

    private static void insertUser(Connection conn, User u) throws java.sql.SQLException {
        String sql = "INSERT INTO users (username, email, password_hash, role, full_name, student_id_number, enabled) VALUES ("
                + "'" + esc(u.getUsername()) + "',"
                + "'" + esc(u.getEmail()) + "',"
                + "'" + esc(u.getPasswordHash()) + "',"
                + "'" + u.getRole().name() + "',"
                + "'" + esc(u.getFullName()) + "',"
                + (u.getStudentIdNumber() == null ? "NULL" : "'" + esc(u.getStudentIdNumber()) + "'") + ","
                + (u.isEnabled() ? "TRUE" : "FALSE") + ")";
        try (Statement st = conn.createStatement()) {
            st.executeUpdate(sql);
        }
    }

    private static String esc(String s) {
        return s.replace("'", "''");
    }

    private static long count(Connection conn, String q) throws java.sql.SQLException {
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(q)) {
            rs.next();
            return rs.getLong(1);
        }
    }
}
