package com.esukan.service;

import com.esukan.model.Facility;
import com.esukan.repository.FacilityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class FacilityService {

    @Autowired
    private FacilityRepository facilityRepository;

    public List<Facility> getAllFacilities() {
        return facilityRepository.findAll();
    }

    public List<Facility> getActiveFacilities() {
        return facilityRepository.findByIsActiveTrue();
    }

    public Optional<Facility> getFacilityById(Long id) {
        return facilityRepository.findById(id);
    }

    public List<Facility> getFacilitiesByType(Facility.FacilityType type) {
        return facilityRepository.findByTypeAndIsActiveTrue(type);
    }

    public Facility createFacility(Facility facility) {
        return facilityRepository.save(facility);
    }

    public Facility updateFacility(Long id, Facility updated) {
        Facility facility = facilityRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Facility not found: " + id));
        facility.setName(updated.getName());
        facility.setType(updated.getType());
        facility.setDescription(updated.getDescription());
        facility.setIsActive(updated.getIsActive());
        return facilityRepository.save(facility);
    }

    public void deleteFacility(Long id) {
        facilityRepository.deleteById(id);
    }

    public Long countActiveByType(Facility.FacilityType type) {
        return facilityRepository.countActiveByType(type);
    }
}
