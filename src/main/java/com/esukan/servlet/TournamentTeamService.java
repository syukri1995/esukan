package com.esukan.servlet;

import com.esukan.model.Tournament;
import com.esukan.model.TournamentMatch;
import com.esukan.model.TournamentRegistration;
import com.esukan.model.TournamentTeamMember;
import com.esukan.model.User;
import com.esukan.model.UserRole;
import com.esukan.security.UserPrincipal;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class TournamentTeamService {

    private TournamentTeamService() {}

    public static void requireStudent(UserPrincipal p) {
        if (p.getRole() != UserRole.STUDENT) {
            throw new RuntimeException("Only students may register teams for matches");
        }
    }

    public static List<TournamentRegistration> listMyTeams(Connection conn, long tournamentId, long userId)
            throws Exception {
        String sql = """
                SELECT r.id as reg_id, r.team_name as reg_team_name, r.contact_email as reg_contact_email,
                r.created_at as reg_created_at,
                u.id as rb_id, u.username as rb_username, u.full_name as rb_full_name
                FROM tournament_registrations r
                JOIN users u ON r.registered_by_user_id = u.id
                WHERE r.tournament_id = ? AND r.registered_by_user_id = ?
                ORDER BY r.id
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, tournamentId);
            ps.setLong(2, userId);
            try (ResultSet rs = ps.executeQuery()) {
                List<TournamentRegistration> list = new ArrayList<>();
                while (rs.next()) {
                    TournamentRegistration reg = JdbcSupport.mapRegistrationJoined(rs);
                    reg.setMembers(loadMembers(conn, reg.getId()));
                    list.add(reg);
                }
                return list;
            }
        }
    }

    public static List<TournamentTeamMember> loadMembers(Connection conn, long registrationId) throws Exception {
        String sql = "SELECT id, registration_id, display_name, email, created_at FROM tournament_team_members "
                + "WHERE registration_id = ? ORDER BY id";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, registrationId);
            try (ResultSet rs = ps.executeQuery()) {
                List<TournamentTeamMember> list = new ArrayList<>();
                while (rs.next()) {
                    list.add(mapMember(rs));
                }
                return list;
            }
        }
    }

    public static int countMembers(Connection conn, long registrationId) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COUNT(*) FROM tournament_team_members WHERE registration_id = ?")) {
            ps.setLong(1, registrationId);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getInt(1);
            }
        }
    }

    public static void replaceMembers(Connection conn, long registrationId, List<TournamentTeamMember> members)
            throws Exception {
        try (PreparedStatement del = conn.prepareStatement(
                "DELETE FROM tournament_team_members WHERE registration_id = ?")) {
            del.setLong(1, registrationId);
            del.executeUpdate();
        }
        insertMembers(conn, registrationId, members);
    }

    public static void insertMembers(Connection conn, long registrationId, List<TournamentTeamMember> members)
            throws Exception {
        if (members == null || members.isEmpty()) {
            return;
        }
        String sql = "INSERT INTO tournament_team_members (registration_id, display_name, email) VALUES (?,?,?)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            for (TournamentTeamMember m : members) {
                if (m.getDisplayName() == null || m.getDisplayName().isBlank()) {
                    continue;
                }
                ps.setLong(1, registrationId);
                ps.setString(2, m.getDisplayName().trim());
                String email = m.getEmail();
                if (email == null || email.isBlank()) {
                    ps.setNull(3, Types.VARCHAR);
                } else {
                    ps.setString(3, email.trim());
                }
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    public static long createRegistration(Connection conn, long tournamentId, String teamName, String contactEmail,
            long captainUserId, List<TournamentTeamMember> members) throws Exception {
        String sql = """
                INSERT INTO tournament_registrations (tournament_id, team_name, contact_email, registered_by_user_id)
                VALUES (?,?,?,?)
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, tournamentId);
            ps.setString(2, teamName);
            ps.setString(3, contactEmail);
            ps.setLong(4, captainUserId);
            ps.executeUpdate();
            ResultSet k = ps.getGeneratedKeys();
            k.next();
            long regId = k.getLong(1);
            List<TournamentTeamMember> all = new ArrayList<>(members != null ? members : List.of());
            insertMembers(conn, regId, all);
            return regId;
        }
    }

    public static boolean isCaptain(Connection conn, long registrationId, long userId) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM tournament_registrations WHERE id = ? AND registered_by_user_id = ?")) {
            ps.setLong(1, registrationId);
            ps.setLong(2, userId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public static boolean teamExists(Connection conn, long tournamentId, String teamName) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM tournament_registrations WHERE tournament_id = ? AND LOWER(team_name) = LOWER(?)")) {
            ps.setLong(1, tournamentId);
            ps.setString(2, teamName);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public static Map<String, Object> registerForMatchSlot(Connection conn, long tournamentId, long matchId,
            long userId, String slot, String mode, Long registrationId, String teamName, String contactEmail,
            List<TournamentTeamMember> members) throws Exception {
        Tournament t = findTournamentStatus(conn, tournamentId);
        if (t.getStatus() != Tournament.TournamentStatus.OPEN) {
            throw new RuntimeException("Tournament is not open for registration");
        }
        TournamentMatch match = findMatch(conn, matchId);
        if (!match.getTournamentId().equals(tournamentId)) {
            throw new RuntimeException("Match does not belong to this tournament");
        }
        String slotNorm = normalizeSlot(slot);
        if ("A".equals(slotNorm)) {
            if (match.getTeamARegistrationId() != null) {
                throw new RuntimeException("Team A slot is already filled");
            }
        } else {
            if (match.getTeamBRegistrationId() != null) {
                throw new RuntimeException("Team B slot is already filled");
            }
        }

        long regId;
        if ("existing".equalsIgnoreCase(mode)) {
            if (registrationId == null) {
                throw new RuntimeException("registrationId is required for existing team");
            }
            if (!isCaptain(conn, registrationId, userId)) {
                throw new RuntimeException("You may only use teams you created");
            }
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT 1 FROM tournament_registrations WHERE id = ? AND tournament_id = ?")) {
                ps.setLong(1, registrationId);
                ps.setLong(2, tournamentId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        throw new RuntimeException("Team not found in this tournament");
                    }
                }
            }
            regId = registrationId;
        } else if ("new".equalsIgnoreCase(mode)) {
            if (teamName == null || teamName.isBlank()) {
                throw new RuntimeException("Team name is required");
            }
            if (teamExists(conn, tournamentId, teamName)) {
                throw new RuntimeException("Team name already registered in this tournament");
            }
            User u = UserQueries.loadUser(conn, userId);
            String email = contactEmail != null && !contactEmail.isBlank() ? contactEmail.trim() : u.getEmail();
            List<TournamentTeamMember> roster = members != null && !members.isEmpty()
                    ? members : parseMembersFromBody(null, u);
            regId = createRegistration(conn, tournamentId, teamName.trim(), email, userId, roster);
        } else {
            throw new RuntimeException("mode must be 'existing' or 'new'");
        }

        assignSlot(conn, matchId, slotNorm, regId);
        return TournamentBracketService.getBracketPayload(conn, tournamentId);
    }

    private static List<TournamentTeamMember> parseMembers(List<TournamentTeamMember> members, User captain) {
        List<TournamentTeamMember> roster = new ArrayList<>();
        boolean hasCaptain = false;
        if (members != null) {
            for (TournamentTeamMember m : members) {
                if (m.getDisplayName() != null && !m.getDisplayName().isBlank()) {
                    roster.add(m);
                    if (captain.getFullName() != null
                            && captain.getFullName().equalsIgnoreCase(m.getDisplayName().trim())) {
                        hasCaptain = true;
                    }
                }
            }
        }
        if (!hasCaptain && captain.getFullName() != null && !captain.getFullName().isBlank()) {
            TournamentTeamMember cap = new TournamentTeamMember();
            cap.setDisplayName(captain.getFullName());
            cap.setEmail(captain.getEmail());
            roster.add(0, cap);
        }
        if (roster.isEmpty()) {
            throw new RuntimeException("Add at least one team member");
        }
        return roster;
    }

    @SuppressWarnings("unchecked")
    public static List<TournamentTeamMember> parseMembersFromBody(List<Map<String, Object>> raw, User captain) {
        List<TournamentTeamMember> list = new ArrayList<>();
        if (raw != null) {
            for (Map<String, Object> row : raw) {
                TournamentTeamMember m = new TournamentTeamMember();
                Object name = row.get("displayName");
                if (name == null) {
                    name = row.get("name");
                }
                if (name == null) {
                    continue;
                }
                m.setDisplayName(String.valueOf(name).trim());
                Object email = row.get("email");
                if (email != null && !String.valueOf(email).isBlank()) {
                    m.setEmail(String.valueOf(email).trim());
                }
                list.add(m);
            }
        }
        return parseMembers(list, captain);
    }

    private static void assignSlot(Connection conn, long matchId, String slot, long regId) throws Exception {
        if ("A".equals(slot)) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE tournament_matches SET team_a_registration_id=? WHERE id=?")) {
                ps.setLong(1, regId);
                ps.setLong(2, matchId);
                ps.executeUpdate();
            }
        } else {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE tournament_matches SET team_b_registration_id=? WHERE id=?")) {
                ps.setLong(1, regId);
                ps.setLong(2, matchId);
                ps.executeUpdate();
            }
        }
    }

    private static String normalizeSlot(String slot) {
        if (slot == null) {
            throw new RuntimeException("slot is required (A or B)");
        }
        String s = slot.trim().toUpperCase();
        if (!"A".equals(s) && !"B".equals(s)) {
            throw new RuntimeException("slot must be A or B");
        }
        return s;
    }

    private static Tournament findTournamentStatus(Connection conn, long id) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("SELECT status FROM tournaments WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new RuntimeException("Tournament not found");
                }
                Tournament t = new Tournament();
                t.setId(id);
                t.setStatus(Tournament.TournamentStatus.valueOf(rs.getString("status").trim()));
                return t;
            }
        }
    }

    private static TournamentMatch findMatch(Connection conn, long matchId) throws Exception {
        return TournamentBracketService.findMatchPublic(conn, matchId)
                .orElseThrow(() -> new RuntimeException("Match not found"));
    }

    private static TournamentTeamMember mapMember(ResultSet rs) throws Exception {
        TournamentTeamMember m = new TournamentTeamMember();
        m.setId(rs.getLong("id"));
        m.setRegistrationId(rs.getLong("registration_id"));
        m.setDisplayName(rs.getString("display_name"));
        m.setEmail(rs.getString("email"));
        m.setCreatedAt(JdbcSupport.ts(rs.getTimestamp("created_at")));
        return m;
    }
}
