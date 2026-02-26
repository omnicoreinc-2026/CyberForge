# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for CyberForge Backend Sidecar (onefile)

from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

backend_imports = collect_submodules('backend')

hidden = backend_imports + [
    'uvicorn', 'uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto',
    'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan', 'uvicorn.lifespan.on', 'uvicorn.lifespan.off',
    'fastapi', 'fastapi.middleware', 'fastapi.middleware.cors',
    'pydantic', 'pydantic_settings', 'pydantic_core',
    'starlette', 'starlette.routing', 'starlette.middleware',
    'starlette.responses', 'starlette.websockets', 'starlette.concurrency',
    'aiosqlite', 'httpx', 'httpx._transports', 'httpx._transports.default',
    'anyio', 'anyio._backends', 'anyio._backends._asyncio',
    'sniffio', 'h11', 'httpcore', 'idna', 'certifi', 'jinja2',
    'keyring', 'keyring.backends', 'keyring.backends.Windows',
    'websockets', 'multipart', 'python_multipart', 'email_validator',
]

a = Analysis(
    ['backend_entry.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter', 'matplotlib', 'numpy', 'pandas', 'scipy',
        'PIL', 'cv2', 'torch', 'tensorflow', 'test', 'tests', 'pytest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='cyberforge-backend-x86_64-pc-windows-msvc',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    icon=None,
)
