package com.esukan.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class TournamentRegistration {

    private Long id;
    private Tournament tournament;
    private String teamName;
    private String contactEmail;
    private User registeredBy;
    private List<TournamentTeamMember> members = new ArrayList<>();
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Tournament getTournament() {
        return tournament;
    }

    public void setTournament(Tournament tournament) {
        this.tournament = tournament;
    }

    public String getTeamName() {
        return teamName;
    }

    public void setTeamName(String teamName) {
        this.teamName = teamName;
    }

    public String getContactEmail() {
        return contactEmail;
    }

    public void setContactEmail(String contactEmail) {
        this.contactEmail = contactEmail;
    }

    public User getRegisteredBy() {
        return registeredBy;
    }

    public void setRegisteredBy(User registeredBy) {
        this.registeredBy = registeredBy;
    }

    public List<TournamentTeamMember> getMembers() {
        return members;
    }

    public void setMembers(List<TournamentTeamMember> members) {
        this.members = members != null ? members : new ArrayList<>();
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
