from fastapi import APIRouter
from app.api.endpoints import ocr

api_router = APIRouter()

# Mount OCR endpoints under /api
api_router.include_router(ocr.router)
