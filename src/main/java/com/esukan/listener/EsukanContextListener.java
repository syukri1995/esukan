package com.esukan.listener;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.esukan.model.User;
import com.esukan.model.UserRole;
import com.esukan.servlet.SchemaMigration;
import com.esukan.servlet.UserQueries;
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
                SchemaMigration.runFeatureMigrations(conn);
                seedIfEmpty(conn);
                ensureSmokeUsers(conn);
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
                st.executeUpdate("INSERT INTO facilities (name, type, description, cost_per_hour) VALUES "
                        + "('Badminton Court 1', 'BADMINTON', 'Main badminton court near sports complex entrance', 10.00),"
                        + "('Badminton Court 2', 'BADMINTON', 'Indoor badminton court with air conditioning', 15.00),"
                        + "('Badminton Court 3', 'BADMINTON', 'Outdoor badminton court', 8.00),"
                        + "('Futsal Court A', 'FUTSAL', 'Full-size futsal court with synthetic turf', 25.00),"
                        + "('Futsal Court B', 'FUTSAL', 'Indoor futsal court, capacity 10 players', 30.00)");
            } else {
                st.executeUpdate("UPDATE facilities SET cost_per_hour = 10.00 WHERE name = 'Badminton Court 1' AND cost_per_hour = 0.00");
                st.executeUpdate("UPDATE facilities SET cost_per_hour = 15.00 WHERE name = 'Badminton Court 2' AND cost_per_hour = 0.00");
                st.executeUpdate("UPDATE facilities SET cost_per_hour = 8.00 WHERE name = 'Badminton Court 3' AND cost_per_hour = 0.00");
                st.executeUpdate("UPDATE facilities SET cost_per_hour = 25.00 WHERE name = 'Futsal Court A' AND cost_per_hour = 0.00");
                st.executeUpdate("UPDATE facilities SET cost_per_hour = 30.00 WHERE name = 'Futsal Court B' AND cost_per_hour = 0.00");
            }
            if (count(conn, "SELECT COUNT(*) FROM equipment") == 0) {
                st.executeUpdate("INSERT INTO equipment (name, category, status, quantity, description, cost_per_hour) VALUES "
                        + "('Badminton Racket', 'Racket Sports', 'AVAILABLE', 20, 'Yonex standard rackets', 2.00),"
                        + "('Shuttlecock (tube)', 'Racket Sports', 'AVAILABLE', 50, 'Feather shuttlecocks', 1.00),"
                        + "('Futsal Ball', 'Ball Sports', 'AVAILABLE', 10, 'Size 4 futsal balls', 3.00),"
                        + "('Goalkeeper Gloves', 'Protective Gear', 'AVAILABLE', 5, 'Standard goalkeeper gloves', 2.00),"
                        + "('Knee Guard', 'Protective Gear', 'IN_MAINTENANCE', 8, 'Knee protection for futsal', 1.50),"
                        + "('Bibs / Vests', 'Apparel', 'AVAILABLE', 30, 'Team differentiation bibs', 0.50),"
                        + "('Score Counter', 'Accessories', 'DAMAGED', 2, 'Manual score counters', 1.00),"
                        + "('Badminton Net', 'Court Equipment', 'AVAILABLE', 3, 'Portable badminton nets', 4.00)");
            } else {
                st.executeUpdate("UPDATE equipment SET cost_per_hour = 2.00 WHERE name = 'Badminton Racket' AND cost_per_hour = 0.00");
                st.executeUpdate("UPDATE equipment SET cost_per_hour = 1.00 WHERE name = 'Shuttlecock (tube)' AND cost_per_hour = 0.00");
                st.executeUpdate("UPDATE equipment SET cost_per_hour = 3.00 WHERE name = 'Futsal Ball' AND cost_per_hour = 0.00");
                st.executeUpdate("UPDATE equipment SET cost_per_hour = 2.00 WHERE name = 'Goalkeeper Gloves' AND cost_per_hour = 0.00");
                st.executeUpdate("UPDATE equipment SET cost_per_hour = 1.50 WHERE name = 'Knee Guard' AND cost_per_hour = 0.00");
                st.executeUpdate("UPDATE equipment SET cost_per_hour = 0.50 WHERE name = 'Bibs / Vests' AND cost_per_hour = 0.00");
                st.executeUpdate("UPDATE equipment SET cost_per_hour = 1.00 WHERE name = 'Score Counter' AND cost_per_hour = 0.00");
                st.executeUpdate("UPDATE equipment SET cost_per_hour = 4.00 WHERE name = 'Badminton Net' AND cost_per_hour = 0.00");
            }
        }
        if (count(conn, "SELECT COUNT(*) FROM users") > 0) {
            return;
        }
        insertUser(conn, user("admin", "admin@esukan.local", "admin123", "System Admin", null, UserRole.ADMIN));
        insertUser(conn, user("lecturer", "lecturer@esukan.local", "lecturer123", "Dr. Sports", "L001", UserRole.LECTURER));
        insertUser(conn, user("student", "student@esukan.local", "student123", "Ali Student", "S001234", UserRole.STUDENT));
    }

    /** Dedicated automation accounts; created on any deploy if missing (see scripts/smoke-prod.ps1). */
    private static void ensureSmokeUsers(Connection conn) throws java.sql.SQLException {
        ensureUser(conn, user("smoke_student", "smoke_student@esukan.local", "smoke123",
                "Smoke Test Student", "SMOKE001", UserRole.STUDENT));
        ensureUser(conn, user("smoke_admin", "smoke_admin@esukan.local", "smoke123",
                "Smoke Test Admin", null, UserRole.ADMIN));
    }

    private static void ensureUser(Connection conn, User u) throws java.sql.SQLException {
        if (UserQueries.loadUserByUsername(conn, u.getUsername()) != null) {
            return;
        }
        insertUser(conn, u);
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
