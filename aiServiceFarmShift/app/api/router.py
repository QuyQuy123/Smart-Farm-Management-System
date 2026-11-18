import secrets
from fastapi import APIRouter, Depends, Header, HTTPException
from app.api.endpoints import ocr, voice
from app.core.config import settings


def verify_internal_ai_token(
    x_internal_ai_token: str | None = Header(default=None, alias="X-Internal-AI-Token")
) -> None:
    expected = (settings.AI_INTERNAL_TOKEN or "").strip()
    if not expected:
        return
    provided = (x_internal_ai_token or "").strip()
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(
            status_code=403,
            detail="Truy cập dịch vụ AI bị từ chối: thiếu hoặc sai X-Internal-AI-Token."
        )


api_router = APIRouter(dependencies=[Depends(verify_internal_ai_token)])

# Mount OCR endpoints under /api
api_router.include_router(ocr.router)

# Mount Voice STT endpoints under /api/voice and alias /api/ai
api_router.include_router(voice.router, prefix="/voice", tags=["Voice STT"])
api_router.include_router(voice.router, prefix="/ai", tags=["Voice STT (Alias)"])
