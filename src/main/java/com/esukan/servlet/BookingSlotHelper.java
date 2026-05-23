package com.esukan.servlet;

import com.esukan.model.Booking;
import com.esukan.model.BookingWaitlist;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

/** Shared facility slot conflict checks and waitlist promotion. */
public final class BookingSlotHelper {

    private BookingSlotHelper() {}

    public static boolean hasConflict(Connection conn, long facilityId, LocalDate date, LocalTime start, LocalTime end)
            throws SQLException {
        String sql = """
                SELECT COUNT(*) FROM bookings b
                WHERE b.facility_id = ? AND b.booking_date = ? AND b.status <> 'CANCELLED'
                AND ((b.start_time <= ? AND b.end_time > ?)
                OR (b.start_time < ? AND b.end_time >= ?)
                OR (b.start_time >= ? AND b.end_time <= ?))
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, facilityId);
            ps.setObject(2, date);
            ps.setObject(3, start);
            ps.setObject(4, start);
            ps.setObject(5, end);
            ps.setObject(6, end);
            ps.setObject(7, start);
            ps.setObject(8, end);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getLong(1) > 0;
            }
        }
    }

    /**
     * Promotes the oldest WAITING entry for this slot to a CONFIRMED booking when the slot is free.
     */
    public static Optional<Booking> promoteNextWaitlist(Connection conn, long facilityId, LocalDate date,
            LocalTime start, LocalTime end) throws SQLException {
        if (hasConflict(conn, facilityId, date, start, end)) {
            return Optional.empty();
        }
        Optional<BookingWaitlist> next = WaitlistQueries.findFirstWaiting(conn, facilityId, date, start, end);
        if (next.isEmpty()) {
            return Optional.empty();
        }
        BookingWaitlist w = next.get();
        String sql = """
                INSERT INTO bookings (student_name, student_id, student_email, facility_id, user_id,
                booking_date, start_time, end_time, status, notes)
                VALUES (?,?,?,?,?,?,?,?, 'CONFIRMED',?)
                """;
        long bookingId;
        try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, w.getStudentName());
            ps.setString(2, w.getStudentId());
            ps.setString(3, w.getStudentEmail());
            ps.setLong(4, facilityId);
            ps.setObject(5, w.getUser() != null ? w.getUser().getId() : null);
            ps.setObject(6, date);
            ps.setObject(7, start);
            ps.setObject(8, end);
            ps.setString(9, w.getNotes());
            ps.executeUpdate();
            ResultSet keys = ps.getGeneratedKeys();
            keys.next();
            bookingId = keys.getLong(1);
        }
        WaitlistQueries.markPromoted(conn, w.getId(), bookingId);
        return BookingServlet.findById(conn, bookingId);
    }

    public static void onSlotFreed(Connection conn, Booking booking) throws SQLException {
        if (booking.getFacility() == null) {
            return;
        }
        promoteNextWaitlist(conn, booking.getFacility().getId(), booking.getBookingDate(),
                booking.getStartTime(), booking.getEndTime());
    }
}
