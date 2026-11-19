from fastapi import APIRouter, Depends, Header, HTTPException
from app.api.endpoints import ocr, voice
from app.core.config import settings
from app.services.voice_hallucination_guard import verify_internal_token


def verify_internal_ai_token(
    x_internal_ai_token: str | None = Header(default=None, alias="X-Internal-AI-Token")
) -> None:
    if not verify_internal_token(
        x_internal_ai_token,
        settings.AI_INTERNAL_TOKEN,
        allow_empty=settings.DEBUG,
    ):
        raise HTTPException(
            status_code=403,
            detail="Truy cập dịch vụ AI bị từ chối: thiếu hoặc sai X-Internal-AI-Token."
        )


api_router = APIRouter(dependencies=[Depends(verify_internal_ai_token)])

# Mount OCR endpoints under /api
api_router.include_router(ocr.router)

# Mount Voice STT & Chat endpoints under /api/voice
api_router.include_router(voice.router, prefix="/voice", tags=["Voice STT"])
