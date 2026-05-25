package com.esukan.servlet;

import com.esukan.model.Facility;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.Optional;

public final class OperatingHoursHelper {

    public record EffectiveHours(LocalTime open, LocalTime close) {}

    private OperatingHoursHelper() {}

    public static EffectiveHours getEffectiveHours(Connection conn, long facilityId) throws Exception {
        LocalTime globalOpen = getSettingTime(conn, "default_open_time", LocalTime.of(8, 0));
        LocalTime globalClose = getSettingTime(conn, "default_close_time", LocalTime.of(22, 0));
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT open_time, close_time FROM facilities WHERE id = ?")) {
            ps.setLong(1, facilityId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new RuntimeException("Facility not found");
                }
                LocalTime open = readTimeColumn(rs, "open_time");
                LocalTime close = readTimeColumn(rs, "close_time");
                if (open != null || close != null) {
                    LocalTime effOpen = open != null ? open : globalOpen;
                    LocalTime effClose = close != null ? close : globalClose;
                    if (effOpen.isBefore(effClose)) {
                        return new EffectiveHours(effOpen, effClose);
                    }
                }
            }
        }
        return new EffectiveHours(globalOpen, globalClose);
    }

    public static void validateBookingSlot(Connection conn, long facilityId, LocalDate date,
            LocalTime start, LocalTime end) throws Exception {
        if (!isFacilityActive(conn, facilityId)) {
            throw new RuntimeException("Facility is not available for booking");
        }
        if (!start.isBefore(end)) {
            throw new RuntimeException("End time must be after start time");
        }
        LocalDateTime slotStart = LocalDateTime.of(date, start);
        if (slotStart.isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Cannot book a time slot in the past");
        }
        EffectiveHours hours = getEffectiveHours(conn, facilityId);
        if (start.isBefore(hours.open()) || end.isAfter(hours.close())) {
            throw new RuntimeException("Booking must be within operating hours "
                    + hours.open() + " – " + hours.close());
        }
    }

    private static boolean isFacilityActive(Connection conn, long facilityId) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("SELECT is_active FROM facilities WHERE id = ?")) {
            ps.setLong(1, facilityId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getBoolean("is_active");
            }
        }
    }

    public static LocalTime getSettingTime(Connection conn, String key, LocalTime fallback) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT setting_value FROM system_settings WHERE setting_key = ?")) {
            ps.setString(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return parseTime(rs.getString("setting_value"));
                }
            }
        }
        return fallback;
    }

    public static void setSetting(Connection conn, String key, String value) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE system_settings SET setting_value = ? WHERE setting_key = ?")) {
            ps.setString(1, value);
            ps.setString(2, key);
            if (ps.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)")) {
            ps.setString(1, key);
            ps.setString(2, value);
            ps.executeUpdate();
        }
    }

    public static LocalTime parseTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String v = raw.trim();
        if (v.length() == 5) {
            return LocalTime.parse(v + ":00");
        }
        return LocalTime.parse(v);
    }

    public static void enrichFacilityHours(Connection conn, Facility f) throws Exception {
        EffectiveHours h = getEffectiveHours(conn, f.getId());
        f.setEffectiveOpenTime(h.open());
        f.setEffectiveCloseTime(h.close());
    }

    private static LocalTime readTimeColumn(ResultSet rs, String column) throws SQLException {
        try {
            LocalTime t = rs.getObject(column, LocalTime.class);
            if (t != null) {
                return t;
            }
        } catch (SQLException ignored) {
            // fall through for drivers that do not map TIME to LocalTime
        }
        String raw = rs.getString(column);
        return parseTime(raw);
    }
}
