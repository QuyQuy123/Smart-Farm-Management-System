from fastapi import APIRouter
from app.api.endpoints import ocr, voice

api_router = APIRouter()

# Mount OCR endpoints under /api
api_router.include_router(ocr.router)

# Mount Voice STT endpoints under /api/voice and alias /api/ai
api_router.include_router(voice.router, prefix="/voice", tags=["Voice STT"])
api_router.include_router(voice.router, prefix="/ai", tags=["Voice STT (Alias)"])
