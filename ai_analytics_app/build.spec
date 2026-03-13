# -*- mode: python ; coding: utf-8 -*-
# PyInstaller build spec - .exe üretir

import sys
from pathlib import Path

block_cipher = None

# customtkinter kaynak dosyaları
import customtkinter
ctk_path = Path(customtkinter.__file__).parent

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        (str(ctk_path), 'customtkinter/'),
    ],
    hiddenimports=[
        'customtkinter',
        'matplotlib',
        'matplotlib.backends.backend_tkagg',
        'matplotlib.pyplot',
        'pandas',
        'numpy',
        'anthropic',
        'PIL',
        'PIL.Image',
        'tkcalendar',
        'openpyxl',
        'sqlite3',
        'tkinter',
        'tkinter.ttk',
        'ui.dashboard',
        'ui.products',
        'ui.sales',
        'ui.inventory',
        'ui.marketing',
        'ui.orders',
        'ui.customers',
        'ui.accounting',
        'ui.main_window',
        'ui.theme',
        'ui.widgets',
        'utils.charts',
        'database',
        'ai_engine',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pytest', 'unittest', 'doctest'],
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
    name='AIAnalyticsPro',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,        # GUI modu - konsol penceresi yok
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,            # İkon dosyası buraya eklenebilir: 'assets/icon.ico'
    version=None,
)
