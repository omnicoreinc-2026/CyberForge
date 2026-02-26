"""Launcher for CyberForge backend - ensures correct working directory."""
import os
import sys

# Ensure we're in the CyberForge project root
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn
from backend.main import app
from backend.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT, log_level="info")
