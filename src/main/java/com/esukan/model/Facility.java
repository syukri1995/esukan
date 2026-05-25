package com.esukan.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

public class Facility {

    public enum FacilityType {
        BADMINTON, FUTSAL
    }

    private Long id;
    private String name;
    private FacilityType type;
    private String description;
    private Boolean isActive = true;
    private LocalTime openTime;
    private LocalTime closeTime;
    private BigDecimal costPerHour = BigDecimal.ZERO;
    private LocalTime effectiveOpenTime;
    private LocalTime effectiveCloseTime;
    private List<Long> equipmentIds = new ArrayList<>();
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public FacilityType getType() {
        return type;
    }

    public void setType(FacilityType type) {
        this.type = type;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean active) {
        isActive = active;
    }

    public LocalTime getOpenTime() {
        return openTime;
    }

    public void setOpenTime(LocalTime openTime) {
        this.openTime = openTime;
    }

    public LocalTime getCloseTime() {
        return closeTime;
    }

    public void setCloseTime(LocalTime closeTime) {
        this.closeTime = closeTime;
    }

    public BigDecimal getCostPerHour() {
        return costPerHour;
    }

    public void setCostPerHour(BigDecimal costPerHour) {
        this.costPerHour = costPerHour;
    }

    public LocalTime getEffectiveOpenTime() {
        return effectiveOpenTime;
    }

    public void setEffectiveOpenTime(LocalTime effectiveOpenTime) {
        this.effectiveOpenTime = effectiveOpenTime;
    }

    public LocalTime getEffectiveCloseTime() {
        return effectiveCloseTime;
    }

    public void setEffectiveCloseTime(LocalTime effectiveCloseTime) {
        this.effectiveCloseTime = effectiveCloseTime;
    }

    public List<Long> getEquipmentIds() {
        return equipmentIds;
    }

    public void setEquipmentIds(List<Long> equipmentIds) {
        this.equipmentIds = equipmentIds != null ? equipmentIds : new ArrayList<>();
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
