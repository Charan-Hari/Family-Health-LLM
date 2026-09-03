from pathlib import Path

from fastapi.testclient import TestClient

from family_health_llm.main import create_app


def test_upload_extracts_and_flags_documented_allergy(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "test.db"))
    created_member = client.post(
        "/v1/family-members",
        json={"display_name": "Demo Parent", "relationship": "parent"},
    )
    assert created_member.status_code == 201
    member_id = created_member.json()["id"]

    allergy_response = client.post(
        f"/v1/family-members/{member_id}/allergies",
        json={"substance": "sulfa", "reaction": "hospitalization"},
    )
    assert allergy_response.status_code == 204

    response = client.post(
        f"/v1/prescriptions/extract?member_id={member_id}",
        files={"document": ("prescription.txt", b"Bactrim 800 mg", "text/plain")},
    )

    assert response.status_code == 201
    body = response.json()
    assert (
        body["extraction"]["extracted_medications"][0]["name"] == "Sulfamethoxazole / trimethoprim"
    )
    assert body["safety"]["alerts"][0]["severity"] == "critical"


def test_upload_rejects_unsupported_document_type(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "test.db"))
    member = client.post(
        "/v1/family-members", json={"display_name": "Demo Child", "relationship": "child"}
    ).json()

    response = client.post(
        f"/v1/prescriptions/extract?member_id={member['id']}",
        files={"document": ("prescription.exe", b"not-a-document", "application/octet-stream")},
    )

    assert response.status_code == 415
