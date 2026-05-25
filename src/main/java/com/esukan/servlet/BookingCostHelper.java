package com.esukan.servlet;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalTime;

public final class BookingCostHelper {

    private BookingCostHelper() {}

    public static BigDecimal computeHourlyCost(LocalTime start, LocalTime end, BigDecimal costPerHour) {
        if (start == null || end == null || !start.isBefore(end)) {
            return BigDecimal.ZERO;
        }
        BigDecimal rate = costPerHour != null ? costPerHour : BigDecimal.ZERO;
        if (rate.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        long minutes = Duration.between(start, end).toMinutes();
        if (minutes <= 0) {
            return BigDecimal.ZERO;
        }
        double hours = minutes / 60.0;
        return rate.multiply(BigDecimal.valueOf(hours)).setScale(2, RoundingMode.HALF_UP);
    }
}
