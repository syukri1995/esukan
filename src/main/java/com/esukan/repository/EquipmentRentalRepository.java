package com.esukan.repository;

import com.esukan.model.EquipmentRental;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EquipmentRentalRepository extends JpaRepository<EquipmentRental, Long> {

    List<EquipmentRental> findByStudentId(String studentId);

    List<EquipmentRental> findByEquipmentId(Long equipmentId);

    List<EquipmentRental> findByStatus(EquipmentRental.RentalStatus status);

    @Query("SELECT COUNT(r) FROM EquipmentRental r WHERE r.status = 'ACTIVE'")
    Long countActiveRentals();
}
