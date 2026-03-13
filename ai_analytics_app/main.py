"""
AI Analytics Pro - Ana giriş noktası
Yapay Zeka Destekli İş Analiz ve Yönetim Sistemi
"""
import os
import sys
import json
from pathlib import Path

# Ortam değişkenlerini yükle
_env_path = Path.home() / ".ai_analytics" / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and "=" in line and not line.startswith("#"):
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

import customtkinter as ctk

# CustomTkinter tema
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# JSON tema uygula (özel renkler için)
from ui.theme import CTK_THEME
_theme_path = Path.home() / ".ai_analytics" / "theme.json"
_theme_path.parent.mkdir(parents=True, exist_ok=True)
_theme_path.write_text(json.dumps(CTK_THEME, indent=2))

try:
    ctk.set_default_color_theme(str(_theme_path))
except Exception:
    pass  # Fallback to default

import database as db
from ui.main_window import MainWindow


def main():
    # Veritabanını başlat
    db.init_database()
    db.seed_sample_data()

    # Uygulamayı başlat
    app = MainWindow()
    app.mainloop()


if __name__ == "__main__":
    main()
