"""FastAPI application for the Family Health LLM MVP."""

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .extraction import extract_prescription
from .llm import LlmUnavailableError, MemberContext, OllamaAssistant
from .models import (
    AllergyInput,
    AssistantChatRequest,
    FamilyMember,
    FamilyMemberCreate,
    PrescriptionAnalysisResponse,
    PrescriptionExtraction,
    SafetyCheckRequest,
    SafetyCheckResponse,
)
from .repository import LocalRepository, NotFoundError
from .safety import ClinicalSafetyEngine

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png", "text/plain"}


def _default_database_path() -> Path:
    configured = os.getenv("FAMILY_HEALTH_LLM_DATABASE_PATH")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[2] / "data" / "family_health_llm.db"


def create_app(
    database_path: Path | None = None, assistant: OllamaAssistant | None = None
) -> FastAPI:
    """Create a configured app instance, allowing an isolated database in tests."""
    repository = LocalRepository(database_path or _default_database_path())
    safety_engine = ClinicalSafetyEngine()
    record_assistant = assistant or OllamaAssistant()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield

    application = FastAPI(
        title="Family Health LLM API",
        version="0.1.0",
        description=(
            "Advisory-only family health record API. All medication safety alerts require "
            "qualified clinician or pharmacist confirmation."
        ),
        lifespan=lifespan,
    )
    allowed_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:8081").split(",")
        if origin.strip()
    ]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Request-ID"],
    )

    @application.middleware("http")
    async def set_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        return response

    def get_repository() -> LocalRepository:
        return repository

    def _sse(event: str, data: dict[str, str]) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    def _requires_emergency_guidance(question: str) -> bool:
        urgent_terms = (
            "chest pain",
            "difficulty breathing",
            "cannot breathe",
            "unconscious",
            "collapsed",
            "seizure",
            "stroke",
            "suicide",
            "overdose",
        )
        normalized_question = question.casefold()
        return any(term in normalized_question for term in urgent_terms)

    @application.get("/health", tags=["operations"])
    def health() -> dict[str, str]:
        """Return a non-sensitive liveness result."""
        return {"status": "ok", "service": "family-health-llm-api"}

    @application.post(
        "/v1/family-members",
        response_model=FamilyMember,
        status_code=status.HTTP_201_CREATED,
        tags=["family"],
    )
    def create_member(
        payload: FamilyMemberCreate, store: LocalRepository = Depends(get_repository)
    ) -> FamilyMember:
        """Create a minimal family member profile."""
        return store.create_member(payload)

    @application.get("/v1/family-members", response_model=list[FamilyMember], tags=["family"])
    def list_members(store: LocalRepository = Depends(get_repository)) -> list[FamilyMember]:
        """List profiles available to the authenticated household (authentication pending MVP hardening)."""
        return store.list_members()

    @application.post(
        "/v1/family-members/{member_id}/allergies",
        status_code=status.HTTP_204_NO_CONTENT,
        tags=["family"],
    )
    def create_allergy(
        member_id: UUID, payload: AllergyInput, store: LocalRepository = Depends(get_repository)
    ) -> None:
        """Record an allergy that must be reviewed clinically before being relied upon."""
        try:
            store.add_allergy(member_id, payload)
        except NotFoundError as error:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    @application.get(
        "/v1/family-members/{member_id}/prescriptions",
        response_model=list[PrescriptionExtraction],
        tags=["records"],
    )
    def list_prescriptions(
        member_id: UUID, store: LocalRepository = Depends(get_repository)
    ) -> list[PrescriptionExtraction]:
        """List review-required structured extraction candidates for one member."""
        try:
            return store.list_prescriptions(member_id)
        except NotFoundError as error:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

    @application.post(
        "/v1/safety/check",
        response_model=SafetyCheckResponse,
        tags=["clinical-safety"],
    )
    def check_safety(
        payload: SafetyCheckRequest, store: LocalRepository = Depends(get_repository)
    ) -> SafetyCheckResponse:
        """Screen candidates against documented allergy records and a curated interaction ruleset."""
        try:
            allergies = store.get_allergies(payload.member_id)
        except NotFoundError as error:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
        return safety_engine.screen(
            str(payload.member_id), payload.medications, allergies, payload.active_medications
        )

    @application.post("/v1/assistant/chat/stream", tags=["assistant"])
    async def stream_assistant_reply(
        payload: AssistantChatRequest,
        store: LocalRepository = Depends(get_repository),
    ) -> StreamingResponse:
        """Stream a non-diagnostic explanation using only the selected member's record facts."""
        try:
            member, allergies, medications = store.get_member_context(payload.member_id)
        except NotFoundError as error:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

        context = MemberContext(
            display_name=member.display_name,
            allergies=[allergy.substance for allergy in allergies],
            extracted_medications=medications,
        )

        async def event_stream():
            if _requires_emergency_guidance(payload.question):
                yield _sse(
                    "delta",
                    {
                        "content": (
                            "If this may be an emergency, contact local emergency services immediately. "
                            "Do not wait for an app response or make medication changes without a clinician."
                        )
                    },
                )
                yield _sse("done", {})
                return
            try:
                async for content in record_assistant.stream_reply(payload.question, context):
                    yield _sse("delta", {"content": content})
                yield _sse("done", {})
            except LlmUnavailableError as error:
                yield _sse("error", {"message": str(error)})

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"X-Accel-Buffering": "no"},
        )

    @application.post(
        "/v1/prescriptions/extract",
        response_model=PrescriptionAnalysisResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["records"],
    )
    async def upload_prescription(
        member_id: UUID,
        document: UploadFile = File(...),
        store: LocalRepository = Depends(get_repository),
    ) -> PrescriptionAnalysisResponse:
        """Extract, store, and clinically screen a prescription candidate without retaining raw bytes."""
        if document.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only PDF, JPEG, PNG, and plain-text prescription files are accepted.",
            )
        raw_content = await document.read(MAX_UPLOAD_BYTES + 1)
        if len(raw_content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Prescription uploads must not exceed 10 MB.",
            )
        try:
            store.get_member(member_id)
        except NotFoundError as error:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error

        extraction = extract_prescription(
            member_id, document.filename or "prescription", raw_content
        )
        store.save_prescription(extraction)
        safety = safety_engine.screen(
            str(member_id),
            extraction.extracted_medications,
            store.get_allergies(member_id),
            [],
        )
        return PrescriptionAnalysisResponse(extraction=extraction, safety=safety)

    return application


app = create_app()
