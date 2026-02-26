"""CyberForge Backend - PyInstaller entry point."""

import multiprocessing
import sys
import os

if getattr(sys, '_MEIPASS', None):
    os.chdir(os.path.dirname(sys.executable))

multiprocessing.freeze_support()

import uvicorn
from backend.main import app

if __name__ == '__main__':
    port = int(os.environ.get('CYBERFORGE_PORT', '8008'))
    uvicorn.run(app, host='127.0.0.1', port=port, log_level='info')
