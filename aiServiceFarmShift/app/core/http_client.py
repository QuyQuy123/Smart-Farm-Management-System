"""Shared pooled httpx.AsyncClient lifecycle helpers for aiServiceFarmShift."""
from __future__ import annotations

import httpx

_shared_client: httpx.AsyncClient | None = None


def init_http_client() -> httpx.AsyncClient:
    """Create (or return) the process-wide pooled httpx.AsyncClient."""
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(
            limits=httpx.Limits(
                max_connections=100,
                max_keepalive_connections=20,
                keepalive_expiry=30.0,
            )
        )
    return _shared_client


async def close_http_client() -> None:
    """Close the shared httpx.AsyncClient on application shutdown."""
    global _shared_client
    if _shared_client is not None:
        client = _shared_client
        _shared_client = None
        if not client.is_closed:
            await client.aclose()


def get_shared_http_client() -> httpx.AsyncClient | None:
    """Return the active shared client when initialized via FastAPI lifespan, else None."""
    if _shared_client is not None and not _shared_client.is_closed:
        return _shared_client
    return None
