package com.esukan.servlet;

import com.esukan.model.EquipmentRental;
import com.esukan.model.UserRole;
import com.esukan.security.UserPrincipal;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

public final class RentalQueries {

    static final String RENTAL_JOIN = """
            SELECT r.id as r_id, r.student_name as r_student_name, r.student_id as r_student_id,
            r.quantity as r_quantity, r.rental_date, r.return_date, r.status as r_status,
            r.deposit_amount, r.created_at as r_created_at, r.user_id as r_user_id,
            e.id as e_id, e.name as e_name, e.category as e_category, e.status as e_status,
            e.quantity as e_quantity, e.description as e_description, e.last_updated as e_last_updated,
            (SELECT p.status FROM payments p WHERE p.rental_id = r.id ORDER BY p.id DESC LIMIT 1) as payment_status
            FROM equipment_rentals r JOIN equipment e ON r.equipment_id = e.id
            """;

    private RentalQueries() {}

    public static Optional<EquipmentRental> findById(Connection conn, long id) throws SQLException {
        String sql = RENTAL_JOIN + " WHERE r.id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(JdbcSupport.mapRentalJoined(rs));
            }
        }
    }

    public static boolean canAccess(EquipmentRental r, UserPrincipal p) {
        if (p.getRole() == UserRole.ADMIN) {
            return true;
        }
        if (r.getUser() != null && r.getUser().getId().equals(p.getId())) {
            return true;
        }
        return p.getStudentIdNumber() != null && p.getStudentIdNumber().equals(r.getStudentId());
    }
}
