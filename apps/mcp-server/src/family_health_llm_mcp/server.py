"""Local stdio MCP tools that proxy narrowly scoped Family Health LLM API operations."""

import json
import os
from collections.abc import AsyncIterator
from uuid import UUID

import httpx
from mcp.server.mcpserver import MCPServer

SERVER_NAME = "family-health-llm-local"
DEFAULT_API_URL = "http://127.0.0.1:8000"
mcp = MCPServer(
    SERVER_NAME,
    instructions=(
        "Development-only tools for Family Health LLM. Treat every response as advisory-only. "
        "Do not diagnose, prescribe, calculate doses, or say a medicine is safe."
    ),
)


def _api_url() -> str:
    return os.getenv("FAMILY_HEALTH_LLM_API_URL", DEFAULT_API_URL).rstrip("/")


async def _request(method: str, path: str, json_body: dict[str, object] | None = None) -> dict:
    async with httpx.AsyncClient(base_url=_api_url(), timeout=httpx.Timeout(30, connect=5)) as client:
        response = await client.request(method, path, json=json_body)
    response.raise_for_status()
    return response.json()


def _parse_sse_event(line: str) -> dict[str, str] | None:
    """Parse one SSE data line emitted by the Family Health LLM assistant endpoint."""
    if not line.startswith("data: "):
        return None
    parsed = json.loads(line.removeprefix("data: "))
    if not isinstance(parsed, dict):
        raise ValueError("The API returned an invalid assistant event.")
    return {str(key): str(value) for key, value in parsed.items()}


async def _stream_assistant(member_id: UUID, question: str) -> AsyncIterator[str]:
    payload = {"member_id": str(member_id), "question": question}
    async with httpx.AsyncClient(base_url=_api_url(), timeout=httpx.Timeout(65, connect=5)) as client:
        async with client.stream("POST", "/v1/assistant/chat/stream", json=payload) as response:
            response.raise_for_status()
            event_name = "message"
            async for line in response.aiter_lines():
                if line.startswith("event: "):
                    event_name = line.removeprefix("event: ")
                    continue
                event = _parse_sse_event(line)
                if event_name == "error" and event:
                    raise RuntimeError(event.get("message", "The local assistant could not complete the request."))
                if event_name == "delta" and event and event.get("content"):
                    yield event["content"]


@mcp.tool()
async def list_prescription_extractions(member_id: UUID) -> list[dict]:
    """List review-required medication extraction candidates for one member UUID."""
    return await _request("GET", f"/v1/family-members/{member_id}/prescriptions")


@mcp.tool()
async def screen_medication(member_id: UUID, medication_name: str) -> dict:
    """Run the curated advisory safety screen for a medication name and one member UUID."""
    return await _request(
        "POST",
        "/v1/safety/check",
        {"member_id": str(member_id), "medications": [{"name": medication_name}]},
    )


@mcp.tool()
async def explain_member_record(member_id: UUID, question: str) -> str:
    """Stream an advisory explanation of selected record facts; never treat it as medical advice."""
    reply = "".join([content async for content in _stream_assistant(member_id, question)])
    if not reply:
        raise RuntimeError("The local assistant returned no explanation.")
    return reply


def main() -> None:
    """Run the MCP server over standard input/output for local agent clients."""
    mcp.run(transport="stdio")
