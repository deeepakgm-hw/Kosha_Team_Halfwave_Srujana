"""
FastAPI Server-Sent Events (SSE) Route for KOSHA Real-Time Financial Sync.
"""

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from backend.app.core.events import event_broadcaster

router = APIRouter()


@router.get(
    "/stream",
    summary="Real-Time Event Stream (Server-Sent Events)",
    description="Maintains an active HTTP stream broadcasting real-time ledger updates, payments, and statement imports.",
)
async def event_stream(request: Request):
    """Streams server-sent events to connected browser dashboards."""
    async def sse_generator():
        async for frame in event_broadcaster.subscribe():
            if await request.is_disconnected():
                break
            yield frame

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
