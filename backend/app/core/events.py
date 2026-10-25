"""
Asynchronous Server-Sent Events (SSE) Broadcaster for KOSHA.
Broadcasts real-time events to connected browser dashboards when:
- Bills are created
- Counter repayments or Razorpay payments are verified
- Partial payments reduce outstanding balances
- Bank statements are imported
- Reconciliation results update
"""

import asyncio
from datetime import datetime, timezone
import json
import logging
from typing import Any, AsyncGenerator, Dict, List

logger = logging.getLogger(__name__)


class EventBroadcaster:
    """Thread-safe in-memory SSE event bus for FastAPI."""

    def __init__(self):
        self._subscribers: List[asyncio.Queue] = []
        self._lock = asyncio.Lock()

    async def subscribe(self) -> AsyncGenerator[str, None]:
        """Subscribes an active HTTP connection to the event stream."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.append(queue)

        try:
            # Initial handshake frame
            welcome_payload = {
                "event": "connected",
                "message": "Connected to KOSHA Real-Time Financial Sync",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            yield f"event: connected\ndata: {json.dumps(welcome_payload)}\n\n"

            while True:
                message = await queue.get()
                yield message
        except asyncio.CancelledError:
            pass
        finally:
            async with self._lock:
                if queue in self._subscribers:
                    self._subscribers.remove(queue)

    def publish(self, event_type: str, data: Dict[str, Any]):
        """Publishes an event to all connected browser clients."""
        payload = {
            "event_type": event_type,
            "payload": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        raw_message = f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"

        # Dispatch non-blocking to all subscriber queues
        dead_queues = []
        for q in self._subscribers:
            try:
                q.put_nowait(raw_message)
            except asyncio.QueueFull:
                dead_queues.append(q)
            except Exception as e:
                logger.debug(f"Failed to deliver SSE event: {e}")

        for q in dead_queues:
            if q in self._subscribers:
                self._subscribers.remove(q)


event_broadcaster = EventBroadcaster()
