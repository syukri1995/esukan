"""Generate E-Sukan ERD PDF from schema definitions."""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

OUTPUT = Path(__file__).resolve().parent / "esukan-erd.pdf"


class ErdPdf(FPDF):
    def footer(self) -> None:
        self.set_y(-10)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")


def draw_entity(
    pdf: ErdPdf,
    x: float,
    y: float,
    width: float,
    name: str,
    attributes: list[str],
) -> tuple[float, float, float, float]:
    line_h = 4.2
    header_h = 6
    body_h = len(attributes) * line_h + 2
    height = header_h + body_h

    pdf.set_draw_color(40, 70, 120)
    pdf.set_line_width(0.3)
    pdf.rect(x, y, width, height)

    pdf.set_fill_color(40, 70, 120)
    pdf.rect(x, y, width, header_h, style="FD")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_xy(x, y + 1.2)
    pdf.cell(width, 4, name, align="C")

    pdf.set_text_color(20, 20, 20)
    pdf.set_font("Helvetica", "", 7)
    ay = y + header_h + 1
    for attr in attributes:
        pdf.set_xy(x + 1.5, ay)
        prefix = ""
        if attr.endswith(" PK"):
            pdf.set_font("Helvetica", "B", 7)
            prefix = ""
        elif " FK" in attr or attr.endswith(" FK"):
            pdf.set_font("Helvetica", "I", 7)
        else:
            pdf.set_font("Helvetica", "", 7)
        pdf.cell(width - 3, line_h, attr)
        ay += line_h

    return x, y, width, height


def entity_bottom(box: tuple[float, float, float, float]) -> float:
    return box[1] + box[3]


def entity_right(box: tuple[float, float, float, float]) -> float:
    return box[0] + box[2]


def entity_center_x(box: tuple[float, float, float, float]) -> float:
    return box[0] + box[2] / 2


def entity_center_y(box: tuple[float, float, float, float]) -> float:
    return box[1] + box[3] / 2


def draw_relation(
    pdf: ErdPdf,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    label: str = "",
) -> None:
    pdf.set_draw_color(90, 90, 90)
    pdf.set_line_width(0.2)
    pdf.line(x1, y1, x2, y2)
    if label:
        mx = (x1 + x2) / 2
        my = (y1 + y2) / 2
        pdf.set_font("Helvetica", "", 6)
        pdf.set_text_color(80, 80, 80)
        pdf.set_xy(mx - 6, my - 2)
        pdf.cell(12, 3, label, align="C")


def add_title_page(pdf: ErdPdf) -> None:
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(30, 50, 90)
    pdf.ln(35)
    pdf.cell(0, 12, "E-Sukan Database", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 16)
    pdf.cell(0, 10, "Entity Relationship Diagram", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 7, "MySQL schema: esukan_db", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, "Source: sql/schema.sql", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(20)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(30, 50, 90)
    pdf.cell(0, 8, "Domains", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.ln(2)
    for line in [
        "Configuration and authentication",
        "Facilities, equipment, and bookings",
        "Equipment rentals and payments",
        "Tournaments, registrations, and matches",
    ]:
        pdf.cell(0, 7, f"  - {line}", align="C", new_x="LMARGIN", new_y="NEXT")


def add_overview_page(pdf: ErdPdf) -> None:
    pdf.add_page(orientation="L")
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(30, 50, 90)
    pdf.cell(0, 8, "Relationship Overview", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    rows = [
        ("users", "password_reset_tokens", "1 : N", "user_id"),
        ("users", "bookings", "1 : N", "user_id (nullable)"),
        ("users", "booking_waitlist", "1 : N", "user_id (nullable)"),
        ("users", "equipment_rentals", "1 : N", "user_id (nullable)"),
        ("users", "tournaments", "1 : N", "organizer_id"),
        ("users", "tournament_registrations", "1 : N", "registered_by_user_id"),
        ("facilities", "facility_equipment", "1 : N", "facility_id"),
        ("equipment", "facility_equipment", "1 : N", "equipment_id"),
        ("facilities", "bookings", "1 : N", "facility_id"),
        ("facilities", "booking_waitlist", "1 : N", "facility_id"),
        ("facilities", "tournaments", "1 : N", "venue_facility_id (nullable)"),
        ("equipment", "equipment_rentals", "1 : N", "equipment_id"),
        ("bookings", "payments", "1 : N", "booking_id (nullable)"),
        ("equipment_rentals", "payments", "1 : N", "rental_id (nullable)"),
        ("tournaments", "tournament_registrations", "1 : N", "tournament_id"),
        ("tournament_registrations", "tournament_team_members", "1 : N", "registration_id"),
        ("tournaments", "tournament_matches", "1 : N", "tournament_id"),
        ("tournament_registrations", "tournament_matches", "1 : N", "team_a / team_b / winner"),
        ("tournament_matches", "tournament_matches", "1 : 1", "next_match_id (self-ref)"),
    ]

    col_w = [52, 58, 18, 58]
    pdf.set_fill_color(40, 70, 120)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 8)
    for header, w in zip(["Parent", "Child", "Card.", "Foreign Key"], col_w):
        pdf.cell(w, 7, header, border=1, fill=True)
    pdf.ln()

    pdf.set_text_color(20, 20, 20)
    pdf.set_font("Helvetica", "", 7.5)
    fill = False
    for parent, child, card, fk in rows:
        if fill:
            pdf.set_fill_color(245, 247, 250)
        else:
            pdf.set_fill_color(255, 255, 255)
        for value, w in zip([parent, child, card, fk], col_w):
            pdf.cell(w, 6, value, border=1, fill=True)
        pdf.ln()
        fill = not fill

    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(
        0,
        4,
        "Note: bookings, booking_waitlist, and equipment_rentals also store denormalized "
        "student_name / student_id fields for guest or legacy flows. "
        "system_settings is a standalone key-value table with no foreign keys.",
    )


def add_diagram_page(pdf: ErdPdf) -> None:
    pdf.add_page(orientation="L")
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(30, 50, 90)
    pdf.cell(0, 8, "Visual ERD", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    w = 44

    settings = draw_entity(
        pdf,
        8,
        18,
        w,
        "system_settings",
        ["setting_key PK", "setting_value"],
    )

    users = draw_entity(
        pdf,
        8,
        entity_bottom(settings) + 10,
        w,
        "users",
        [
            "id PK",
            "username UK",
            "email UK",
            "password_hash",
            "role",
            "full_name",
            "student_id_number",
            "enabled",
            "created_at",
        ],
    )

    tokens = draw_entity(
        pdf,
        8,
        entity_bottom(users) + 8,
        w,
        "password_reset_tokens",
        ["id PK", "token UK", "user_id FK", "expires_at", "used_at"],
    )

    facilities = draw_entity(
        pdf,
        68,
        18,
        w,
        "facilities",
        [
            "id PK",
            "name",
            "type",
            "description",
            "is_active",
            "open_time",
            "close_time",
            "cost_per_hour",
            "created_at",
        ],
    )

    equipment = draw_entity(
        pdf,
        68,
        entity_bottom(facilities) + 14,
        w,
        "equipment",
        [
            "id PK",
            "name",
            "category",
            "status",
            "quantity",
            "description",
            "cost_per_hour",
            "last_updated",
        ],
    )

    facility_equipment = draw_entity(
        pdf,
        68,
        entity_bottom(equipment) + 8,
        w,
        "facility_equipment",
        ["facility_id PK,FK", "equipment_id PK,FK"],
    )

    bookings = draw_entity(
        pdf,
        128,
        18,
        w,
        "bookings",
        [
            "id PK",
            "student_name",
            "student_id",
            "student_email",
            "facility_id FK",
            "user_id FK",
            "booking_date",
            "start_time",
            "end_time",
            "status",
            "notes",
            "estimated_cost",
            "created_at",
        ],
    )

    waitlist = draw_entity(
        pdf,
        128,
        entity_bottom(bookings) + 8,
        w,
        "booking_waitlist",
        [
            "id PK",
            "student_name",
            "student_id",
            "student_email",
            "facility_id FK",
            "user_id FK",
            "booking_date",
            "start_time",
            "end_time",
            "status",
            "notes",
            "promoted_booking_id",
            "created_at",
        ],
    )

    rentals = draw_entity(
        pdf,
        128,
        entity_bottom(waitlist) + 8,
        w,
        "equipment_rentals",
        [
            "id PK",
            "student_name",
            "student_id",
            "equipment_id FK",
            "user_id FK",
            "quantity",
            "rental_date",
            "return_date",
            "status",
            "deposit_amount",
            "created_at",
        ],
    )

    payments = draw_entity(
        pdf,
        128,
        entity_bottom(rentals) + 8,
        w,
        "payments",
        [
            "id PK",
            "rental_id FK",
            "booking_id FK",
            "method",
            "amount",
            "status",
            "paid_at",
            "created_at",
        ],
    )

    tournaments = draw_entity(
        pdf,
        188,
        18,
        w,
        "tournaments",
        [
            "id PK",
            "title",
            "description",
            "start_date",
            "end_date",
            "status",
            "format",
            "organizer_id FK",
            "venue_facility_id FK",
            "created_at",
        ],
    )

    registrations = draw_entity(
        pdf,
        188,
        entity_bottom(tournaments) + 8,
        w,
        "tournament_registrations",
        [
            "id PK",
            "tournament_id FK",
            "team_name",
            "contact_email",
            "registered_by_user_id FK",
            "created_at",
        ],
    )

    members = draw_entity(
        pdf,
        188,
        entity_bottom(registrations) + 8,
        w,
        "tournament_team_members",
        [
            "id PK",
            "registration_id FK",
            "display_name",
            "email",
            "created_at",
        ],
    )

    matches = draw_entity(
        pdf,
        248,
        18,
        w,
        "tournament_matches",
        [
            "id PK",
            "tournament_id FK",
            "round_number",
            "match_index",
            "slot_label",
            "team_a_registration_id FK",
            "team_b_registration_id FK",
            "winner_registration_id FK",
            "status",
            "next_match_id FK",
            "next_match_slot",
            "created_at",
        ],
    )

    draw_relation(
        pdf,
        entity_center_x(users),
        entity_bottom(users),
        entity_center_x(tokens),
        tokens[1],
        "1:N",
    )
    draw_relation(
        pdf,
        entity_right(users),
        entity_center_y(users),
        bookings[0],
        entity_center_y(bookings),
        "1:N",
    )
    draw_relation(
        pdf,
        entity_right(users),
        entity_center_y(users) + 4,
        waitlist[0],
        entity_center_y(waitlist),
        "1:N",
    )
    draw_relation(
        pdf,
        entity_right(users),
        entity_center_y(users) + 8,
        rentals[0],
        entity_center_y(rentals),
        "1:N",
    )
    draw_relation(
        pdf,
        entity_right(users),
        users[1] + 8,
        tournaments[0],
        entity_center_y(tournaments),
        "1:N",
    )
    draw_relation(
        pdf,
        entity_right(users),
        users[1] + 12,
        registrations[0],
        entity_center_y(registrations),
        "1:N",
    )

    draw_relation(
        pdf,
        entity_right(facilities),
        entity_center_y(facilities),
        bookings[0],
        entity_center_y(bookings) - 6,
        "1:N",
    )
    draw_relation(
        pdf,
        entity_right(facilities),
        entity_center_y(facilities) + 4,
        waitlist[0],
        entity_center_y(waitlist) - 4,
        "1:N",
    )
    draw_relation(
        pdf,
        entity_right(facilities),
        entity_center_y(facilities) + 8,
        tournaments[0],
        entity_center_y(tournaments) - 4,
        "1:N",
    )
    draw_relation(
        pdf,
        entity_center_x(facilities),
        entity_bottom(facilities),
        entity_center_x(facility_equipment),
        facility_equipment[1],
        "1:N",
    )
    draw_relation(
        pdf,
        entity_center_x(equipment),
        equipment[1],
        entity_center_x(facility_equipment),
        entity_bottom(facility_equipment),
        "1:N",
    )
    draw_relation(
        pdf,
        entity_center_x(equipment),
        entity_bottom(equipment),
        entity_center_x(rentals),
        entity_center_y(rentals),
        "1:N",
    )

    draw_relation(
        pdf,
        entity_center_x(bookings),
        entity_bottom(bookings),
        entity_center_x(payments),
        payments[1],
        "1:N",
    )
    draw_relation(
        pdf,
        entity_center_x(rentals),
        entity_bottom(rentals),
        entity_center_x(payments),
        entity_center_y(payments),
        "1:N",
    )

    draw_relation(
        pdf,
        entity_center_x(tournaments),
        entity_bottom(tournaments),
        entity_center_x(registrations),
        registrations[1],
        "1:N",
    )
    draw_relation(
        pdf,
        entity_center_x(registrations),
        entity_bottom(registrations),
        entity_center_x(members),
        members[1],
        "1:N",
    )
    draw_relation(
        pdf,
        entity_right(tournaments),
        entity_center_y(tournaments),
        matches[0],
        entity_center_y(matches) - 8,
        "1:N",
    )
    draw_relation(
        pdf,
        entity_right(registrations),
        entity_center_y(registrations),
        matches[0],
        entity_center_y(matches) + 4,
        "1:N",
    )
    draw_relation(
        pdf,
        entity_center_x(matches),
        entity_bottom(matches),
        entity_center_x(matches) + 10,
        entity_bottom(matches) + 6,
        "next",
    )

    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(90, 90, 90)
    pdf.set_xy(8, 200)
    pdf.cell(0, 4, "PK = Primary Key   UK = Unique Key   FK = Foreign Key")


def main() -> None:
    pdf = ErdPdf(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.set_margins(12, 12, 12)

    add_title_page(pdf)
    add_overview_page(pdf)
    add_diagram_page(pdf)

    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
