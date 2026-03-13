"""
Ana pencere - navigasyon ve panel yönetimi
"""
import customtkinter as ctk
import json
import os
from pathlib import Path
from ui.theme import *
from ui.widgets import NavButton
from ui.dashboard import DashboardPanel
from ui.products import ProductsPanel
from ui.sales import SalesPanel
from ui.inventory import InventoryPanel
from ui.marketing import MarketingPanel
from ui.orders import OrdersPanel
from ui.customers import CustomersPanel
from ui.accounting import AccountingPanel


class MainWindow(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Pencere ayarları
        self.title("AI Analytics Pro — Yapay Zeka Destekli İş Yönetimi")
        self.geometry("1440x860")
        self.minsize(1100, 700)
        self.configure(fg_color=BG_DARK)

        # Başlangıçta API key kontrolü
        self._setup_layout()
        self._build_sidebar()
        self._build_topbar()
        self._build_content_area()

        # İlk panel
        self._panels = {}
        self._active_nav = None
        self._navigate("dashboard")

    def _setup_layout(self):
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(1, weight=1)

    def _build_sidebar(self):
        sidebar = ctk.CTkFrame(self, fg_color=BG_SURFACE, width=220,
                                corner_radius=0, border_width=0)
        sidebar.grid(row=0, column=0, rowspan=2, sticky="nsew")
        sidebar.grid_propagate(False)
        sidebar.grid_rowconfigure(9, weight=1)

        # Logo
        logo_frame = ctk.CTkFrame(sidebar, fg_color=BG_SURFACE2, corner_radius=0, height=64)
        logo_frame.grid(row=0, column=0, sticky="ew")
        logo_frame.grid_propagate(False)
        logo_frame.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(logo_frame, text="⚡ AI Analytics Pro",
                     font=("Inter", 14, "bold"), text_color=ACCENT).grid(
            row=0, column=0, pady=20)

        # Navigasyon
        nav_items = [
            ("dashboard",    "🏠",  "Ana Panel"),
            ("accounting",   "💹",  "Muhasebe"),
            ("orders",       "🛒",  "Siparişler"),
            ("customers",    "👥",  "Müşteriler"),
            ("products",     "📦",  "Ürünler"),
            ("sales",        "📈",  "Satış Analizi"),
            ("inventory",    "🏭",  "Stok & Envanter"),
            ("marketing",    "📣",  "Pazarlama"),
        ]

        self._nav_buttons = {}
        for idx, (key, icon, label) in enumerate(nav_items):
            btn = NavButton(
                sidebar, text=label, icon=icon,
                command=lambda k=key: self._navigate(k),
                active=(key == "dashboard"),
            )
            btn.grid(row=idx + 1, column=0, sticky="ew", padx=8, pady=(4, 0))
            self._nav_buttons[key] = btn

        # Ayarlar butonu (alt)
        ctk.CTkFrame(sidebar, fg_color=BORDER, height=1).grid(
            row=9, column=0, sticky="ew", padx=16, pady=8)

        settings_btn = NavButton(sidebar, text="Ayarlar", icon="⚙️",
                                  command=self._open_settings)
        settings_btn.grid(row=10, column=0, sticky="ew", padx=8)

        api_btn = NavButton(sidebar, text="API Anahtarı", icon="🔑",
                             command=self._open_api_settings)
        api_btn.grid(row=11, column=0, sticky="ew", padx=8, pady=(0, 4))

        # Versiyon
        ctk.CTkLabel(sidebar, text="v1.0.0 • Claude Opus 4.6",
                     font=("Inter", 9), text_color=TEXT_MUTED).grid(
            row=12, column=0, pady=(0, 12))

    def _build_topbar(self):
        topbar = ctk.CTkFrame(self, fg_color=BG_SURFACE, height=56,
                               corner_radius=0, border_width=0)
        topbar.grid(row=0, column=1, sticky="ew")
        topbar.grid_propagate(False)
        topbar.grid_columnconfigure(0, weight=1)

        self._page_title = ctk.CTkLabel(
            topbar, text="Ana Panel",
            font=("Inter", 15, "bold"), text_color=TEXT_BRIGHT
        )
        self._page_title.grid(row=0, column=0, sticky="w", padx=24, pady=16)

        # API key durumu
        self._api_status = ctk.CTkLabel(
            topbar,
            text="● API Bağlı" if os.environ.get("ANTHROPIC_API_KEY") else "⚠️ API Anahtarı Gerekli",
            font=("Inter", 11),
            text_color=SUCCESS if os.environ.get("ANTHROPIC_API_KEY") else WARNING
        )
        self._api_status.grid(row=0, column=1, padx=(0, 24))

    def _build_content_area(self):
        self._content = ctk.CTkFrame(self, fg_color=BG_DARK, corner_radius=0)
        self._content.grid(row=1, column=1, sticky="nsew")
        self._content.grid_columnconfigure(0, weight=1)
        self._content.grid_rowconfigure(0, weight=1)

    def _navigate(self, key: str):
        # Eski nav butonu pasif
        if self._active_nav and self._active_nav in self._nav_buttons:
            self._nav_buttons[self._active_nav].set_active(False)

        # Yeni butonu aktif et
        if key in self._nav_buttons:
            self._nav_buttons[key].set_active(True)
        self._active_nav = key

        # Sayfa başlığı güncelle
        titles = {
            "dashboard":  "🏠  Ana Panel",
            "accounting": "💹  Muhasebe & Kar/Zarar",
            "orders":     "🛒  Sipariş Yönetimi",
            "customers":  "👥  Müşteri Yönetimi",
            "products":   "📦  Ürün Yönetimi & Analizi",
            "sales":      "📈  Satış Analizi",
            "inventory":  "🏭  Stok & Envanter",
            "marketing":  "📣  Pazarlama & AI Öneriler",
        }
        self._page_title.configure(text=titles.get(key, key))

        # Mevcut paneli gizle
        for panel in self._content.winfo_children():
            panel.grid_remove()

        # Paneli oluştur veya göster
        if key not in self._panels:
            panel_classes = {
                "dashboard":  DashboardPanel,
                "accounting": AccountingPanel,
                "orders":     OrdersPanel,
                "customers":  CustomersPanel,
                "products":   ProductsPanel,
                "sales":      SalesPanel,
                "inventory":  InventoryPanel,
                "marketing":  MarketingPanel,
            }
            if key in panel_classes:
                panel = panel_classes[key](self._content)
                panel.grid(row=0, column=0, sticky="nsew")
                self._panels[key] = panel
        else:
            self._panels[key].grid(row=0, column=0, sticky="nsew")
            # Mevcut paneli yenile
            if hasattr(self._panels[key], "load_data"):
                self._panels[key].load_data()

    def _open_settings(self):
        dlg = ctk.CTkToplevel(self)
        dlg.title("Ayarlar")
        dlg.geometry("420x320")
        dlg.configure(fg_color=BG_DARK)
        dlg.grab_set()

        ctk.CTkLabel(dlg, text="⚙️  Uygulama Ayarları",
                     font=("Inter", 16, "bold")).pack(padx=24, pady=(20, 16), anchor="w")

        settings_items = [
            ("Uygulama", "AI Analytics Pro v1.0.0"),
            ("AI Modeli", "Claude Opus 4.6"),
            ("Veritabanı", "SQLite (Yerel)"),
            ("Veri Konumu", str(Path.home() / ".ai_analytics")),
        ]
        for key, val in settings_items:
            row = ctk.CTkFrame(dlg, fg_color=BG_SURFACE2, corner_radius=8)
            row.pack(fill="x", padx=24, pady=4)
            ctk.CTkLabel(row, text=key, font=("Inter", 11),
                         text_color=TEXT_MUTED, width=130, anchor="w").pack(
                side="left", padx=14, pady=10)
            ctk.CTkLabel(row, text=val, font=("Inter", 11),
                         text_color=TEXT_PRIMARY, anchor="w").pack(side="left")

        ctk.CTkButton(dlg, text="✕  Kapat", fg_color=BG_SURFACE2,
                       hover_color=BG_SURFACE3, text_color=TEXT_PRIMARY,
                       command=dlg.destroy).pack(pady=20)

    def _open_api_settings(self):
        dlg = ctk.CTkToplevel(self)
        dlg.title("API Anahtarı Ayarları")
        dlg.geometry("480x300")
        dlg.configure(fg_color=BG_DARK)
        dlg.grab_set()

        ctk.CTkLabel(dlg, text="🔑  Anthropic API Anahtarı",
                     font=("Inter", 16, "bold")).pack(padx=24, pady=(20, 8), anchor="w")
        ctk.CTkLabel(dlg, text="AI özelliklerini kullanmak için Anthropic API anahtarınızı girin.",
                     font=("Inter", 11), text_color=TEXT_MUTED,
                     wraplength=420).pack(padx=24, anchor="w")

        ctk.CTkLabel(dlg, text="API Anahtarı (sk-ant-...)", font=("Inter", 11),
                     text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(14, 4))

        current_key = os.environ.get("ANTHROPIC_API_KEY", "")
        api_entry = ctk.CTkEntry(dlg, width=430, show="•")
        api_entry.pack(padx=24)
        if current_key:
            api_entry.insert(0, current_key)

        def save_key():
            key = api_entry.get().strip()
            os.environ["ANTHROPIC_API_KEY"] = key
            # .env dosyasına kaydet
            env_path = Path.home() / ".ai_analytics" / ".env"
            env_path.parent.mkdir(parents=True, exist_ok=True)
            env_path.write_text(f"ANTHROPIC_API_KEY={key}\n")
            status = "✅ API anahtarı kaydedildi." if key else "⚠️ API anahtarı temizlendi."
            status_label.configure(text=status,
                                   text_color=SUCCESS if key else WARNING)
            api_color = SUCCESS if key else WARNING
            self._api_status.configure(
                text="● API Bağlı" if key else "⚠️ API Anahtarı Gerekli",
                text_color=api_color
            )

        status_label = ctk.CTkLabel(dlg, text="", font=("Inter", 11))
        status_label.pack(pady=(8, 0))

        btn_f = ctk.CTkFrame(dlg, fg_color="transparent")
        btn_f.pack(pady=12)
        ctk.CTkButton(btn_f, text="💾  Kaydet", command=save_key).pack(side="left")
        ctk.CTkButton(btn_f, text="✕  Kapat", fg_color=BG_SURFACE2,
                       command=dlg.destroy).pack(side="left", padx=(8, 0))
