package com.esukan.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class Tournament {

    public enum TournamentStatus {
        DRAFT, OPEN, CLOSED, COMPLETED
    }

    public enum TournamentFormat {
        SINGLE_ELIMINATION, ROUND_ROBIN
    }

    private Long id;
    private String title;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private TournamentStatus status = TournamentStatus.DRAFT;
    private TournamentFormat format = TournamentFormat.SINGLE_ELIMINATION;
    private User organizer;
    private Facility venueFacility;
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public TournamentStatus getStatus() {
        return status;
    }

    public void setStatus(TournamentStatus status) {
        this.status = status;
    }

    public TournamentFormat getFormat() {
        return format;
    }

    public void setFormat(TournamentFormat format) {
        this.format = format;
    }

    public User getOrganizer() {
        return organizer;
    }

    public void setOrganizer(User organizer) {
        this.organizer = organizer;
    }

    public Facility getVenueFacility() {
        return venueFacility;
    }

    public void setVenueFacility(Facility venueFacility) {
        this.venueFacility = venueFacility;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
