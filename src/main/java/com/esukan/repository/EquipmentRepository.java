package com.esukan.repository;

import com.esukan.model.Equipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EquipmentRepository extends JpaRepository<Equipment, Long> {

    List<Equipment> findByStatus(Equipment.EquipmentStatus status);

    List<Equipment> findByCategory(String category);

    @Query("SELECT COUNT(e) FROM Equipment e WHERE e.status = :status")
    Long countByStatus(Equipment.EquipmentStatus status);

    @Query("SELECT DISTINCT e.category FROM Equipment e ORDER BY e.category")
    List<String> findDistinctCategories();

    @Query("SELECT COUNT(e) FROM Equipment e WHERE e.status = 'DAMAGED' OR e.status = 'IN_MAINTENANCE'")
    Long countUnhealthyEquipment();
}
