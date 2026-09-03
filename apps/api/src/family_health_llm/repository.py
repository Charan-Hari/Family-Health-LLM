"""Local development persistence and append-only audit-chain support."""

import hashlib
import json
import sqlite3
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import UUID, uuid4

from .models import (
    AllergyInput,
    FamilyMember,
    FamilyMemberCreate,
    PrescriptionExtraction,
)


class NotFoundError(Exception):
    """Raised when a requested domain record does not exist."""


class LocalRepository:
    """SQLite repository for local development only; production uses managed encrypted storage."""

    def __init__(self, database_path: Path) -> None:
        self._database_path = database_path
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connection(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connection() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS family_members (
                    id TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    birth_date TEXT,
                    relationship TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS allergies (
                    id TEXT PRIMARY KEY,
                    member_id TEXT NOT NULL REFERENCES family_members(id),
                    substance TEXT NOT NULL,
                    reaction TEXT NOT NULL,
                    documented_on TEXT
                );
                CREATE TABLE IF NOT EXISTS prescriptions (
                    id TEXT PRIMARY KEY,
                    member_id TEXT NOT NULL REFERENCES family_members(id),
                    source_filename TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS audit_events (
                    id TEXT PRIMARY KEY,
                    occurred_at TEXT NOT NULL,
                    action TEXT NOT NULL,
                    subject_id TEXT NOT NULL,
                    previous_hash TEXT,
                    event_hash TEXT NOT NULL
                );
                """
            )

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)

    def _audit(self, connection: sqlite3.Connection, action: str, subject_id: str) -> None:
        previous = connection.execute(
            "SELECT event_hash FROM audit_events ORDER BY occurred_at DESC, id DESC LIMIT 1"
        ).fetchone()
        previous_hash = previous["event_hash"] if previous else ""
        occurred_at = self._now().isoformat()
        serialized = json.dumps(
            {
                "action": action,
                "occurred_at": occurred_at,
                "previous_hash": previous_hash,
                "subject_id": subject_id,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        event_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        connection.execute(
            """
            INSERT INTO audit_events (id, occurred_at, action, subject_id, previous_hash, event_hash)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (str(uuid4()), occurred_at, action, subject_id, previous_hash or None, event_hash),
        )

    def create_member(self, member: FamilyMemberCreate) -> FamilyMember:
        result = FamilyMember(
            id=uuid4(),
            display_name=member.display_name,
            birth_date=member.birth_date,
            relationship=member.relationship,
            created_at=self._now(),
        )
        with self._connection() as connection:
            connection.execute(
                "INSERT INTO family_members VALUES (?, ?, ?, ?, ?)",
                (
                    str(result.id),
                    result.display_name,
                    result.birth_date.isoformat() if result.birth_date else None,
                    result.relationship,
                    result.created_at.isoformat(),
                ),
            )
            self._audit(connection, "family_member.created", str(result.id))
        return result

    @staticmethod
    def _member_from_row(row: sqlite3.Row) -> FamilyMember:
        return FamilyMember(
            id=UUID(row["id"]),
            display_name=row["display_name"],
            birth_date=date.fromisoformat(row["birth_date"]) if row["birth_date"] else None,
            relationship=row["relationship"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    def get_member(self, member_id: UUID) -> FamilyMember:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM family_members WHERE id = ?", (str(member_id),)
            ).fetchone()
        if row is None:
            raise NotFoundError(f"Family member {member_id} was not found.")
        return self._member_from_row(row)

    def list_members(self) -> list[FamilyMember]:
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT * FROM family_members ORDER BY created_at DESC"
            ).fetchall()
        return [self._member_from_row(row) for row in rows]

    def add_allergy(self, member_id: UUID, allergy: AllergyInput) -> None:
        self.get_member(member_id)
        with self._connection() as connection:
            connection.execute(
                "INSERT INTO allergies VALUES (?, ?, ?, ?, ?)",
                (
                    str(uuid4()),
                    str(member_id),
                    allergy.substance,
                    allergy.reaction,
                    allergy.documented_on.isoformat() if allergy.documented_on else None,
                ),
            )
            self._audit(connection, "allergy.created", str(member_id))

    def get_allergies(self, member_id: UUID) -> list[AllergyInput]:
        self.get_member(member_id)
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT substance, reaction, documented_on FROM allergies WHERE member_id = ?",
                (str(member_id),),
            ).fetchall()
        return [
            AllergyInput(
                substance=row["substance"],
                reaction=row["reaction"],
                documented_on=date.fromisoformat(row["documented_on"])
                if row["documented_on"]
                else None,
            )
            for row in rows
        ]

    def save_prescription(self, extraction: PrescriptionExtraction) -> None:
        self.get_member(extraction.member_id)
        payload = extraction.model_dump_json()
        with self._connection() as connection:
            connection.execute(
                "INSERT INTO prescriptions VALUES (?, ?, ?, ?, ?)",
                (
                    str(extraction.id),
                    str(extraction.member_id),
                    extraction.source_filename,
                    payload,
                    extraction.created_at.isoformat(),
                ),
            )
            self._audit(connection, "prescription.extracted", str(extraction.id))

    def list_prescriptions(self, member_id: UUID) -> list[PrescriptionExtraction]:
        self.get_member(member_id)
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT payload FROM prescriptions WHERE member_id = ? ORDER BY created_at DESC",
                (str(member_id),),
            ).fetchall()
        return [PrescriptionExtraction.model_validate_json(row["payload"]) for row in rows]

    def get_member_context(
        self, member_id: UUID
    ) -> tuple[FamilyMember, list[AllergyInput], list[str]]:
        """Return the minimal record facts permitted in an assistant prompt."""
        member = self.get_member(member_id)
        allergies = self.get_allergies(member_id)
        medications = [
            medication.name
            for prescription in self.list_prescriptions(member_id)
            for medication in prescription.extracted_medications
        ]
        return member, allergies, list(dict.fromkeys(medications))
