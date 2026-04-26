package com.esukan.service;

import com.esukan.model.Equipment;
import com.esukan.repository.EquipmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.HashMap;

@Service
public class EquipmentService {

    @Autowired
    private EquipmentRepository equipmentRepository;

    public List<Equipment> getAllEquipment() {
        return equipmentRepository.findAll();
    }

    public Optional<Equipment> getEquipmentById(Long id) {
        return equipmentRepository.findById(id);
    }

    public List<Equipment> getEquipmentByStatus(Equipment.EquipmentStatus status) {
        return equipmentRepository.findByStatus(status);
    }

    public List<Equipment> getEquipmentByCategory(String category) {
        return equipmentRepository.findByCategory(category);
    }

    public List<String> getAllCategories() {
        return equipmentRepository.findDistinctCategories();
    }

    public Equipment createEquipment(Equipment equipment) {
        return equipmentRepository.save(equipment);
    }

    public Equipment updateEquipment(Long id, Equipment updated) {
        Equipment equipment = equipmentRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Equipment not found: " + id));
        equipment.setName(updated.getName());
        equipment.setCategory(updated.getCategory());
        equipment.setStatus(updated.getStatus());
        equipment.setQuantity(updated.getQuantity());
        equipment.setDescription(updated.getDescription());
        return equipmentRepository.save(equipment);
    }

    public Equipment updateStatus(Long id, Equipment.EquipmentStatus status) {
        Equipment equipment = equipmentRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Equipment not found: " + id));
        equipment.setStatus(status);
        return equipmentRepository.save(equipment);
    }

    public void deleteEquipment(Long id) {
        equipmentRepository.deleteById(id);
    }

    public Map<String, Long> getInventoryHealthReport() {
        Map<String, Long> report = new HashMap<>();
        report.put("available", equipmentRepository.countByStatus(Equipment.EquipmentStatus.AVAILABLE));
        report.put("damaged", equipmentRepository.countByStatus(Equipment.EquipmentStatus.DAMAGED));
        report.put("inMaintenance", equipmentRepository.countByStatus(Equipment.EquipmentStatus.IN_MAINTENANCE));
        report.put("totalUnhealthy", equipmentRepository.countUnhealthyEquipment());
        return report;
    }
}
