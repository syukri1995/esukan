package com.esukan.repository;

import com.esukan.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByStudentId(String studentId);

    List<Booking> findByFacilityId(Long facilityId);

    List<Booking> findByBookingDate(LocalDate date);

    List<Booking> findByStatus(Booking.BookingStatus status);

    @Query("SELECT b FROM Booking b WHERE b.facility.id = :facilityId AND b.bookingDate = :date AND b.status != 'CANCELLED'")
    List<Booking> findActiveBookingsByFacilityAndDate(@Param("facilityId") Long facilityId, @Param("date") LocalDate date);

    @Query("SELECT b.startTime, COUNT(b) FROM Booking b WHERE b.facility.id = :facilityId AND b.status = 'CONFIRMED' GROUP BY b.startTime ORDER BY COUNT(b) DESC")
    List<Object[]> findPeakHoursByFacility(@Param("facilityId") Long facilityId);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.status = 'PENDING'")
    Long countPendingBookings();

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.bookingDate = :date")
    Long countBookingsByDate(@Param("date") LocalDate date);

    @Query("SELECT b.facility.type, COUNT(b) FROM Booking b GROUP BY b.facility.type")
    List<Object[]> countBookingsByFacilityType();

    // Check for time slot conflicts
    @Query("SELECT b FROM Booking b WHERE b.facility.id = :facilityId AND b.bookingDate = :date " +
           "AND b.status != 'CANCELLED' " +
           "AND ((b.startTime <= :startTime AND b.endTime > :startTime) " +
           "OR (b.startTime < :endTime AND b.endTime >= :endTime) " +
           "OR (b.startTime >= :startTime AND b.endTime <= :endTime))")
    List<Booking> findConflictingBookings(
        @Param("facilityId") Long facilityId,
        @Param("date") LocalDate date,
        @Param("startTime") java.time.LocalTime startTime,
        @Param("endTime") java.time.LocalTime endTime
    );
}
