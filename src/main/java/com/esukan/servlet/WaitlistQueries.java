package com.esukan.servlet;

import com.esukan.model.BookingWaitlist;
import com.esukan.model.Facility;
import com.esukan.model.User;
import com.esukan.security.UserPrincipal;
import com.esukan.model.UserRole;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class WaitlistQueries {

    private static final String WAITLIST_JOIN = """
            SELECT w.id as wl_id, w.student_name as wl_student_name, w.student_id as wl_student_id,
            w.student_email as wl_student_email, w.booking_date as wl_booking_date,
            w.start_time as wl_start_time, w.end_time as wl_end_time, w.status as wl_status,
            w.notes as wl_notes, w.promoted_booking_id as wl_promoted_booking_id,
            w.created_at as wl_created_at, w.user_id as wl_user_id,
            f.id as f_id, f.name as f_name, f.type as f_type, f.description as f_description,
            f.is_active as f_is_active, f.created_at as f_created_at,
            (SELECT COUNT(*) FROM booking_waitlist w2
             WHERE w2.facility_id = w.facility_id AND w2.booking_date = w.booking_date
             AND w2.start_time = w.start_time AND w2.end_time = w.end_time
             AND w2.status = 'WAITING' AND w2.created_at <= w.created_at) as wl_queue_pos
            FROM booking_waitlist w JOIN facilities f ON w.facility_id = f.id
            """;

    private WaitlistQueries() {}

    public static Optional<BookingWaitlist> findFirstWaiting(Connection conn, long facilityId, LocalDate date,
            LocalTime start, LocalTime end) throws SQLException {
        String sql = WAITLIST_JOIN + """
                 WHERE w.facility_id = ? AND w.booking_date = ? AND w.start_time = ? AND w.end_time = ?
                 AND w.status = 'WAITING'
                 ORDER BY w.created_at ASC
                 LIMIT 1
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, facilityId);
            ps.setObject(2, date);
            ps.setObject(3, start);
            ps.setObject(4, end);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(mapWaitlist(rs));
            }
        }
    }

    public static boolean hasWaitingDuplicate(Connection conn, long userId, long facilityId, LocalDate date,
            LocalTime start, LocalTime end) throws SQLException {
        String sql = """
                SELECT COUNT(*) FROM booking_waitlist
                WHERE user_id = ? AND facility_id = ? AND booking_date = ? AND start_time = ? AND end_time = ?
                AND status = 'WAITING'
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, userId);
            ps.setLong(2, facilityId);
            ps.setObject(3, date);
            ps.setObject(4, start);
            ps.setObject(5, end);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getLong(1) > 0;
            }
        }
    }

    public static void markPromoted(Connection conn, long waitlistId, long bookingId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE booking_waitlist SET status = 'PROMOTED', promoted_booking_id = ? WHERE id = ?")) {
            ps.setLong(1, bookingId);
            ps.setLong(2, waitlistId);
            ps.executeUpdate();
        }
    }

    public static Optional<BookingWaitlist> findById(Connection conn, long id) throws SQLException {
        String sql = WAITLIST_JOIN + " WHERE w.id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(mapWaitlist(rs));
            }
        }
    }

    public static List<BookingWaitlist> listAll(Connection conn) throws SQLException {
        String sql = WAITLIST_JOIN + " ORDER BY w.created_at DESC";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return readAll(rs);
        }
    }

    public static List<BookingWaitlist> listForUser(Connection conn, UserPrincipal p) throws SQLException {
        String sid = p.getStudentIdNumber();
        if (sid != null && !sid.isBlank()) {
            String sql = WAITLIST_JOIN + " WHERE w.user_id = ? OR w.student_id = ? ORDER BY w.created_at DESC";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setLong(1, p.getId());
                ps.setString(2, sid);
                try (ResultSet rs = ps.executeQuery()) {
                    return readAll(rs);
                }
            }
        }
        String sql = WAITLIST_JOIN + " WHERE w.user_id = ? ORDER BY w.created_at DESC";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, p.getId());
            try (ResultSet rs = ps.executeQuery()) {
                return readAll(rs);
            }
        }
    }

    public static boolean canAccess(BookingWaitlist w, UserPrincipal p) {
        if (p.getRole() == UserRole.ADMIN) {
            return true;
        }
        if (w.getUser() != null && w.getUser().getId().equals(p.getId())) {
            return true;
        }
        return p.getStudentIdNumber() != null && p.getStudentIdNumber().equals(w.getStudentId());
    }

    private static List<BookingWaitlist> readAll(ResultSet rs) throws SQLException {
        List<BookingWaitlist> list = new ArrayList<>();
        while (rs.next()) {
            list.add(mapWaitlist(rs));
        }
        return list;
    }

    private static BookingWaitlist mapWaitlist(ResultSet rs) throws SQLException {
        BookingWaitlist w = new BookingWaitlist();
        w.setId(rs.getLong("wl_id"));
        w.setStudentName(rs.getString("wl_student_name"));
        w.setStudentId(rs.getString("wl_student_id"));
        w.setStudentEmail(rs.getString("wl_student_email"));
        w.setBookingDate(rs.getObject("wl_booking_date", LocalDate.class));
        w.setStartTime(rs.getObject("wl_start_time", LocalTime.class));
        w.setEndTime(rs.getObject("wl_end_time", LocalTime.class));
        w.setStatus(BookingWaitlist.WaitlistStatus.valueOf(rs.getString("wl_status").trim()));
        w.setNotes(rs.getString("wl_notes"));
        long promoted = rs.getLong("wl_promoted_booking_id");
        if (!rs.wasNull()) {
            w.setPromotedBookingId(promoted);
        }
        w.setCreatedAt(JdbcSupport.ts(rs.getTimestamp("wl_created_at")));
        w.setQueuePosition(rs.getInt("wl_queue_pos"));
        w.setFacility(JdbcSupport.mapFacility(rs, "f_"));
        Long userId = rs.getLong("wl_user_id");
        if (!rs.wasNull()) {
            User u = new User();
            u.setId(userId);
            w.setUser(u);
        }
        return w;
    }
}
