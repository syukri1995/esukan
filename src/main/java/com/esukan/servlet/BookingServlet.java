package com.esukan.servlet;

import com.esukan.model.Booking;
import com.esukan.model.Facility;
import com.esukan.model.User;
import com.esukan.model.UserRole;
import com.esukan.security.JwtHelper;
import com.esukan.security.UserPrincipal;
import com.esukan.util.DBConnection;
import com.google.gson.reflect.TypeToken;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.lang.reflect.Type;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public class BookingServlet extends BaseHttpServlet {

    private static final String BOOKING_JOIN = """
            SELECT b.id as br_id, b.student_name as br_student_name, b.student_id as br_student_id,
            b.student_email as br_student_email, b.booking_date as br_booking_date,
            b.start_time as br_start_time, b.end_time as br_end_time, b.status as br_status,
            b.notes as br_notes, b.created_at as br_created_at, b.user_id as br_user_id,
            f.id as f_id, f.name as f_name, f.type as f_type, f.description as f_description,
            f.is_active as f_is_active, f.created_at as f_created_at
            FROM bookings b JOIN facilities f ON b.facility_id = f.id
            """;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null) {
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        try (Connection conn = DBConnection.getConnection()) {
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            if (segs.length == 0) {
                List<Booking> list = full.getRole() == UserRole.ADMIN
                        ? listAll(conn)
                        : listForUser(conn, full);
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, list);
                return;
            }
            if (segs.length == 1 && "dashboard".equals(segs[0])) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, dashboardStats(conn, full));
                return;
            }
            if (segs.length == 2 && "peak-hours".equals(segs[0])) {
                long fid = Long.parseLong(segs[1]);
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, peakHours(conn, fid));
                return;
            }
            if (segs.length == 2 && "student".equals(segs[0])) {
                if (full.getRole() != UserRole.ADMIN) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
                    return;
                }
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listByStudent(conn, segs[1]));
                return;
            }
            if (segs.length == 2 && "date".equals(segs[0])) {
                LocalDate d = LocalDate.parse(segs[1]);
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listByDateForUser(conn, d, full));
                return;
            }
            if (segs.length == 2 && "status".equals(segs[0])) {
                Booking.BookingStatus st = Booking.BookingStatus.valueOf(segs[1]);
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listByStatusForUser(conn, st, full));
                return;
            }
            if (segs.length == 1) {
                long id = Long.parseLong(segs[0]);
                Optional<Booking> b = findById(conn, id);
                if (b.isEmpty() || !canAccess(b.get(), full)) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                    return;
                }
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, b.get());
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
        if (auth == null) {
            return;
        }
        Type mapType = new TypeToken<Map<String, Object>>() {}.getType();
        Map<String, Object> payload = com.esukan.util.Jsons.gson().fromJson(ServletUtil.readBody(req), mapType);
        try (Connection conn = DBConnection.getConnection()) {
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            User u = UserQueries.loadUser(conn, full.getId());
            Booking booking = new Booking();
            booking.setStudentName(u.getFullName());
            booking.setStudentId(u.getStudentIdNumber() != null && !u.getStudentIdNumber().isBlank()
                    ? u.getStudentIdNumber()
                    : "U" + u.getId());
            booking.setStudentEmail(u.getEmail());
            booking.setUser(u);
            if (payload.get("notes") != null) {
                booking.setNotes(String.valueOf(payload.get("notes")));
            }
            booking.setBookingDate(LocalDate.parse(String.valueOf(payload.get("bookingDate"))));
            booking.setStartTime(LocalTime.parse(String.valueOf(payload.get("startTime"))));
            booking.setEndTime(LocalTime.parse(String.valueOf(payload.get("endTime"))));
            long facilityId = Long.parseLong(payload.get("facilityId").toString());
            Facility facility = loadFacility(conn, facilityId)
                    .orElseThrow(() -> new RuntimeException("Facility not found"));
            booking.setFacility(facility);
            if (!conflicts(conn, facilityId, booking.getBookingDate(), booking.getStartTime(), booking.getEndTime()).isEmpty()) {
                throw new RuntimeException("Time slot conflict: This facility is already booked for the selected time.");
            }
            String sql = """
                    INSERT INTO bookings (student_name, student_id, student_email, facility_id, user_id,
                    booking_date, start_time, end_time, status, notes)
                    VALUES (?,?,?,?,?,?,?,?, 'PENDING',?)
                    """;
            try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, booking.getStudentName());
                ps.setString(2, booking.getStudentId());
                ps.setString(3, booking.getStudentEmail());
                ps.setLong(4, facilityId);
                ps.setObject(5, u.getId());
                ps.setObject(6, booking.getBookingDate());
                ps.setObject(7, booking.getStartTime());
                ps.setObject(8, booking.getEndTime());
                ps.setString(9, booking.getNotes());
                ps.executeUpdate();
                ResultSet keys = ps.getGeneratedKeys();
                keys.next();
                long newId = keys.getLong(1);
                Booking created = findById(conn, newId).orElseThrow();
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, created);
            }
        } catch (RuntimeException e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
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
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length != 2 || !"status".equals(segs[1])) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Not found"));
            return;
        }
        UserPrincipal full = null;
        try (Connection conn = DBConnection.getConnection()) {
            full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            if (full.getRole() != UserRole.ADMIN) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Only administrators can update booking status"));
                return;
            }
            long id = Long.parseLong(segs[0]);
            String statusStr = req.getParameter("status");
            if (statusStr == null) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "status required"));
                return;
            }
            Booking.BookingStatus st = Booking.BookingStatus.valueOf(statusStr);
            try (PreparedStatement ps = conn.prepareStatement("UPDATE bookings SET status = ? WHERE id = ?")) {
                ps.setString(1, st.name());
                ps.setLong(2, id);
                if (ps.executeUpdate() == 0) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                    return;
                }
            }
            Optional<Booking> updated = findById(conn, id);
            if (updated.isPresent()) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, updated.get());
            }
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null) {
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length != 1) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
            return;
        }
        long id = Long.parseLong(segs[0]);
        try (Connection conn = DBConnection.getConnection()) {
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            Optional<Booking> b = findById(conn, id);
            if (b.isEmpty()) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                return;
            }
            if (full.getRole() != UserRole.ADMIN && !canAccess(b.get(), full)) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of());
                return;
            }
            if (full.getRole() != UserRole.ADMIN && b.get().getStatus() != Booking.BookingStatus.PENDING) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of());
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM bookings WHERE id = ?")) {
                ps.setLong(1, id);
                ps.executeUpdate();
            }
            resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    private static Optional<Facility> loadFacility(Connection conn, long id) throws java.sql.SQLException {
        String sql = "SELECT id, name, type, description, is_active, created_at FROM facilities WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(JdbcSupport.mapFacility(rs, ""));
            }
        }
    }

    private static List<Booking> listAll(Connection conn) throws java.sql.SQLException {
        String sql = BOOKING_JOIN + " ORDER BY b.booking_date DESC, b.start_time DESC";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return readBookings(rs);
        }
    }

    private static List<Booking> listForUser(Connection conn, UserPrincipal p) throws java.sql.SQLException {
        String sid = p.getStudentIdNumber();
        if (sid != null && !sid.isBlank()) {
            String sql = BOOKING_JOIN + " WHERE b.user_id = ? OR b.student_id = ? ORDER BY b.booking_date DESC";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setLong(1, p.getId());
                ps.setString(2, sid);
                try (ResultSet rs = ps.executeQuery()) {
                    return readBookings(rs);
                }
            }
        }
        String sql = BOOKING_JOIN + " WHERE b.user_id = ? ORDER BY b.booking_date DESC";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, p.getId());
            try (ResultSet rs = ps.executeQuery()) {
                return readBookings(rs);
            }
        }
    }

    private static List<Booking> listByStudent(Connection conn, String studentId) throws java.sql.SQLException {
        String sql = BOOKING_JOIN + " WHERE b.student_id = ? ORDER BY b.booking_date DESC";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, studentId);
            try (ResultSet rs = ps.executeQuery()) {
                return readBookings(rs);
            }
        }
    }

    private static List<Booking> listByDateForUser(Connection conn, LocalDate date, UserPrincipal p) throws java.sql.SQLException {
        if (p.getRole() == UserRole.ADMIN) {
            String sql = BOOKING_JOIN + " WHERE b.booking_date = ? ORDER BY b.start_time";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setObject(1, date);
                try (ResultSet rs = ps.executeQuery()) {
                    return readBookings(rs);
                }
            }
        }
        return listForUser(conn, p).stream().filter(b -> date.equals(b.getBookingDate())).toList();
    }

    private static List<Booking> listByStatusForUser(Connection conn, Booking.BookingStatus status, UserPrincipal p)
            throws java.sql.SQLException {
        if (p.getRole() == UserRole.ADMIN) {
            String sql = BOOKING_JOIN + " WHERE b.status = ? ORDER BY b.booking_date DESC";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, status.name());
                try (ResultSet rs = ps.executeQuery()) {
                    return readBookings(rs);
                }
            }
        }
        return listForUser(conn, p).stream().filter(b -> b.getStatus() == status).toList();
    }

    private static List<Booking> readBookings(ResultSet rs) throws java.sql.SQLException {
        List<Booking> out = new ArrayList<>();
        while (rs.next()) {
            out.add(JdbcSupport.mapBookingJoined(rs));
        }
        return out;
    }

    private static Optional<Booking> findById(Connection conn, long id) throws java.sql.SQLException {
        String sql = BOOKING_JOIN + " WHERE b.id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(JdbcSupport.mapBookingJoined(rs));
            }
        }
    }

    private static boolean canAccess(Booking b, UserPrincipal p) {
        if (p.getRole() == UserRole.ADMIN) {
            return true;
        }
        if (b.getUser() != null && b.getUser().getId().equals(p.getId())) {
            return true;
        }
        return p.getStudentIdNumber() != null && p.getStudentIdNumber().equals(b.getStudentId());
    }

    private static List<Booking> conflicts(Connection conn, long facilityId, LocalDate date, LocalTime start, LocalTime end)
            throws java.sql.SQLException {
        String sql = """
                SELECT b.id as br_id, b.student_name as br_student_name, b.student_id as br_student_id,
                b.student_email as br_student_email, b.booking_date as br_booking_date,
                b.start_time as br_start_time, b.end_time as br_end_time, b.status as br_status,
                b.notes as br_notes, b.created_at as br_created_at, b.user_id as br_user_id,
                f.id as f_id, f.name as f_name, f.type as f_type, f.description as f_description,
                f.is_active as f_is_active, f.created_at as f_created_at
                FROM bookings b JOIN facilities f ON b.facility_id = f.id
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
                return readBookings(rs);
            }
        }
    }

    private static Map<String, Object> dashboardStats(Connection conn, UserPrincipal p) throws java.sql.SQLException {
        Map<String, Object> stats = new LinkedHashMap<>();
        if (p.getRole() == UserRole.ADMIN) {
            stats.put("totalBookings", count(conn, "SELECT COUNT(*) FROM bookings"));
            stats.put("pendingBookings", count(conn, "SELECT COUNT(*) FROM bookings WHERE status = 'PENDING'"));
            stats.put("todayBookings", count(conn, "SELECT COUNT(*) FROM bookings WHERE booking_date = CURRENT_DATE"));
            stats.put("bookingsByFacilityType", countByFacilityType(conn));
        } else {
            List<Booking> mine = listForUser(conn, p);
            LocalDate today = LocalDate.now();
            stats.put("totalBookings", (long) mine.size());
            stats.put("pendingBookings", mine.stream().filter(b -> b.getStatus() == Booking.BookingStatus.PENDING).count());
            stats.put("todayBookings", mine.stream().filter(b -> today.equals(b.getBookingDate())).count());
            stats.put("bookingsByFacilityType", mine.stream()
                    .filter(b -> b.getFacility() != null && b.getFacility().getType() != null)
                    .collect(Collectors.groupingBy(
                            b -> b.getFacility().getType().name(),
                            Collectors.counting())));
        }
        return stats;
    }

    private static Map<String, Long> countByFacilityType(Connection conn) throws java.sql.SQLException {
        Map<String, Long> m = new LinkedHashMap<>();
        String sql = "SELECT f.type, COUNT(*) FROM bookings b JOIN facilities f ON b.facility_id = f.id GROUP BY f.type";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                m.put(rs.getString(1), rs.getLong(2));
            }
        }
        return m;
    }

    private static long count(Connection conn, String sql) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private static Map<String, Long> peakHours(Connection conn, long facilityId) throws java.sql.SQLException {
        Map<String, Long> map = new LinkedHashMap<>();
        String sql = """
                SELECT CAST(start_time AS CHAR) as hr, COUNT(*) as c
                FROM bookings WHERE facility_id = ? AND status = 'CONFIRMED'
                GROUP BY start_time ORDER BY c DESC
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, facilityId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    map.put(rs.getString("hr"), rs.getLong("c"));
                }
            }
        }
        return map;
    }
}
