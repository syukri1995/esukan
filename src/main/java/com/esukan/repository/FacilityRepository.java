package com.esukan.repository;

import com.esukan.model.Facility;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FacilityRepository extends JpaRepository<Facility, Long> {

    List<Facility> findByIsActiveTrue();

    List<Facility> findByType(Facility.FacilityType type);

    List<Facility> findByTypeAndIsActiveTrue(Facility.FacilityType type);

    @Query("SELECT COUNT(f) FROM Facility f WHERE f.type = :type AND f.isActive = true")
    Long countActiveByType(Facility.FacilityType type);
}
