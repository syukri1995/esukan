package com.esukan.model;

import java.time.LocalDateTime;

public class TournamentMatch {

    public enum MatchStatus {
        SCHEDULED, COMPLETED
    }

    private Long id;
    private Long tournamentId;
    private int roundNumber;
    private int matchIndex;
    private String slotLabel;
    private Long teamARegistrationId;
    private Long teamBRegistrationId;
    private Long winnerRegistrationId;
    private String teamAName;
    private String teamBName;
    private String winnerName;
    private MatchStatus status = MatchStatus.SCHEDULED;
    private Long nextMatchId;
    private String nextMatchSlot;
    private boolean slotAOpen;
    private boolean slotBOpen;
    private int teamAMemberCount;
    private int teamBMemberCount;
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getTournamentId() {
        return tournamentId;
    }

    public void setTournamentId(Long tournamentId) {
        this.tournamentId = tournamentId;
    }

    public int getRoundNumber() {
        return roundNumber;
    }

    public void setRoundNumber(int roundNumber) {
        this.roundNumber = roundNumber;
    }

    public int getMatchIndex() {
        return matchIndex;
    }

    public void setMatchIndex(int matchIndex) {
        this.matchIndex = matchIndex;
    }

    public String getSlotLabel() {
        return slotLabel;
    }

    public void setSlotLabel(String slotLabel) {
        this.slotLabel = slotLabel;
    }

    public Long getTeamARegistrationId() {
        return teamARegistrationId;
    }

    public void setTeamARegistrationId(Long teamARegistrationId) {
        this.teamARegistrationId = teamARegistrationId;
    }

    public Long getTeamBRegistrationId() {
        return teamBRegistrationId;
    }

    public void setTeamBRegistrationId(Long teamBRegistrationId) {
        this.teamBRegistrationId = teamBRegistrationId;
    }

    public Long getWinnerRegistrationId() {
        return winnerRegistrationId;
    }

    public void setWinnerRegistrationId(Long winnerRegistrationId) {
        this.winnerRegistrationId = winnerRegistrationId;
    }

    public String getTeamAName() {
        return teamAName;
    }

    public void setTeamAName(String teamAName) {
        this.teamAName = teamAName;
    }

    public String getTeamBName() {
        return teamBName;
    }

    public void setTeamBName(String teamBName) {
        this.teamBName = teamBName;
    }

    public String getWinnerName() {
        return winnerName;
    }

    public void setWinnerName(String winnerName) {
        this.winnerName = winnerName;
    }

    public MatchStatus getStatus() {
        return status;
    }

    public void setStatus(MatchStatus status) {
        this.status = status;
    }

    public Long getNextMatchId() {
        return nextMatchId;
    }

    public void setNextMatchId(Long nextMatchId) {
        this.nextMatchId = nextMatchId;
    }

    public String getNextMatchSlot() {
        return nextMatchSlot;
    }

    public void setNextMatchSlot(String nextMatchSlot) {
        this.nextMatchSlot = nextMatchSlot;
    }

    public boolean isSlotAOpen() {
        return slotAOpen;
    }

    public void setSlotAOpen(boolean slotAOpen) {
        this.slotAOpen = slotAOpen;
    }

    public boolean isSlotBOpen() {
        return slotBOpen;
    }

    public void setSlotBOpen(boolean slotBOpen) {
        this.slotBOpen = slotBOpen;
    }

    public int getTeamAMemberCount() {
        return teamAMemberCount;
    }

    public void setTeamAMemberCount(int teamAMemberCount) {
        this.teamAMemberCount = teamAMemberCount;
    }

    public int getTeamBMemberCount() {
        return teamBMemberCount;
    }

    public void setTeamBMemberCount(int teamBMemberCount) {
        this.teamBMemberCount = teamBMemberCount;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
