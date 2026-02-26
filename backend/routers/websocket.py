"""WebSocket router for real-time scan progress.

Manages active WebSocket connections and broadcasts progress
updates to connected clients watching specific scans.
"""

import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.models.base import ScanProgress

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """Manage active WebSocket connections grouped by scan_id.

    Each scan_id can have multiple watchers (e.g. multiple UI panels).
    Connections are automatically removed on disconnect.
    """

    def __init__(self) -> None:
        self._active: dict[str, list[WebSocket]] = {}

    async def connect(self, scan_id: str, websocket: WebSocket) -> None:
        """Accept a new WebSocket and register it under *scan_id*."""
        await websocket.accept()
        self._active.setdefault(scan_id, []).append(websocket)
        logger.info("WebSocket connected for scan %s", scan_id)

    def disconnect(self, scan_id: str, websocket: WebSocket) -> None:
        """Remove a WebSocket from the active pool for *scan_id*."""
        connections = self._active.get(scan_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self._active.pop(scan_id, None)
        logger.info("WebSocket disconnected for scan %s", scan_id)

    async def broadcast_progress(self, scan_id: str, data: dict[str, Any]) -> None:
        """Send a JSON payload to every client watching *scan_id*.

        Silently removes any connections that have gone stale.
        """
        stale: list[WebSocket] = []
        for ws in self._active.get(scan_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(scan_id, ws)

    async def send_personal(self, websocket: WebSocket, data: dict[str, Any]) -> None:
        """Send a JSON message to a single WebSocket."""
        await websocket.send_json(data)

    @property
    def active_connections_count(self) -> int:
        """Total number of active WebSocket connections across all scans."""
        return sum(len(conns) for conns in self._active.values())


# Module-level singleton shared across the application
manager = ConnectionManager()


@router.websocket("/ws/scan/{scan_id}")
async def scan_progress_ws(websocket: WebSocket, scan_id: str) -> None:
    """WebSocket endpoint for receiving real-time scan progress.

    Clients connect to /ws/scan/<scan_id> and receive ScanProgress
    JSON messages until the scan completes or the connection closes.
    """
    await manager.connect(scan_id, websocket)
    try:
        while True:
            # Keep the connection alive; clients can also send messages
            raw = await websocket.receive_text()
            # Echo acknowledgement or handle client commands in the future
            try:
                message = json.loads(raw)
                if message.get("type") == "ping":
                    await manager.send_personal(
                        websocket, {"type": "pong", "scan_id": scan_id}
                    )
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(scan_id, websocket)
