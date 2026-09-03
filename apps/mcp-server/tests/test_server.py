import asyncio

import pytest

from family_health_llm_mcp.server import _parse_sse_event, mcp


def test_parse_sse_event_returns_data() -> None:
    assert _parse_sse_event('data: {"content":"hello"}') == {"content": "hello"}


def test_parse_sse_event_ignores_non_data_lines() -> None:
    assert _parse_sse_event("event: delta") is None


def test_parse_sse_event_rejects_non_object_json() -> None:
    with pytest.raises(ValueError, match="invalid assistant event"):
        _parse_sse_event("data: []")


def test_mcp_registers_expected_tools() -> None:
    tools = asyncio.run(mcp.list_tools())
    assert {tool.name for tool in tools} == {
        "explain_member_record",
        "list_prescription_extractions",
        "screen_medication",
    }
