package com.esukan.servlet;

import com.esukan.model.Tournament;
import com.esukan.model.TournamentRegistration;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public class TournamentServlet extends BaseHttpServlet {

    private static final String T_JOIN = """
            SELECT t.id as t_id, t.title as t_title, t.description as t_description, t.start_date, t.end_date,
            t.status as t_status, t.created_at as t_created_at, t.organizer_id, t.venue_facility_id,
            o.id as o_id, o.username as o_username, o.email as o_email, o.password_hash as o_password_hash,
            o.role as o_role, o.full_name as o_full_name, o.student_id_number as o_student_id_number,
            o.enabled as o_enabled, o.created_at as o_created_at,
            vf.name as vf_name, vf.type as vf_type
            FROM tournaments t
            JOIN users o ON t.organizer_id = o.id
            LEFT JOIN facilities vf ON t.venue_facility_id = vf.id
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
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listVisible(conn, full));
                return;
            }
            if (segs.length == 2 && "registrations".equals(segs[1])) {
                long tid = Long.parseLong(segs[0]);
                Optional<Tournament> tt = findById(conn, tid);
                if (tt.isEmpty()) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                    return;
                }
                if (full.getRole() != UserRole.ADMIN && !tt.get().getOrganizer().getId().equals(full.getId())) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
                    return;
                }
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, listRegs(conn, tid));
                return;
            }
            if (segs.length == 1) {
                long id = Long.parseLong(segs[0]);
                Optional<Tournament> t = findById(conn, id);
                if (t.isEmpty() || !canView(t.get(), full)) {
                    ServletUtil.writeJson(resp, t.isEmpty() ? HttpServletResponse.SC_NOT_FOUND : HttpServletResponse.SC_FORBIDDEN, Map.of());
                    return;
                }
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, t.get());
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
        String[] segs = ServletUtil.pathSegments(req);
        Type mapType = new TypeToken<Map<String, Object>>() {}.getType();
        Map<String, Object> body = com.esukan.util.Jsons.gson().fromJson(ServletUtil.readBody(req), mapType);
        try (Connection conn = DBConnection.getConnection()) {
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            if (segs.length == 0) {
                if (full.getRole() != UserRole.LECTURER && full.getRole() != UserRole.ADMIN) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
                    return;
                }
                Tournament.TournamentStatus st = body.get("status") != null
                        ? Tournament.TournamentStatus.valueOf(body.get("status").toString())
                        : Tournament.TournamentStatus.DRAFT;
                Long venueId = body.get("venueFacilityId") != null ? Long.parseLong(body.get("venueFacilityId").toString()) : null;
                long id = insertTournament(conn, full.getId(), String.valueOf(body.get("title")),
                        body.get("description") != null ? String.valueOf(body.get("description")) : null,
                        LocalDate.parse(String.valueOf(body.get("startDate"))),
                        LocalDate.parse(String.valueOf(body.get("endDate"))),
                        venueId, st);
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, id).orElseThrow());
                return;
            }
            if (segs.length == 2 && "registrations".equals(segs[1])) {
                long tid = Long.parseLong(segs[0]);
                if (full.getRole() != UserRole.STUDENT && full.getRole() != UserRole.ADMIN) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Only students may register teams"));
                    return;
                }
                Tournament t = findById(conn, tid).orElse(null);
                if (t == null) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                    return;
                }
                if (t.getStatus() != Tournament.TournamentStatus.OPEN) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Tournament is not open for registration"));
                    return;
                }
                String teamName = String.valueOf(body.get("teamName")).trim();
                if (teamExists(conn, tid, teamName)) {
                    ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", "Team name already registered"));
                    return;
                }
                User u = UserQueries.loadUser(conn, full.getId());
                String email = body.get("contactEmail") != null ? String.valueOf(body.get("contactEmail")).trim() : u.getEmail();
                long regId = insertRegistration(conn, tid, teamName, email, u.getId());
                ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findRegistration(conn, regId));
                return;
            }
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
            return;
        }
        ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Not found"));
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
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
        Type mapType = new TypeToken<Map<String, Object>>() {}.getType();
        Map<String, Object> body = com.esukan.util.Jsons.gson().fromJson(ServletUtil.readBody(req), mapType);
        try (Connection conn = DBConnection.getConnection()) {
            UserPrincipal full = JwtHelper.enrich(auth, UserQueries.loadUser(conn, auth.getId()));
            Tournament t = findById(conn, id).orElse(null);
            if (t == null) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                return;
            }
            if (!canEdit(t, full)) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
                return;
            }
            String title = body.get("title") != null ? String.valueOf(body.get("title")) : t.getTitle();
            String desc = body.containsKey("description") ? (body.get("description") == null ? null : String.valueOf(body.get("description"))) : t.getDescription();
            LocalDate sd = body.get("startDate") != null ? LocalDate.parse(String.valueOf(body.get("startDate"))) : t.getStartDate();
            LocalDate ed = body.get("endDate") != null ? LocalDate.parse(String.valueOf(body.get("endDate"))) : t.getEndDate();
            Long venueId = body.containsKey("venueFacilityId")
                    ? (body.get("venueFacilityId") == null ? null : Long.parseLong(body.get("venueFacilityId").toString()))
                    : (t.getVenueFacility() != null ? t.getVenueFacility().getId() : null);
            Tournament.TournamentStatus st = body.get("status") != null
                    ? Tournament.TournamentStatus.valueOf(body.get("status").toString())
                    : t.getStatus();
            updateTournament(conn, id, title, desc, sd, ed, venueId, st);
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, findById(conn, id).orElseThrow());
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
            Tournament t = findById(conn, id).orElse(null);
            if (t == null) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of());
                return;
            }
            if (!canEdit(t, full)) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of());
                return;
            }
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM tournament_registrations WHERE tournament_id = ?")) {
                ps.setLong(1, id);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM tournaments WHERE id = ?")) {
                ps.setLong(1, id);
                ps.executeUpdate();
            }
            resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    private static List<Tournament> listVisible(Connection conn, UserPrincipal p) throws java.sql.SQLException {
        List<Tournament> all = listAll(conn);
        if (p.getRole() == UserRole.ADMIN) {
            return all;
        }
        if (p.getRole() == UserRole.LECTURER) {
            return all.stream()
                    .filter(t -> t.getOrganizer().getId().equals(p.getId())
                            || t.getStatus() != Tournament.TournamentStatus.DRAFT)
                    .collect(Collectors.toList());
        }
        return all.stream()
                .filter(t -> t.getStatus() != Tournament.TournamentStatus.DRAFT)
                .collect(Collectors.toList());
    }

    private static List<Tournament> listAll(Connection conn) throws java.sql.SQLException {
        String sql = T_JOIN + " ORDER BY t.id DESC";
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            List<Tournament> list = new ArrayList<>();
            while (rs.next()) {
                list.add(JdbcSupport.mapTournamentJoined(rs));
            }
            return list;
        }
    }

    private static Optional<Tournament> findById(Connection conn, long id) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(T_JOIN + " WHERE t.id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(JdbcSupport.mapTournamentJoined(rs));
            }
        }
    }

    private static boolean canView(Tournament t, UserPrincipal p) {
        if (p.getRole() == UserRole.ADMIN) {
            return true;
        }
        if (t.getOrganizer().getId().equals(p.getId())) {
            return true;
        }
        return t.getStatus() != Tournament.TournamentStatus.DRAFT;
    }

    private static boolean canEdit(Tournament t, UserPrincipal p) {
        return p.getRole() == UserRole.ADMIN || t.getOrganizer().getId().equals(p.getId());
    }

    private static long insertTournament(Connection conn, long organizerId, String title, String desc,
                                         LocalDate start, LocalDate end, Long venueId,
                                         Tournament.TournamentStatus status) throws java.sql.SQLException {
        String sql = """
                INSERT INTO tournaments (title, description, start_date, end_date, status, organizer_id, venue_facility_id)
                VALUES (?,?,?,?,?,?,?)
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, title);
            ps.setString(2, desc);
            ps.setObject(3, start);
            ps.setObject(4, end);
            ps.setString(5, status.name());
            ps.setLong(6, organizerId);
            if (venueId == null) {
                ps.setObject(7, null);
            } else {
                ps.setLong(7, venueId);
            }
            ps.executeUpdate();
            ResultSet k = ps.getGeneratedKeys();
            k.next();
            return k.getLong(1);
        }
    }

    private static void updateTournament(Connection conn, long id, String title, String desc,
                                         LocalDate start, LocalDate end, Long venueId,
                                         Tournament.TournamentStatus status) throws java.sql.SQLException {
        String sql = "UPDATE tournaments SET title=?, description=?, start_date=?, end_date=?, status=?, venue_facility_id=? WHERE id=?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, title);
            ps.setString(2, desc);
            ps.setObject(3, start);
            ps.setObject(4, end);
            ps.setString(5, status.name());
            if (venueId == null) {
                ps.setObject(6, null);
            } else {
                ps.setLong(6, venueId);
            }
            ps.setLong(7, id);
            ps.executeUpdate();
        }
    }

    private static boolean teamExists(Connection conn, long tournamentId, String teamName) throws java.sql.SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM tournament_registrations WHERE tournament_id = ? AND LOWER(team_name) = LOWER(?)")) {
            ps.setLong(1, tournamentId);
            ps.setString(2, teamName);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static long insertRegistration(Connection conn, long tournamentId, String teamName, String email, long userId)
            throws java.sql.SQLException {
        String sql = """
                INSERT INTO tournament_registrations (tournament_id, team_name, contact_email, registered_by_user_id)
                VALUES (?,?,?,?)
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, tournamentId);
            ps.setString(2, teamName);
            ps.setString(3, email);
            ps.setLong(4, userId);
            ps.executeUpdate();
            ResultSet k = ps.getGeneratedKeys();
            k.next();
            return k.getLong(1);
        }
    }

    private static TournamentRegistration findRegistration(Connection conn, long regId) throws java.sql.SQLException {
        String sql = """
                SELECT r.id as reg_id, r.team_name as reg_team_name, r.contact_email as reg_contact_email,
                r.created_at as reg_created_at,
                u.id as rb_id, u.username as rb_username, u.full_name as rb_full_name
                FROM tournament_registrations r JOIN users u ON r.registered_by_user_id = u.id
                WHERE r.id = ?
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, regId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new java.sql.SQLException("Registration not found");
                }
                return JdbcSupport.mapRegistrationJoined(rs);
            }
        }
    }

    private static List<TournamentRegistration> listRegs(Connection conn, long tournamentId)
            throws java.sql.SQLException {
        String sql = """
                SELECT r.id as reg_id, r.team_name as reg_team_name, r.contact_email as reg_contact_email,
                r.created_at as reg_created_at,
                u.id as rb_id, u.username as rb_username, u.full_name as rb_full_name
                FROM tournament_registrations r JOIN users u ON r.registered_by_user_id = u.id
                WHERE r.tournament_id = ? ORDER BY r.id
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, tournamentId);
            try (ResultSet rs = ps.executeQuery()) {
                List<TournamentRegistration> list = new ArrayList<>();
                while (rs.next()) {
                    list.add(JdbcSupport.mapRegistrationJoined(rs));
                }
                return list;
            }
        }
    }
}
