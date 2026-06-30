"""Generate E-Sukan ERD PNG with orthogonal lines, 1:N notation, and connected routing."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, PathPatch
from matplotlib.path import Path as MplPath

OUTPUT = Path(__file__).resolve().parent / "esukan-erd.png"
STUB = 0.14
CROW = 0.22


@dataclass
class Entity:
    name: str
    attributes: list[str]
    x: float
    y: float
    width: float = 3.2

    @property
    def height(self) -> float:
        return 0.45 + len(self.attributes) * 0.28

    @property
    def left(self) -> float:
        return self.x

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def top(self) -> float:
        return self.y + self.height

    @property
    def bottom(self) -> float:
        return self.y

    @property
    def cx(self) -> float:
        return self.x + self.width / 2

    @property
    def cy(self) -> float:
        return self.y + self.height / 2


@dataclass
class Relation:
    src_key: str
    dst_key: str
    src_side: str
    dst_side: str
    label: str = ""
    lane_y: float | None = None
    bus_x: float | None = None


class AnchorTracker:
    def __init__(self) -> None:
        self._counts: dict[tuple[str, str], int] = defaultdict(int)

    def allocate(self, entity: Entity, side: str) -> float:
        key = (entity.name, side)
        n = self._counts[key]
        self._counts[key] += 1
        max_off = max(0.35, entity.height / 2 - 0.25)
        if n == 0:
            return 0.0
        sign = 1 if n % 2 else -1
        return sign * ((n + 1) // 2) * min(0.36, max_off)


def edge_point(entity: Entity, side: str, offset: float = 0.0) -> tuple[float, float]:
    if side == "left":
        return entity.left, entity.cy + offset
    if side == "right":
        return entity.right, entity.cy + offset
    if side == "top":
        return entity.cx + offset, entity.top
    return entity.cx + offset, entity.bottom


def same_column(src: Entity, dst: Entity, tolerance: float = 0.6) -> bool:
    return abs(src.x - dst.x) < tolerance


def route_relation(
    src: Entity,
    dst: Entity,
    rel: Relation,
    src_offset: float,
    dst_offset: float,
) -> list[tuple[float, float]]:
    start = edge_point(src, rel.src_side, src_offset)
    end = edge_point(dst, rel.dst_side, dst_offset)

    if rel.src_side == "right" and rel.dst_side == "left":
        src_bus = rel.bus_x if rel.bus_x is not None else src.right + STUB
        src_bus = max(src_bus, src.right + STUB)
        dst_bus = dst.left - STUB
        lane_y = rel.lane_y if rel.lane_y is not None else (start[1] + end[1]) / 2
        return [
            start,
            (src_bus, start[1]),
            (src_bus, lane_y),
            (dst_bus, lane_y),
            (dst_bus, end[1]),
            end,
        ]

    if rel.src_side == "bottom" and rel.dst_side == "top":
        below = src.bottom - STUB
        above = dst.top + STUB
        if same_column(src, dst):
            side_bus = rel.bus_x if rel.bus_x is not None else max(src.right, dst.right) + 0.65
            return [
                start,
                (start[0], below),
                (side_bus, below),
                (side_bus, above),
                (end[0], above),
                end,
            ]
        lane_y = rel.lane_y if rel.lane_y is not None else (below + above) / 2
        bus_x = rel.bus_x if rel.bus_x is not None else (start[0] + end[0]) / 2
        return [
            start,
            (start[0], below),
            (start[0], lane_y),
            (bus_x, lane_y),
            (end[0], lane_y),
            (end[0], above),
            end,
        ]

    if rel.src_side == "top" and rel.dst_side == "bottom":
        lane_y = rel.lane_y if rel.lane_y is not None else (src.top + dst.bottom) / 2
        bus_x = rel.bus_x if rel.bus_x is not None else (start[0] + end[0]) / 2
        return [
            start,
            (start[0], src.top + STUB),
            (start[0], lane_y),
            (bus_x, lane_y),
            (end[0], lane_y),
            (end[0], dst.bottom - STUB),
            end,
        ]

    return [start, (end[0], start[1]), end]


def draw_path(ax, points: list[tuple[float, float]]) -> None:
    codes = [MplPath.MOVETO] + [MplPath.LINETO] * (len(points) - 1)
    ax.add_patch(
        PathPatch(
            MplPath(points, codes),
            facecolor="none",
            edgecolor="#444444",
            linewidth=1.15,
            zorder=5,
            capstyle="projecting",
            joinstyle="miter",
        )
    )


def draw_one_marker(ax, point: tuple[float, float], side: str) -> None:
    x, y = point
    tick = 0.16
    if side == "right":
        ax.plot([x - 0.02, x - 0.02], [y - tick, y + tick], color="#222222", lw=1.5, zorder=7)
        ax.text(x - 0.2, y, "1", ha="center", va="center", fontsize=7.5, color="#222222", zorder=7)
    elif side == "left":
        ax.plot([x + 0.02, x + 0.02], [y - tick, y + tick], color="#222222", lw=1.5, zorder=7)
        ax.text(x + 0.2, y, "1", ha="center", va="center", fontsize=7.5, color="#222222", zorder=7)
    elif side == "top":
        ax.plot([x - tick, x + tick], [y - 0.02, y - 0.02], color="#222222", lw=1.5, zorder=7)
        ax.text(x, y - 0.2, "1", ha="center", va="center", fontsize=7.5, color="#222222", zorder=7)
    else:
        ax.plot([x - tick, x + tick], [y + 0.02, y + 0.02], color="#222222", lw=1.5, zorder=7)
        ax.text(x, y + 0.2, "1", ha="center", va="center", fontsize=7.5, color="#222222", zorder=7)


def draw_many_marker(ax, point: tuple[float, float], side: str) -> None:
    x, y = point
    s = CROW
    if side == "left":
        ax.plot([x, x + s, x + s], [y, y - s * 0.75, y + s * 0.75], color="#222222", lw=1.1, zorder=7)
    elif side == "right":
        ax.plot([x, x - s, x - s], [y, y - s * 0.75, y + s * 0.75], color="#222222", lw=1.1, zorder=7)
    elif side == "top":
        ax.plot([x, x - s * 0.75, x + s * 0.75], [y, y - s, y - s], color="#222222", lw=1.1, zorder=7)
    else:
        ax.plot([x, x - s * 0.75, x + s * 0.75], [y, y + s, y + s], color="#222222", lw=1.1, zorder=7)


def draw_entity(ax, entity: Entity) -> None:
    header_h = 0.42
    body_h = entity.height - header_h

    ax.add_patch(
        FancyBboxPatch(
            (entity.x, entity.y + body_h),
            entity.width,
            header_h,
            boxstyle="square,pad=0",
            linewidth=1.0,
            edgecolor="#284878",
            facecolor="#284878",
            zorder=3,
        )
    )
    ax.add_patch(
        FancyBboxPatch(
            (entity.x, entity.y),
            entity.width,
            body_h,
            boxstyle="square,pad=0",
            linewidth=1.0,
            edgecolor="#284878",
            facecolor="#F8FAFC",
            zorder=3,
        )
    )

    ax.text(
        entity.cx,
        entity.y + body_h + header_h / 2,
        entity.name,
        ha="center",
        va="center",
        fontsize=8.5,
        fontweight="bold",
        color="white",
        zorder=4,
    )

    for i, attr in enumerate(entity.attributes):
        y = entity.y + body_h - 0.22 - i * 0.28
        weight = "bold" if " PK" in attr or attr.endswith(" PK") else "normal"
        style = "italic" if " FK" in attr else "normal"
        ax.text(
            entity.x + 0.12,
            y,
            attr,
            ha="left",
            va="center",
            fontsize=7.2,
            fontweight=weight,
            fontstyle=style,
            color="#1F2937",
            zorder=4,
        )


def draw_relation(
    ax,
    src: Entity,
    dst: Entity,
    rel: Relation,
    src_offset: float,
    dst_offset: float,
) -> None:
    points = route_relation(src, dst, rel, src_offset, dst_offset)
    draw_path(ax, points)
    draw_one_marker(ax, points[0], rel.src_side)
    draw_many_marker(ax, points[-1], rel.dst_side)

    if rel.label:
        mid_idx = max(1, len(points) // 2)
        mx, my = points[mid_idx]
        ax.text(
            mx,
            my + 0.14,
            rel.label,
            ha="center",
            va="bottom",
            fontsize=6.5,
            color="#555555",
            zorder=7,
            bbox={"boxstyle": "round,pad=0.15", "fc": "white", "ec": "none", "alpha": 0.92},
        )


def build_entities() -> dict[str, Entity]:
    return {
        "system_settings": Entity("system_settings", ["setting_key PK", "setting_value"], 0.8, 27.2, 3.0),
        "users": Entity(
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
            0.8,
            20.8,
        ),
        "password_reset_tokens": Entity(
            "password_reset_tokens",
            ["id PK", "token UK", "user_id FK", "expires_at", "used_at"],
            0.8,
            14.8,
        ),
        "facilities": Entity(
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
            6.2,
            27.2,
        ),
        "equipment": Entity(
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
            6.2,
            20.8,
        ),
        "facility_equipment": Entity(
            "facility_equipment",
            ["facility_id PK,FK", "equipment_id PK,FK"],
            6.2,
            14.8,
            3.4,
        ),
        "bookings": Entity(
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
            11.6,
            27.2,
        ),
        "booking_waitlist": Entity(
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
            11.6,
            20.8,
        ),
        "equipment_rentals": Entity(
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
            11.6,
            14.8,
        ),
        "payments": Entity(
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
            11.6,
            8.2,
        ),
        "tournaments": Entity(
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
            16.8,
            27.2,
        ),
        "tournament_registrations": Entity(
            "tournament_registrations",
            [
                "id PK",
                "tournament_id FK",
                "team_name",
                "contact_email",
                "registered_by_user_id FK",
                "created_at",
            ],
            16.8,
            20.8,
        ),
        "tournament_team_members": Entity(
            "tournament_team_members",
            ["id PK", "registration_id FK", "display_name", "email", "created_at"],
            16.8,
            14.8,
        ),
        "tournament_matches": Entity(
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
            22.0,
            20.8,
            3.8,
        ),
    }


def build_relations() -> list[Relation]:
    return [
        Relation("users", "password_reset_tokens", "bottom", "top", "has", bus_x=0.15),
        Relation("users", "bookings", "right", "left", "creates", lane_y=29.2, bus_x=5.0),
        Relation("users", "booking_waitlist", "right", "left", "joins", lane_y=24.0, bus_x=5.0),
        Relation("users", "equipment_rentals", "right", "left", "rents", lane_y=16.2, bus_x=5.0),
        Relation("users", "tournaments", "right", "left", "organizes", lane_y=30.0, bus_x=5.0),
        Relation("users", "tournament_registrations", "right", "left", "registers", lane_y=15.2, bus_x=5.0),
        Relation("facilities", "bookings", "right", "left", "booked", lane_y=28.8, bus_x=10.5),
        Relation("facilities", "booking_waitlist", "right", "left", "waitlisted", lane_y=25.0, bus_x=10.5),
        Relation("facilities", "tournaments", "right", "left", "hosts", lane_y=28.2, bus_x=10.5),
        Relation("facilities", "facility_equipment", "bottom", "top", "offers", bus_x=10.0),
        Relation("equipment", "facility_equipment", "bottom", "top", "available_at", bus_x=10.0),
        Relation("equipment", "equipment_rentals", "right", "left", "rented", lane_y=18.2, bus_x=10.5),
        Relation("bookings", "payments", "bottom", "top", "paid_via", bus_x=15.4),
        Relation("equipment_rentals", "payments", "bottom", "top", "paid_via", bus_x=15.4),
        Relation("tournaments", "tournament_registrations", "bottom", "top", "has", bus_x=20.6),
        Relation("tournament_registrations", "tournament_team_members", "bottom", "top", "includes", bus_x=20.6),
        Relation("tournaments", "tournament_matches", "right", "left", "contains", lane_y=28.6, bus_x=16.2),
        Relation("tournament_registrations", "tournament_matches", "right", "left", "teams", lane_y=19.2, bus_x=16.2),
    ]


def draw_self_relation(ax, entity: Entity) -> None:
    start = edge_point(entity, "right", 0.0)
    end = edge_point(entity, "top", 0.5)
    points = [
        start,
        (entity.right + STUB, start[1]),
        (entity.right + 0.85, start[1]),
        (entity.right + 0.85, entity.top + 0.85),
        (end[0], entity.top + 0.85),
        (end[0], entity.top + STUB),
        end,
    ]
    draw_path(ax, points)
    draw_one_marker(ax, start, "right")
    draw_many_marker(ax, end, "top")
    ax.text(
        entity.right + 0.95,
        (start[1] + entity.top) / 2,
        "next_match",
        fontsize=6.5,
        color="#555555",
        ha="left",
        va="center",
        zorder=7,
        bbox={"boxstyle": "round,pad=0.15", "fc": "white", "ec": "none", "alpha": 0.92},
    )


def main() -> None:
    entities = build_entities()
    relations = build_relations()
    tracker = AnchorTracker()

    fig, ax = plt.subplots(figsize=(26, 18), dpi=200)
    ax.set_xlim(0, 27)
    ax.set_ylim(6, 31)
    ax.axis("off")
    ax.set_facecolor("white")

    for entity in entities.values():
        draw_entity(ax, entity)

    for rel in relations:
        src = entities[rel.src_key]
        dst = entities[rel.dst_key]
        draw_relation(
            ax,
            src,
            dst,
            rel,
            tracker.allocate(src, rel.src_side),
            tracker.allocate(dst, rel.dst_side),
        )

    draw_self_relation(ax, entities["tournament_matches"])

    ax.text(0.8, 30.2, "E-Sukan Database ERD", fontsize=14, fontweight="bold", color="#284878")
    ax.text(
        0.8,
        29.75,
        "Source: sql/schema.sql   |   1 = one   crow's foot = many   PK / UK / FK",
        fontsize=8,
        color="#666666",
    )

    fig.savefig(OUTPUT, bbox_inches="tight", facecolor="white", pad_inches=0.4)
    plt.close(fig)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
