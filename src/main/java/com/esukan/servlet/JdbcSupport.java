package com.esukan.servlet;

import com.esukan.model.Booking;
import com.esukan.model.Equipment;
import com.esukan.model.EquipmentRental;
import com.esukan.model.Facility;
import com.esukan.model.Payment;
import com.esukan.model.User;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public final class JdbcSupport {

    private JdbcSupport() {}

    public static LocalDateTime ts(Timestamp t) {
        return t == null ? null : t.toLocalDateTime();
    }

    public static Facility mapFacility(ResultSet rs, String prefix) throws SQLException {
        Long id = rs.getLong(prefix + "id");
        if (id == 0 && rs.wasNull()) {
            return null;
        }
        Facility f = new Facility();
        f.setId(id);
        f.setName(rs.getString(prefix + "name"));
        String type = rs.getString(prefix + "type");
        if (type != null) {
            f.setType(Facility.FacilityType.valueOf(type.trim()));
        }
        f.setDescription(rs.getString(prefix + "description"));
        f.setIsActive(rs.getBoolean(prefix + "is_active"));
        try {
            f.setOpenTime(rs.getObject(prefix + "open_time", LocalTime.class));
            f.setCloseTime(rs.getObject(prefix + "close_time", LocalTime.class));
            BigDecimal cph = rs.getBigDecimal(prefix + "cost_per_hour");
            f.setCostPerHour(cph != null ? cph : BigDecimal.ZERO);
        } catch (SQLException ignored) {
            f.setCostPerHour(BigDecimal.ZERO);
        }
        f.setCreatedAt(ts(rs.getTimestamp(prefix + "created_at")));
        return f;
    }

    public static Equipment mapEquipment(ResultSet rs, String prefix) throws SQLException {
        Long id = rs.getLong(prefix + "id");
        if (id == 0 && rs.wasNull()) {
            return null;
        }
        Equipment e = new Equipment();
        e.setId(id);
        e.setName(rs.getString(prefix + "name"));
        e.setCategory(rs.getString(prefix + "category"));
        String st = rs.getString(prefix + "status");
        if (st != null) {
            e.setStatus(Equipment.EquipmentStatus.valueOf(st.trim()));
        }
        e.setQuantity(rs.getInt(prefix + "quantity"));
        e.setDescription(rs.getString(prefix + "description"));
        try {
            BigDecimal cph = rs.getBigDecimal(prefix + "cost_per_hour");
            e.setCostPerHour(cph != null ? cph : BigDecimal.ZERO);
        } catch (SQLException ignored) {
            e.setCostPerHour(BigDecimal.ZERO);
        }
        e.setLastUpdated(ts(rs.getTimestamp(prefix + "last_updated")));
        return e;
    }

    public static User mapUserShallow(ResultSet rs, String prefix) throws SQLException {
        Long id = rs.getLong(prefix + "id");
        if (id == 0 && rs.wasNull()) {
            return null;
        }
        User u = new User();
        u.setId(id);
        u.setUsername(rs.getString(prefix + "username"));
        u.setEmail(rs.getString(prefix + "email"));
        u.setPasswordHash(rs.getString(prefix + "password_hash"));
        String role = rs.getString(prefix + "role");
        if (role != null) {
            u.setRole(com.esukan.model.UserRole.valueOf(role.trim()));
        }
        u.setFullName(rs.getString(prefix + "full_name"));
        u.setStudentIdNumber(rs.getString(prefix + "student_id_number"));
        u.setEnabled(rs.getBoolean(prefix + "enabled"));
        u.setCreatedAt(ts(rs.getTimestamp(prefix + "created_at")));
        return u;
    }

    public static Booking mapBookingJoined(ResultSet rs) throws SQLException {
        Booking b = new Booking();
        b.setId(rs.getLong("br_id"));
        b.setStudentName(rs.getString("br_student_name"));
        b.setStudentId(rs.getString("br_student_id"));
        b.setStudentEmail(rs.getString("br_student_email"));
        b.setBookingDate(rs.getObject("br_booking_date", LocalDate.class));
        b.setStartTime(rs.getObject("br_start_time", LocalTime.class));
        b.setEndTime(rs.getObject("br_end_time", LocalTime.class));
        String st = rs.getString("br_status");
        if (st != null) {
            b.setStatus(Booking.BookingStatus.valueOf(st.trim()));
        }
        b.setNotes(rs.getString("br_notes"));
        b.setCreatedAt(ts(rs.getTimestamp("br_created_at")));
        try {
            BigDecimal est = rs.getBigDecimal("br_estimated_cost");
            b.setEstimatedCost(est != null ? est : BigDecimal.ZERO);
            b.setPaymentStatus(rs.getString("payment_status"));
        } catch (SQLException ignored) {
            b.setEstimatedCost(BigDecimal.ZERO);
        }
        b.setFacility(mapFacility(rs, "f_"));
        Long uid = rs.getLong("br_user_id");
        if (!rs.wasNull()) {
            User u = new User();
            u.setId(uid);
            b.setUser(u);
        }
        return b;
    }

    public static EquipmentRental mapRentalJoined(ResultSet rs) throws SQLException {
        EquipmentRental r = new EquipmentRental();
        r.setId(rs.getLong("r_id"));
        r.setStudentName(rs.getString("r_student_name"));
        r.setStudentId(rs.getString("r_student_id"));
        r.setQuantity(rs.getInt("r_quantity"));
        r.setRentalDate(rs.getObject("rental_date", LocalDate.class));
        r.setReturnDate(rs.getObject("return_date", LocalDate.class));
        String st = rs.getString("r_status");
        if (st != null) {
            r.setStatus(EquipmentRental.RentalStatus.valueOf(st.trim()));
        }
        BigDecimal dep = rs.getBigDecimal("deposit_amount");
        r.setDepositAmount(dep != null ? dep : new BigDecimal("50.00"));
        r.setCreatedAt(ts(rs.getTimestamp("r_created_at")));
        r.setEquipment(mapEquipment(rs, "e_"));
        Long uid = rs.getLong("r_user_id");
        if (!rs.wasNull()) {
            User u = new User();
            u.setId(uid);
            r.setUser(u);
        }
        String ps = rs.getString("payment_status");
        r.setPaymentStatus(ps);
        return r;
    }


    public static Payment mapPayment(ResultSet rs) throws SQLException {
        Payment p = new Payment();
        p.setId(rs.getLong("id"));
        long rentalId = rs.getLong("rental_id");
        if (!rs.wasNull()) {
            p.setRentalId(rentalId);
        }
        try {
            long bookingId = rs.getLong("booking_id");
            if (!rs.wasNull()) {
                p.setBookingId(bookingId);
            }
        } catch (SQLException ignored) {
            // column may be absent on older DB
        }
        String m = rs.getString("method");
        if (m != null) {
            String norm = m.trim().replace('-', '_');
            p.setMethod(Payment.PaymentMethod.valueOf(norm));
        }
        p.setAmount(rs.getBigDecimal("amount"));
        String st = rs.getString("status");
        if (st != null) {
            p.setStatus(Payment.PaymentStatus.valueOf(st.trim()));
        }
        p.setPaidAt(ts(rs.getTimestamp("paid_at")));
        p.setCreatedAt(ts(rs.getTimestamp("created_at")));
        return p;
    }

}
