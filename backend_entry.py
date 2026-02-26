"""CyberForge Backend - PyInstaller entry point.

This script is the single entry point when the backend runs as a
frozen PyInstaller executable (sidecar). It starts uvicorn with the
FastAPI app on the configured host/port.
"""

import multiprocessing
import sys
import os

# Ensure the frozen app can find its bundled packages
if getattr(sys, "_MEIPASS", None):
    os.chdir(os.path.dirname(sys.executable))

# Required for PyInstaller on Windows
multiprocessing.freeze_support()

import uvicorn
from backend.main import app

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8008,
        log_level="info",
        # No reload in production
    )
