package com.esukan.servlet;

import com.esukan.model.Facility;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

public final class FacilityQueries {

    static final String FACILITY_SELECT = """
            SELECT id, name, type, description, is_active, open_time, close_time, cost_per_hour, created_at
            FROM facilities
            """;

    private FacilityQueries() {}

    static void syncEquipmentLinks(Connection conn, long facilityId, List<Long> equipmentIds) throws Exception {
        try (PreparedStatement del = conn.prepareStatement("DELETE FROM facility_equipment WHERE facility_id = ?")) {
            del.setLong(1, facilityId);
            del.executeUpdate();
        }
        if (equipmentIds == null || equipmentIds.isEmpty()) {
            return;
        }
        try (PreparedStatement ins = conn.prepareStatement(
                "INSERT INTO facility_equipment (facility_id, equipment_id) VALUES (?, ?)")) {
            for (Long eid : equipmentIds) {
                if (eid == null) {
                    continue;
                }
                ins.setLong(1, facilityId);
                ins.setLong(2, eid);
                ins.addBatch();
            }
            ins.executeBatch();
        }
    }

    static List<Long> loadEquipmentIds(Connection conn, long facilityId) throws Exception {
        List<Long> ids = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT equipment_id FROM facility_equipment WHERE facility_id = ? ORDER BY equipment_id")) {
            ps.setLong(1, facilityId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    ids.add(rs.getLong("equipment_id"));
                }
            }
        }
        return ids;
    }

    static void enrichForResponse(Connection conn, Facility f) throws Exception {
        OperatingHoursHelper.enrichFacilityHours(conn, f);
        f.setEquipmentIds(loadEquipmentIds(conn, f.getId()));
    }

    static void bindFacilityWrite(PreparedStatement ps, Facility f, boolean includeId) throws Exception {
        int i = 1;
        ps.setString(i++, f.getName());
        ps.setString(i++, f.getType().name());
        ps.setString(i++, f.getDescription());
        ps.setBoolean(i++, f.getIsActive() != null && f.getIsActive());
        if (f.getOpenTime() != null) {
            ps.setObject(i++, f.getOpenTime());
        } else {
            ps.setNull(i++, Types.TIME);
        }
        if (f.getCloseTime() != null) {
            ps.setObject(i++, f.getCloseTime());
        } else {
            ps.setNull(i++, Types.TIME);
        }
        BigDecimal cph = f.getCostPerHour() != null ? f.getCostPerHour() : BigDecimal.ZERO;
        ps.setBigDecimal(i++, cph);
        if (includeId) {
            ps.setLong(i, f.getId());
        }
    }
}
