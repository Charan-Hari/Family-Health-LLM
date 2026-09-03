"""Private-by-default adapter for a local Ollama chat model."""

import json
import os
from collections.abc import AsyncIterator
from dataclasses import dataclass

import httpx


class LlmUnavailableError(Exception):
    """Raised when the configured local model service cannot complete a request."""


@dataclass(frozen=True)
class MemberContext:
    """Minimum health-record context that the assistant may use for one response."""

    display_name: str
    allergies: list[str]
    extracted_medications: list[str]


class OllamaAssistant:
    """Streams advisory-only replies from Ollama without logging health content."""

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        self._base_url = (
            base_url or os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        ).rstrip("/")
        self._model = model or os.getenv("OLLAMA_MODEL", "llama3.2:3b")
        self._timeout_seconds = timeout_seconds or float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "60"))

    @staticmethod
    def _system_message(context: MemberContext) -> str:
        allergies = (
            ", ".join(context.allergies) if context.allergies else "No documented allergies."
        )
        medications = (
            ", ".join(context.extracted_medications)
            if context.extracted_medications
            else "No extracted medication candidates."
        )
        return f"""You are Family Health LLM's health-record explainer. You are not a doctor and do not
diagnose, prescribe, calculate doses, or tell a person to start, stop, or change a medicine. Explain only
the supplied health-record facts in plain language. State uncertainty. For any medication, symptom, worsening
condition, emergency, or clinical decision, tell the user to consult a qualified clinician or pharmacist; for
an emergency, tell them to contact local emergency services immediately. Do not invent history or claim a
negative screening result means safe. Keep the answer under 150 words.

Member label: {context.display_name}
Documented allergies: {allergies}
Extracted medication candidates: {medications}"""

    async def stream_reply(self, question: str, context: MemberContext) -> AsyncIterator[str]:
        """Yield model text deltas from Ollama's documented NDJSON streaming endpoint."""
        payload = {
            "model": self._model,
            "stream": True,
            "messages": [
                {"role": "system", "content": self._system_message(context)},
                {"role": "user", "content": question},
            ],
            "options": {"temperature": 0.2, "num_predict": 220},
        }
        timeout = httpx.Timeout(self._timeout_seconds, connect=5.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST", f"{self._base_url}/api/chat", json=payload
                ) as response:
                    if response.status_code == 404:
                        raise LlmUnavailableError(
                            f"Ollama model '{self._model}' is not available. Pull it with "
                            f"'ollama pull {self._model}' on the API host."
                        )
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            event = json.loads(line)
                        except json.JSONDecodeError as error:
                            raise LlmUnavailableError(
                                "Ollama returned an invalid streaming response."
                            ) from error
                        content = event.get("message", {}).get("content")
                        if isinstance(content, str) and content:
                            yield content
                        if event.get("done") is True:
                            return
        except httpx.ConnectError as error:
            raise LlmUnavailableError(
                "The local Ollama service is unavailable. Start Ollama on the API host first."
            ) from error
        except httpx.TimeoutException as error:
            raise LlmUnavailableError(
                "The local Ollama request timed out. Please try again."
            ) from error
        except httpx.HTTPStatusError as error:
            raise LlmUnavailableError(
                f"The local Ollama service returned HTTP {error.response.status_code}."
            ) from error
