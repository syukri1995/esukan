package com.esukan.servlet;

import com.esukan.model.Tournament;
import com.esukan.model.TournamentMatch;
import com.esukan.model.TournamentRegistration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class TournamentBracketService {

    private TournamentBracketService() {}

    public static Optional<TournamentMatch> findMatchPublic(Connection conn, long id) throws Exception {
        return findMatch(conn, id);
    }

    public static Map<String, Object> getBracketPayload(Connection conn, long tournamentId) throws Exception {
        SchemaMigration.ensureTournamentTeamMembersTable(conn);
        Tournament t = findTournament(conn, tournamentId).orElseThrow(() -> new RuntimeException("Tournament not found"));
        Map<String, Object> payload = new HashMap<>();
        payload.put("format", t.getFormat().name());
        payload.put("status", t.getStatus().name());
        List<TournamentRegistration> regs = listRegsWithMembers(conn, tournamentId);
        payload.put("registrations", regs);
        List<TournamentMatch> matches = listMatches(conn, tournamentId);
        for (TournamentMatch m : matches) {
            m.setSlotAOpen(m.getTeamARegistrationId() == null);
            m.setSlotBOpen(m.getTeamBRegistrationId() == null);
            if (m.getTeamARegistrationId() != null) {
                m.setTeamAMemberCount(TournamentTeamService.countMembers(conn, m.getTeamARegistrationId()));
            }
            if (m.getTeamBRegistrationId() != null) {
                m.setTeamBMemberCount(TournamentTeamService.countMembers(conn, m.getTeamBRegistrationId()));
            }
        }
        payload.put("matches", matches);
        return payload;
    }

    public static void generateBracket(Connection conn, long tournamentId) throws Exception {
        Tournament t = findTournament(conn, tournamentId).orElseThrow(() -> new RuntimeException("Tournament not found"));
        if (t.getStatus() == Tournament.TournamentStatus.COMPLETED) {
            throw new RuntimeException("Cannot regenerate bracket for completed tournament");
        }
        List<TournamentRegistration> regs = listRegs(conn, tournamentId);
        try (PreparedStatement del = conn.prepareStatement("DELETE FROM tournament_matches WHERE tournament_id = ?")) {
            del.setLong(1, tournamentId);
            del.executeUpdate();
        }
        if (t.getFormat() == Tournament.TournamentFormat.ROUND_ROBIN) {
            generateRoundRobin(conn, tournamentId, regs);
        } else {
            generateSingleElimination(conn, tournamentId, regs);
        }
    }

    public static void recordWinner(Connection conn, long tournamentId, long matchId, long winnerRegistrationId)
            throws Exception {
        Tournament t = findTournament(conn, tournamentId).orElseThrow(() -> new RuntimeException("Tournament not found"));
        TournamentMatch match = findMatch(conn, matchId).orElseThrow(() -> new RuntimeException("Match not found"));
        if (!match.getTournamentId().equals(tournamentId)) {
            throw new RuntimeException("Match does not belong to tournament");
        }
        if (winnerRegistrationId != match.getTeamARegistrationId()
                && winnerRegistrationId != match.getTeamBRegistrationId()) {
            throw new RuntimeException("Winner must be one of the teams in this match");
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE tournament_matches SET winner_registration_id=?, status='COMPLETED' WHERE id=?")) {
            ps.setLong(1, winnerRegistrationId);
            ps.setLong(2, matchId);
            ps.executeUpdate();
        }
        if (t.getFormat() != Tournament.TournamentFormat.SINGLE_ELIMINATION || match.getNextMatchId() == null) {
            return;
        }
        String slot = match.getNextMatchSlot();
        if (slot == null) {
            return;
        }
        if ("A".equals(slot)) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE tournament_matches SET team_a_registration_id=? WHERE id=?")) {
                ps.setLong(1, winnerRegistrationId);
                ps.setLong(2, match.getNextMatchId());
                ps.executeUpdate();
            }
        } else {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE tournament_matches SET team_b_registration_id=? WHERE id=?")) {
                ps.setLong(1, winnerRegistrationId);
                ps.setLong(2, match.getNextMatchId());
                ps.executeUpdate();
            }
        }
    }

    private static void generateRoundRobin(Connection conn, long tournamentId, List<TournamentRegistration> regs)
            throws Exception {
        int idx = 0;
        for (int i = 0; i < regs.size(); i++) {
            for (int j = i + 1; j < regs.size(); j++) {
                insertMatch(conn, tournamentId, 1, idx++, "RR" + (idx),
                        regs.get(i).getId(), regs.get(j).getId(), null, null, null,
                        TournamentMatch.MatchStatus.SCHEDULED);
            }
        }
    }

    private static void generateSingleElimination(Connection conn, long tournamentId,
            List<TournamentRegistration> regs) throws Exception {
        List<Long> slots = new ArrayList<>();
        for (TournamentRegistration r : regs) {
            slots.add(r.getId());
        }
        Collections.shuffle(slots);
        int bracketSize = nextPowerOfTwo(slots.size());
        while (slots.size() < bracketSize) {
            slots.add(null);
        }
        int rounds = (int) (Math.log(bracketSize) / Math.log(2));
        long[][] ids = new long[rounds + 1][];
        for (int round = 1; round <= rounds; round++) {
            int matchCount = bracketSize / (1 << round);
            ids[round] = new long[matchCount];
            for (int i = 0; i < matchCount; i++) {
                String label = "R" + round + "-M" + (i + 1);
                ids[round][i] = insertMatch(conn, tournamentId, round, i, label,
                        null, null, null, null, null, TournamentMatch.MatchStatus.SCHEDULED);
            }
        }
        for (int round = 1; round < rounds; round++) {
            int matchCount = bracketSize / (1 << round);
            for (int i = 0; i < matchCount; i++) {
                int nextIdx = i / 2;
                String slot = (i % 2 == 0) ? "A" : "B";
                try (PreparedStatement ps = conn.prepareStatement(
                        "UPDATE tournament_matches SET next_match_id=?, next_match_slot=? WHERE id=?")) {
                    ps.setLong(1, ids[round + 1][nextIdx]);
                    ps.setString(2, slot);
                    ps.setLong(3, ids[round][i]);
                    ps.executeUpdate();
                }
            }
        }
        for (int i = 0; i < bracketSize / 2; i++) {
            Long teamA = slots.get(2 * i);
            Long teamB = slots.get(2 * i + 1);
            Long winner = null;
            TournamentMatch.MatchStatus st = TournamentMatch.MatchStatus.SCHEDULED;
            if (teamA != null && teamB == null) {
                winner = teamA;
                st = TournamentMatch.MatchStatus.COMPLETED;
            } else if (teamA == null && teamB != null) {
                winner = teamB;
                st = TournamentMatch.MatchStatus.COMPLETED;
            }
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE tournament_matches SET team_a_registration_id=?, team_b_registration_id=?, "
                            + "winner_registration_id=?, status=? WHERE id=?")) {
                if (teamA != null) {
                    ps.setLong(1, teamA);
                } else {
                    ps.setNull(1, Types.BIGINT);
                }
                if (teamB != null) {
                    ps.setLong(2, teamB);
                } else {
                    ps.setNull(2, Types.BIGINT);
                }
                if (winner != null) {
                    ps.setLong(3, winner);
                } else {
                    ps.setNull(3, Types.BIGINT);
                }
                ps.setString(4, st.name());
                ps.setLong(5, ids[1][i]);
                ps.executeUpdate();
            }
            if (winner != null) {
                propagateByeWinner(conn, ids[1][i], winner);
            }
        }
    }

    private static void propagateByeWinner(Connection conn, long matchId, long winnerId) throws Exception {
        TournamentMatch m = findMatch(conn, matchId).orElseThrow();
        if (m.getNextMatchId() == null) {
            return;
        }
        if ("A".equals(m.getNextMatchSlot())) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE tournament_matches SET team_a_registration_id=? WHERE id=?")) {
                ps.setLong(1, winnerId);
                ps.setLong(2, m.getNextMatchId());
                ps.executeUpdate();
            }
        } else {
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE tournament_matches SET team_b_registration_id=? WHERE id=?")) {
                ps.setLong(1, winnerId);
                ps.setLong(2, m.getNextMatchId());
                ps.executeUpdate();
            }
        }
    }

    private static long insertMatch(Connection conn, long tournamentId, int round, int matchIndex, String label,
            Long teamA, Long teamB, Long winner, Long nextId, String nextSlot,
            TournamentMatch.MatchStatus status) throws Exception {
        String sql = """
                INSERT INTO tournament_matches (tournament_id, round_number, match_index, slot_label,
                team_a_registration_id, team_b_registration_id, winner_registration_id, status, next_match_id, next_match_slot)
                VALUES (?,?,?,?,?,?,?,?,?,?)
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql, PreparedStatement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, tournamentId);
            ps.setInt(2, round);
            ps.setInt(3, matchIndex);
            ps.setString(4, label);
            setLong(ps, 5, teamA);
            setLong(ps, 6, teamB);
            setLong(ps, 7, winner);
            ps.setString(8, status.name());
            setLong(ps, 9, nextId);
            ps.setString(10, nextSlot);
            ps.executeUpdate();
            ResultSet k = ps.getGeneratedKeys();
            k.next();
            return k.getLong(1);
        }
    }

    private static void setLong(PreparedStatement ps, int idx, Long val) throws Exception {
        if (val == null) {
            ps.setNull(idx, Types.BIGINT);
        } else {
            ps.setLong(idx, val);
        }
    }

    private static int nextPowerOfTwo(int n) {
        int p = 1;
        while (p < n) {
            p <<= 1;
        }
        return p;
    }

    private static List<TournamentMatch> listMatches(Connection conn, long tournamentId) throws Exception {
        String sql = """
                SELECT m.*, ta.team_name as team_a_name, tb.team_name as team_b_name, tw.team_name as winner_name
                FROM tournament_matches m
                LEFT JOIN tournament_registrations ta ON m.team_a_registration_id = ta.id
                LEFT JOIN tournament_registrations tb ON m.team_b_registration_id = tb.id
                LEFT JOIN tournament_registrations tw ON m.winner_registration_id = tw.id
                WHERE m.tournament_id = ? ORDER BY m.round_number, m.match_index
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, tournamentId);
            try (ResultSet rs = ps.executeQuery()) {
                List<TournamentMatch> list = new ArrayList<>();
                while (rs.next()) {
                    list.add(JdbcSupport.mapTournamentMatch(rs));
                }
                return list;
            }
        }
    }

    private static Optional<TournamentMatch> findMatch(Connection conn, long id) throws Exception {
        String sql = """
                SELECT m.*, ta.team_name as team_a_name, tb.team_name as team_b_name, tw.team_name as winner_name
                FROM tournament_matches m
                LEFT JOIN tournament_registrations ta ON m.team_a_registration_id = ta.id
                LEFT JOIN tournament_registrations tb ON m.team_b_registration_id = tb.id
                LEFT JOIN tournament_registrations tw ON m.winner_registration_id = tw.id
                WHERE m.id = ?
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(JdbcSupport.mapTournamentMatch(rs));
            }
        }
    }

    private static Optional<Tournament> findTournament(Connection conn, long id) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT format, status FROM tournaments WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                Tournament t = new Tournament();
                t.setId(id);
                String fmt = rs.getString("format");
                t.setFormat(fmt != null ? Tournament.TournamentFormat.valueOf(fmt.trim())
                        : Tournament.TournamentFormat.SINGLE_ELIMINATION);
                t.setStatus(Tournament.TournamentStatus.valueOf(rs.getString("status").trim()));
                return Optional.of(t);
            }
        }
    }

    private static List<TournamentRegistration> listRegs(Connection conn, long tournamentId) throws Exception {
        return listRegsWithMembers(conn, tournamentId, false);
    }

    private static List<TournamentRegistration> listRegsWithMembers(Connection conn, long tournamentId)
            throws Exception {
        return listRegsWithMembers(conn, tournamentId, true);
    }

    private static List<TournamentRegistration> listRegsWithMembers(Connection conn, long tournamentId,
            boolean withMembers) throws Exception {
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
                    TournamentRegistration reg = JdbcSupport.mapRegistrationJoined(rs);
                    if (withMembers) {
                        reg.setMembers(TournamentTeamService.loadMembers(conn, reg.getId()));
                    }
                    list.add(reg);
                }
                return list;
            }
        }
    }
}
