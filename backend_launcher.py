"""CyberForge backend sidecar launcher.

Standalone entry point bundled by PyInstaller for use as a
Tauri external binary (sidecar).
"""

import sys
import os

# Ensure the project root is on the path so `backend` package resolves
if getattr(sys, "frozen", False):
    base_dir = os.path.dirname(sys.executable)
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, base_dir)

import uvicorn
from backend.main import app
from backend.config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        app,
        host=settings.API_HOST,
        port=settings.API_PORT,
        log_level="info",
    )


if __name__ == "__main__":
    main()
