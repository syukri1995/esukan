package com.esukan.controller;

import com.esukan.model.Booking;
import com.esukan.model.Facility;
import com.esukan.repository.FacilityRepository;
import com.esukan.service.BookingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bookings")
@CrossOrigin(origins = "*")
public class BookingController {

    @Autowired
    private BookingService bookingService;

    @Autowired
    private FacilityRepository facilityRepository;

    @GetMapping
    public List<Booking> getAllBookings() {
        return bookingService.getAllBookings();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Booking> getBookingById(@PathVariable Long id) {
        return bookingService.getBookingById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/student/{studentId}")
    public List<Booking> getBookingsByStudent(@PathVariable String studentId) {
        return bookingService.getBookingsByStudent(studentId);
    }

    @GetMapping("/date/{date}")
    public List<Booking> getBookingsByDate(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return bookingService.getBookingsByDate(date);
    }

    @GetMapping("/status/{status}")
    public List<Booking> getBookingsByStatus(@PathVariable Booking.BookingStatus status) {
        return bookingService.getBookingsByStatus(status);
    }

    @PostMapping
    public ResponseEntity<?> createBooking(@RequestBody Map<String, Object> payload) {
        try {
            Booking booking = new Booking();
            booking.setStudentName((String) payload.get("studentName"));
            booking.setStudentId((String) payload.get("studentId"));
            booking.setStudentEmail((String) payload.get("studentEmail"));
            booking.setNotes((String) payload.get("notes"));
            booking.setBookingDate(LocalDate.parse((String) payload.get("bookingDate")));
            booking.setStartTime(java.time.LocalTime.parse((String) payload.get("startTime")));
            booking.setEndTime(java.time.LocalTime.parse((String) payload.get("endTime")));

            Long facilityId = Long.parseLong(payload.get("facilityId").toString());
            Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new RuntimeException("Facility not found"));
            booking.setFacility(facility);

            return ResponseEntity.ok(bookingService.createBooking(booking));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable Long id,
            @RequestParam Booking.BookingStatus status) {
        try {
            return ResponseEntity.ok(bookingService.updateBookingStatus(id, status));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBooking(@PathVariable Long id) {
        bookingService.deleteBooking(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/dashboard")
    public Map<String, Object> getDashboardStats() {
        return bookingService.getDashboardStats();
    }

    @GetMapping("/peak-hours/{facilityId}")
    public Map<String, Long> getPeakHours(@PathVariable Long facilityId) {
        return bookingService.getPeakHours(facilityId);
    }
}
