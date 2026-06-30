package com.esukan.servlet;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Arrays;
import java.util.List;

public final class SchemaMigration {

    private SchemaMigration() {}

    public static void runFeatureMigrations(Connection conn) throws IOException, SQLException {
        try (InputStream in = SchemaMigration.class.getClassLoader().getResourceAsStream("migration-features.sql")) {
            if (in == null) {
                return;
            }
            String sql = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            try (Statement st = conn.createStatement()) {
                for (String stmt : splitStatements(sql)) {
                    if (!stmt.isBlank()) {
                        try {
                            st.execute(stmt);
                        } catch (SQLException ignored) {
                            // idempotent: column/table may already exist on some engines
                        }
                    }
                }
            }
        }
        seedSettingsIfEmpty(conn);
        ensureBookingPaymentSchema(conn);
    }

    private static void execIgnore(Connection conn, String sql) {
        try {
            exec(conn, sql);
        } catch (SQLException ignored) {
            // idempotent
        }
    }

    /**
     * Reliable column adds for H2/MySQL (ALTER ... IF NOT EXISTS is not always supported).
     */
    public static void ensureBookingPaymentSchema(Connection conn) throws SQLException {
        if (!columnExists(conn, "bookings", "estimated_cost")) {
            exec(conn, "ALTER TABLE bookings ADD COLUMN estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00");
        }
        if (!columnExists(conn, "payments", "booking_id")) {
            exec(conn, "ALTER TABLE payments ADD COLUMN booking_id BIGINT NULL");
        }
        relaxPaymentsRentalId(conn);
    }

    private static void exec(Connection conn, String sql) throws SQLException {
        try (Statement st = conn.createStatement()) {
            st.execute(sql);
        }
    }

    private static boolean columnExists(Connection conn, String table, String column) throws SQLException {
        DatabaseMetaData meta = conn.getMetaData();
        String[] candidates = {table, table.toUpperCase(), table.toLowerCase()};
        String[] cols = {column, column.toUpperCase(), column.toLowerCase()};
        for (String t : candidates) {
            for (String c : cols) {
                try (ResultSet rs = meta.getColumns(null, null, t, c)) {
                    if (rs.next()) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private static void runSqlResource(Connection conn, String resource) throws IOException, SQLException {
        try (InputStream in = SchemaMigration.class.getClassLoader().getResourceAsStream(resource)) {
            if (in == null) {
                return;
            }
            String sql = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            try (Statement st = conn.createStatement()) {
                for (String stmt : splitStatements(sql)) {
                    if (!stmt.isBlank()) {
                        try {
                            st.execute(stmt);
                        } catch (SQLException ignored) {
                            // idempotent
                        }
                    }
                }
            }
        }
    }

    /** Allow payments for bookings (rental_id optional on H2/MySQL). */
    private static void relaxPaymentsRentalId(Connection conn) throws SQLException {
        if (columnNullable(conn, "payments", "rental_id")) {
            return;
        }
        String[] attempts = {
                "ALTER TABLE payments MODIFY COLUMN rental_id BIGINT NULL",
                "ALTER TABLE payments ALTER COLUMN rental_id SET NULL",
                "ALTER TABLE payments MODIFY rental_id BIGINT NULL"
        };
        for (String sql : attempts) {
            try {
                exec(conn, sql);
            } catch (SQLException ignored) {
                // try next dialect
            }
            if (columnNullable(conn, "payments", "rental_id")) {
                return;
            }
        }
    }

    private static boolean columnNullable(Connection conn, String table, String column) throws SQLException {
        DatabaseMetaData meta = conn.getMetaData();
        String[] tables = {table, table.toUpperCase(), table.toLowerCase()};
        String[] cols = {column, column.toUpperCase(), column.toLowerCase()};
        for (String t : tables) {
            for (String c : cols) {
                try (ResultSet rs = meta.getColumns(null, null, t, c)) {
                    if (rs.next()) {
                        int nullable = rs.getInt("NULLABLE");
                        return nullable == DatabaseMetaData.columnNullable
                                || nullable == DatabaseMetaData.columnNullableUnknown;
                    }
                }
            }
        }
        return false;
    }

    private static void seedSettingsIfEmpty(Connection conn) throws SQLException {
        if (count(conn, "SELECT COUNT(*) FROM system_settings") > 0) {
            return;
        }
        try (Statement st = conn.createStatement()) {
            st.executeUpdate("INSERT INTO system_settings (setting_key, setting_value) VALUES ('default_open_time', '08:00')");
            st.executeUpdate("INSERT INTO system_settings (setting_key, setting_value) VALUES ('default_close_time', '22:00')");
        }
    }

    private static long count(Connection conn, String sql) throws SQLException {
        try (Statement st = conn.createStatement();
             var rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private static List<String> splitStatements(String sql) {
        return Arrays.stream(sql.split(";"))
                .map(String::trim)
                .filter(s -> !s.isEmpty() && !s.startsWith("--"))
                .toList();
    }
}
