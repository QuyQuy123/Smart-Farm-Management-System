from contextlib import asynccontextmanager
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.http_client import close_http_client, init_http_client
from app.core.observability import reset_correlation_id, set_correlation_id

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("aiServiceFarmShift")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_http_client()
    token_configured = bool((settings.AI_INTERNAL_TOKEN or "").strip())
    if not token_configured:
        if settings.DEBUG:
            logger.warning(
                "AI_INTERNAL_TOKEN is empty while DEBUG=True; /api/* accepts unauthenticated local calls."
            )
        else:
            logger.error(
                "AI_INTERNAL_TOKEN is empty while DEBUG=False; /api/* is fail-closed and will reject calls with HTTP 403."
            )
    try:
        yield
    finally:
        await close_http_client()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Dịch vụ AI bóc tách chứng từ OCR, Voice-to-Data STT và Trợ lý kỹ thuật chăn nuôi cho FarmShift",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS Middleware (internal service-to-service)
origins = settings.CORS_ORIGINS
allow_all = "*" in origins or (len(origins) == 1 and origins[0] == "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "HEAD"],
    allow_headers=["Content-Type", "X-Internal-AI-Token", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    incoming_id = (request.headers.get("X-Request-ID") or "").strip()
    correlation_id = incoming_id[:128] if incoming_id else uuid.uuid4().hex
    token = set_correlation_id(correlation_id)
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = correlation_id
        return response
    finally:
        reset_correlation_id(token)


# Healthcheck
@app.api_route("/health", methods=["GET", "HEAD"], tags=["Health"])
@app.api_route("/api/health", methods=["GET", "HEAD"], tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "ocr_engine": settings.OCR_ENGINE,
    }


@app.get("/", tags=["Root"])
def root():
    payload = {
        "message": "Chào mừng bạn đến với FarmShift AI Microservice",
        "health": "/health",
    }
    if settings.DEBUG:
        payload["docs"] = "/docs"
    return payload


# Mount /api endpoints
app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
