package com.esukan;

import com.esukan.model.Equipment;
import com.esukan.model.Facility;
import com.esukan.repository.EquipmentRepository;
import com.esukan.repository.FacilityRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DataInitializer implements ApplicationRunner {

    private final FacilityRepository facilityRepository;
    private final EquipmentRepository equipmentRepository;

    public DataInitializer(FacilityRepository facilityRepository, EquipmentRepository equipmentRepository) {
        this.facilityRepository = facilityRepository;
        this.equipmentRepository = equipmentRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        seedFacilities();
        seedEquipment();
    }

    private void seedFacilities() {
        if (facilityRepository.count() > 0) return;

        facilityRepository.saveAll(List.of(
            facility("Badminton Court 1", Facility.FacilityType.BADMINTON, "Main badminton court near sports complex entrance"),
            facility("Badminton Court 2", Facility.FacilityType.BADMINTON, "Indoor badminton court with air conditioning"),
            facility("Badminton Court 3", Facility.FacilityType.BADMINTON, "Outdoor badminton court"),
            facility("Futsal Court A",    Facility.FacilityType.FUTSAL,    "Full-size futsal court with synthetic turf"),
            facility("Futsal Court B",    Facility.FacilityType.FUTSAL,    "Indoor futsal court, capacity 10 players")
        ));
    }

    private void seedEquipment() {
        if (equipmentRepository.count() > 0) return;

        equipmentRepository.saveAll(List.of(
            equipment("Badminton Racket",    "Racket Sports",   Equipment.EquipmentStatus.AVAILABLE,       20, "Yonex standard rackets"),
            equipment("Shuttlecock (tube)",  "Racket Sports",   Equipment.EquipmentStatus.AVAILABLE,       50, "Feather shuttlecocks"),
            equipment("Futsal Ball",         "Ball Sports",     Equipment.EquipmentStatus.AVAILABLE,       10, "Size 4 futsal balls"),
            equipment("Goalkeeper Gloves",   "Protective Gear", Equipment.EquipmentStatus.AVAILABLE,        5, "Standard goalkeeper gloves"),
            equipment("Knee Guard",          "Protective Gear", Equipment.EquipmentStatus.IN_MAINTENANCE,   8, "Knee protection for futsal"),
            equipment("Bibs / Vests",        "Apparel",         Equipment.EquipmentStatus.AVAILABLE,       30, "Team differentiation bibs"),
            equipment("Score Counter",       "Accessories",     Equipment.EquipmentStatus.DAMAGED,          2, "Manual score counters"),
            equipment("Badminton Net",       "Court Equipment", Equipment.EquipmentStatus.AVAILABLE,        3, "Portable badminton nets")
        ));
    }

    private Facility facility(String name, Facility.FacilityType type, String description) {
        Facility f = new Facility();
        f.setName(name);
        f.setType(type);
        f.setDescription(description);
        f.setIsActive(true);
        return f;
    }

    private Equipment equipment(String name, String category, Equipment.EquipmentStatus status, int qty, String description) {
        Equipment e = new Equipment();
        e.setName(name);
        e.setCategory(category);
        e.setStatus(status);
        e.setQuantity(qty);
        e.setDescription(description);
        return e;
    }
}
