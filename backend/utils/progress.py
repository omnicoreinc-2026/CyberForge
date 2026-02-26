"""Progress emitter for scan operations.

Wraps the WebSocket ConnectionManager to provide a convenient
interface for scanner modules to report their progress.
"""

from backend.models.base import ScanProgress
from backend.routers.websocket import ConnectionManager


class ProgressEmitter:
    """Emit scan progress updates over WebSocket.

    Scanner modules instantiate a ProgressEmitter with the shared
    ConnectionManager and the scan_id they are working on, then call
    ``emit()`` as work progresses.

    Example::

        emitter = ProgressEmitter(manager, scan_id="abc-123")
        await emitter.emit(10, "running", "Resolving DNS records")
        # ... do work ...
        await emitter.emit(100, "completed", "Scan finished")
    """

    def __init__(self, connection_manager: ConnectionManager, scan_id: str) -> None:
        self._manager = connection_manager
        self._scan_id = scan_id

    async def emit(
        self,
        progress: int,
        status: str,
        current_task: str = "",
        module: str = "",
    ) -> None:
        """Broadcast a progress update to all watchers of this scan.

        Args:
            progress: Completion percentage (0-100).
            status: Current phase -- pending, running, completed, error.
            current_task: Human-readable description of what is happening.
            module: Scanner module name (optional, useful for multi-module scans).
        """
        message = ScanProgress(
            scan_id=self._scan_id,
            module=module,
            progress=max(0, min(100, progress)),
            status=status,
            current_task=current_task,
        )
        await self._manager.broadcast_progress(
            self._scan_id, message.model_dump()
        )
