import json
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi.testclient import TestClient

from family_health_llm.llm import MemberContext, OllamaAssistant
from family_health_llm.main import create_app


class FakeAssistant:
    async def stream_reply(self, question: str, context: MemberContext) -> AsyncIterator[str]:
        assert question == "What allergy is documented?"
        assert context.display_name == "Demo Parent"
        assert context.allergies == ["sulfa"]
        yield "A sulfa allergy "
        yield "is documented."


def test_assistant_streams_context_grounded_text(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "test.db", assistant=FakeAssistant()))
    member = client.post(
        "/v1/family-members", json={"display_name": "Demo Parent", "relationship": "parent"}
    ).json()
    client.post(
        f"/v1/family-members/{member['id']}/allergies",
        json={"substance": "sulfa", "reaction": "rash"},
    )

    with client.stream(
        "POST",
        "/v1/assistant/chat/stream",
        json={"member_id": member["id"], "question": "What allergy is documented?"},
    ) as response:
        events = "".join(response.iter_text())

    assert response.status_code == 200
    assert "event: delta" in events
    assert json.loads(events.split("data: ")[1].split("\n")[0]) == {"content": "A sulfa allergy "}
    assert "event: done" in events


def test_assistant_returns_emergency_guidance_without_calling_model(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "test.db", assistant=FakeAssistant()))
    member = client.post(
        "/v1/family-members", json={"display_name": "Demo Parent", "relationship": "parent"}
    ).json()

    response = client.post(
        "/v1/assistant/chat/stream",
        json={"member_id": member["id"], "question": "They have chest pain. What should we do?"},
    )

    assert response.status_code == 200
    assert "contact local emergency services immediately" in response.text


def test_ollama_prompt_keeps_advisory_boundaries() -> None:
    message = OllamaAssistant._system_message(
        MemberContext(
            display_name="Demo Parent", allergies=["sulfa"], extracted_medications=["Bactrim"]
        )
    )

    assert "do not\ndiagnose, prescribe, calculate doses" in message
    assert "Documented allergies: sulfa" in message
