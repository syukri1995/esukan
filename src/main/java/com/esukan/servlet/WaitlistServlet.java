package com.esukan.servlet;

import com.esukan.model.BookingWaitlist;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class WaitlistServlet extends BaseHttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null) {
            return;
        }
        try (Connection conn = DBConnection.getConnection()) {
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            List<BookingWaitlist> list = full.getRole() == UserRole.ADMIN
                    ? WaitlistQueries.listAll(conn)
                    : WaitlistQueries.listForUser(conn, full);
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, list);
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
            LocalDate bookingDate = LocalDate.parse(String.valueOf(payload.get("bookingDate")));
            LocalTime startTime = LocalTime.parse(String.valueOf(payload.get("startTime")));
            LocalTime endTime = LocalTime.parse(String.valueOf(payload.get("endTime")));
            long facilityId = ServletUtil.parseLongValue(payload.get("facilityId"));
            OperatingHoursHelper.validateBookingSlot(conn, facilityId, bookingDate, startTime, endTime);
            if (!BookingSlotHelper.hasConflict(conn, facilityId, bookingDate, startTime, endTime)) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST,
                        Map.of("error", "This time slot is available. Book the facility directly instead of joining the waitlist."));
                return;
            }
            if (WaitlistQueries.hasWaitingDuplicate(conn, u.getId(), facilityId, bookingDate, startTime, endTime)) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST,
                        Map.of("error", "You are already on the waitlist for this time slot."));
                return;
            }
            String notes = payload.get("notes") != null ? String.valueOf(payload.get("notes")) : null;
            String studentId = u.getStudentIdNumber() != null && !u.getStudentIdNumber().isBlank()
                    ? u.getStudentIdNumber()
                    : "U" + u.getId();
            String sql = """
                    INSERT INTO booking_waitlist (student_name, student_id, student_email, facility_id, user_id,
                    booking_date, start_time, end_time, status, notes)
                    VALUES (?,?,?,?,?,?,?,?, 'WAITING',?)
                    """;
            try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, u.getFullName());
                ps.setString(2, studentId);
                ps.setString(3, u.getEmail());
                ps.setLong(4, facilityId);
                ps.setLong(5, u.getId());
                ps.setObject(6, bookingDate);
                ps.setObject(7, startTime);
                ps.setObject(8, endTime);
                ps.setString(9, notes);
                ps.executeUpdate();
                ResultSet keys = ps.getGeneratedKeys();
                keys.next();
                long newId = keys.getLong(1);
                BookingWaitlist created = WaitlistQueries.findById(conn, newId).orElseThrow();
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, created);
            }
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
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
            Optional<BookingWaitlist> w = WaitlistQueries.findById(conn, id);
            if (w.isEmpty() || !WaitlistQueries.canAccess(w.get(), full)) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                return;
            }
            if (w.get().getStatus() != BookingWaitlist.WaitlistStatus.WAITING) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST,
                        Map.of("error", "Only waiting entries can be removed"));
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE booking_waitlist SET status = 'CANCELLED' WHERE id = ?")) {
                ps.setLong(1, id);
                ps.executeUpdate();
            }
            resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }
}
