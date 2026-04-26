package com.esukan.service;

import com.esukan.model.EquipmentRental;
import com.esukan.repository.EquipmentRentalRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class EquipmentRentalService {

    @Autowired
    private EquipmentRentalRepository rentalRepository;

    public List<EquipmentRental> getAllRentals() {
        return rentalRepository.findAll();
    }

    public Optional<EquipmentRental> getRentalById(Long id) {
        return rentalRepository.findById(id);
    }

    public List<EquipmentRental> getRentalsByStudent(String studentId) {
        return rentalRepository.findByStudentId(studentId);
    }

    public List<EquipmentRental> getActiveRentals() {
        return rentalRepository.findByStatus(EquipmentRental.RentalStatus.ACTIVE);
    }

    public EquipmentRental createRental(EquipmentRental rental) {
        return rentalRepository.save(rental);
    }

    public EquipmentRental returnEquipment(Long id) {
        EquipmentRental rental = rentalRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Rental not found: " + id));
        rental.setStatus(EquipmentRental.RentalStatus.RETURNED);
        rental.setReturnDate(java.time.LocalDate.now());
        return rentalRepository.save(rental);
    }

    public void deleteRental(Long id) {
        rentalRepository.deleteById(id);
    }

    public Long countActiveRentals() {
        return rentalRepository.countActiveRentals();
    }
}
