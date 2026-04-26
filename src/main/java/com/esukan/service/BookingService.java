package com.esukan.service;

import com.esukan.model.Booking;
import com.esukan.model.Facility;
import com.esukan.repository.BookingRepository;
import com.esukan.repository.FacilityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.LinkedHashMap;

@Service
public class BookingService {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private FacilityRepository facilityRepository;

    public List<Booking> getAllBookings() {
        return bookingRepository.findAll();
    }

    public Optional<Booking> getBookingById(Long id) {
        return bookingRepository.findById(id);
    }

    public List<Booking> getBookingsByStudent(String studentId) {
        return bookingRepository.findByStudentId(studentId);
    }

    public List<Booking> getBookingsByDate(LocalDate date) {
        return bookingRepository.findByBookingDate(date);
    }

    public List<Booking> getBookingsByStatus(Booking.BookingStatus status) {
        return bookingRepository.findByStatus(status);
    }

    public Booking createBooking(Booking booking) {
        // For time clash
        List<Booking> conflicts = bookingRepository.findConflictingBookings(
            booking.getFacility().getId(),
            booking.getBookingDate(),
            booking.getStartTime(),
            booking.getEndTime()
        );
        if (!conflicts.isEmpty()) {
            throw new RuntimeException("Time slot conflict: This facility is already booked for the selected time.");
        }
        return bookingRepository.save(booking);
    }

    public Booking updateBookingStatus(Long id, Booking.BookingStatus status) {
        Booking booking = bookingRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Booking not found: " + id));
        booking.setStatus(status);
        return bookingRepository.save(booking);
    }

    public Booking updateBooking(Long id, Booking updated) {
        Booking booking = bookingRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Booking not found: " + id));
        booking.setStudentName(updated.getStudentName());
        booking.setStudentId(updated.getStudentId());
        booking.setStudentEmail(updated.getStudentEmail());
        booking.setFacility(updated.getFacility());
        booking.setBookingDate(updated.getBookingDate());
        booking.setStartTime(updated.getStartTime());
        booking.setEndTime(updated.getEndTime());
        booking.setNotes(updated.getNotes());
        return bookingRepository.save(booking);
    }

    public void deleteBooking(Long id) {
        bookingRepository.deleteById(id);
    }

    // Dashboard: peak usage hours per facility
    public Map<String, Long> getPeakHours(Long facilityId) {
        List<Object[]> results = bookingRepository.findPeakHoursByFacility(facilityId);
        Map<String, Long> peakHours = new LinkedHashMap<>();
        for (Object[] row : results) {
            peakHours.put(row[0].toString(), (Long) row[1]);
        }
        return peakHours;
    }

    // Dashboard stats
    public Map<String, Object> getDashboardStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalBookings", bookingRepository.count());
        stats.put("pendingBookings", bookingRepository.countPendingBookings());
        stats.put("todayBookings", bookingRepository.countBookingsByDate(LocalDate.now()));

        List<Object[]> byType = bookingRepository.countBookingsByFacilityType();
        Map<String, Long> facilityTypeStats = new LinkedHashMap<>();
        for (Object[] row : byType) {
            facilityTypeStats.put(row[0].toString(), (Long) row[1]);
        }
        stats.put("bookingsByFacilityType", facilityTypeStats);
        return stats;
    }
}
