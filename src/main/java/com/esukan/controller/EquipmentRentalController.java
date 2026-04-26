package com.esukan.controller;

import com.esukan.model.Equipment;
import com.esukan.model.EquipmentRental;
import com.esukan.repository.EquipmentRepository;
import com.esukan.service.EquipmentRentalService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rentals")
@CrossOrigin(origins = "*")
public class EquipmentRentalController {

    @Autowired
    private EquipmentRentalService rentalService;

    @Autowired
    private EquipmentRepository equipmentRepository;

    @GetMapping
    public List<EquipmentRental> getAllRentals() {
        return rentalService.getAllRentals();
    }

    @GetMapping("/active")
    public List<EquipmentRental> getActiveRentals() {
        return rentalService.getActiveRentals();
    }

    @GetMapping("/student/{studentId}")
    public List<EquipmentRental> getRentalsByStudent(@PathVariable String studentId) {
        return rentalService.getRentalsByStudent(studentId);
    }

    @PostMapping
    public ResponseEntity<?> createRental(@RequestBody Map<String, Object> payload) {
        try {
            EquipmentRental rental = new EquipmentRental();
            rental.setStudentName((String) payload.get("studentName"));
            rental.setStudentId((String) payload.get("studentId"));
            rental.setQuantity(Integer.parseInt(payload.get("quantity").toString()));
            rental.setRentalDate(LocalDate.parse((String) payload.get("rentalDate")));

            Long equipmentId = Long.parseLong(payload.get("equipmentId").toString());
            Equipment equipment = equipmentRepository.findById(equipmentId)
                .orElseThrow(() -> new RuntimeException("Equipment not found"));
            rental.setEquipment(equipment);

            return ResponseEntity.ok(rentalService.createRental(rental));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/return")
    public ResponseEntity<?> returnEquipment(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(rentalService.returnEquipment(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRental(@PathVariable Long id) {
        rentalService.deleteRental(id);
        return ResponseEntity.noContent().build();
    }
}
