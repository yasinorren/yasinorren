"""
Dashboard - Ana özet ekranı
"""
import customtkinter as ctk
from ui.theme import *
from ui.widgets import StatCard, SectionHeader
from utils.charts import (
    embed_chart, create_line_chart, create_donut_chart, create_bar_chart
)
import database as db
from datetime import datetime


class DashboardPanel(ctk.CTkScrollableFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=BG_DARK, scrollbar_button_color=BG_SURFACE3, **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self._charts = []
        self._build_ui()

    def _build_ui(self):
        # Üst başlık
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=24, pady=(24, 0))
        header.grid_columnconfigure(1, weight=1)

        SectionHeader(header, "Genel Bakış", "Son 30 günlük performans özeti", "🏠").grid(
            row=0, column=0, sticky="w")

        refresh_btn = ctk.CTkButton(
            header, text="🔄  Yenile", width=110,
            fg_color=BG_SURFACE2, hover_color=BG_SURFACE3,
            text_color=TEXT_PRIMARY, corner_radius=8,
            command=self.refresh
        )
        refresh_btn.grid(row=0, column=1, sticky="e")

        # Tarih göstergesi
        now_str = datetime.now().strftime("%d %B %Y, %H:%M")
        ctk.CTkLabel(header, text=f"🕐  {now_str}", font=("Inter", 11),
                     text_color=TEXT_MUTED).grid(row=0, column=2, padx=(12, 0))

        # KPI kartları
        self._kpi_frame = ctk.CTkFrame(self, fg_color="transparent")
        self._kpi_frame.grid(row=1, column=0, sticky="ew", padx=24, pady=(20, 0))
        for i in range(4):
            self._kpi_frame.grid_columnconfigure(i, weight=1, uniform="kpi")

        self._stat_cards = {}
        self._build_kpi_cards()

        # Grafikler - satır 1
        charts_row1 = ctk.CTkFrame(self, fg_color="transparent")
        charts_row1.grid(row=2, column=0, sticky="ew", padx=24, pady=(20, 0))
        charts_row1.grid_columnconfigure(0, weight=2)
        charts_row1.grid_columnconfigure(1, weight=1)

        # Günlük satış trendi
        self._trend_frame = ctk.CTkFrame(charts_row1, fg_color=BG_SURFACE,
                                          corner_radius=12, border_width=1,
                                          border_color=BORDER)
        self._trend_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        ctk.CTkLabel(self._trend_frame, text="📈  Son 30 Gün Satış Trendi",
                     font=("Inter", 13, "bold")).pack(anchor="w", padx=16, pady=(14, 0))

        # Kategori dağılımı
        self._cat_frame = ctk.CTkFrame(charts_row1, fg_color=BG_SURFACE,
                                        corner_radius=12, border_width=1,
                                        border_color=BORDER)
        self._cat_frame.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        ctk.CTkLabel(self._cat_frame, text="🗂️  Kategori Dağılımı",
                     font=("Inter", 13, "bold")).pack(anchor="w", padx=16, pady=(14, 0))

        # Grafikler - satır 2
        charts_row2 = ctk.CTkFrame(self, fg_color="transparent")
        charts_row2.grid(row=3, column=0, sticky="ew", padx=24, pady=(16, 0))
        charts_row2.grid_columnconfigure(0, weight=1)
        charts_row2.grid_columnconfigure(1, weight=1)

        # Bölge geliri
        self._region_frame = ctk.CTkFrame(charts_row2, fg_color=BG_SURFACE,
                                           corner_radius=12, border_width=1,
                                           border_color=BORDER)
        self._region_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        ctk.CTkLabel(self._region_frame, text="🌍  Bölge Bazında Gelir",
                     font=("Inter", 13, "bold")).pack(anchor="w", padx=16, pady=(14, 0))

        # Kanal dağılımı
        self._channel_frame = ctk.CTkFrame(charts_row2, fg_color=BG_SURFACE,
                                            corner_radius=12, border_width=1,
                                            border_color=BORDER)
        self._channel_frame.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        ctk.CTkLabel(self._channel_frame, text="📱  Satış Kanalları",
                     font=("Inter", 13, "bold")).pack(anchor="w", padx=16, pady=(14, 0))

        # Kritik uyarılar
        self._alerts_frame = ctk.CTkFrame(self, fg_color=BG_SURFACE,
                                           corner_radius=12, border_width=1,
                                           border_color=BORDER)
        self._alerts_frame.grid(row=4, column=0, sticky="ew", padx=24, pady=(16, 24))
        ctk.CTkLabel(self._alerts_frame, text="⚠️  Kritik Uyarılar",
                     font=("Inter", 13, "bold"), text_color=WARNING).pack(
            anchor="w", padx=16, pady=(14, 8))

        self.refresh()

    def _build_kpi_cards(self):
        kpi_defs = [
            ("revenue",   "Toplam Gelir",     "₺0",   "+0%", "💰", SUCCESS),
            ("orders",    "Toplam Sipariş",   "0",     "+0%", "🛒", ACCENT),
            ("aov",       "Ort. Sipariş",     "₺0",   "+0%", "📦", ACCENT2),
            ("products",  "Aktif Ürün",       "0",     "",    "🏷️", ACCENT3),
        ]
        for i, (key, title, val, delta, icon, color) in enumerate(kpi_defs):
            card = StatCard(self._kpi_frame, title=title, value=val, delta=delta,
                            icon=icon, accent_color=color)
            card.grid(row=0, column=i, sticky="ew",
                      padx=(0 if i == 0 else 8, 8 if i < 3 else 0))
            self._stat_cards[key] = card

    def refresh(self):
        """Tüm dashboard verilerini yenile"""
        for w in self._charts:
            try:
                w.get_tk_widget().destroy()
            except Exception:
                pass
        self._charts.clear()

        summary = db.get_sales_summary(30)
        daily = db.get_daily_sales(30)
        products = db.get_all_products()
        low_stock = db.get_low_stock_products()
        stock_val = db.get_stock_value()

        # KPI güncelle
        revenue = summary.get("total_revenue") or 0
        orders = summary.get("total_orders") or 0
        aov = summary.get("avg_order_value") or 0

        self._stat_cards["revenue"].update_value(f"₺{revenue:,.0f}")
        self._stat_cards["orders"].update_value(f"{orders:,}")
        self._stat_cards["aov"].update_value(f"₺{aov:,.0f}")
        self._stat_cards["products"].update_value(str(len(products)))

        # Trend grafiği
        if daily:
            days = [d["day"][-5:] for d in daily]  # MM-DD
            rev = [d["revenue"] or 0 for d in daily]
            fig = create_line_chart({"Günlük Gelir": (days, rev)},
                                    title="", ylabel="₺")
            canvas = embed_chart(fig, self._trend_frame)
            canvas.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=(0, 12))
            self._charts.append(canvas)

        # Kategori donut
        cats = summary.get("by_category", [])[:6]
        if cats:
            labels = [c["category"] for c in cats]
            vals = [c["revenue"] or 0 for c in cats]
            fig = create_donut_chart(labels, vals, title="")
            canvas = embed_chart(fig, self._cat_frame)
            canvas.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=(0, 12))
            self._charts.append(canvas)

        # Bölge bar
        regions = summary.get("by_region", [])
        if regions:
            labels = [r["region"] for r in regions]
            vals = [r["revenue"] or 0 for r in regions]
            fig = create_bar_chart(labels, vals, horizontal=True, ylabel="₺", color_index=2)
            canvas = embed_chart(fig, self._region_frame)
            canvas.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=(0, 12))
            self._charts.append(canvas)

        # Kanal donut
        channels = summary.get("by_channel", [])
        if channels:
            labels = [c["channel"] for c in channels]
            vals = [c["revenue"] or 0 for c in channels]
            fig = create_donut_chart(labels, vals, title="")
            canvas = embed_chart(fig, self._channel_frame)
            canvas.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=(0, 12))
            self._charts.append(canvas)

        # Uyarılar
        for w in self._alerts_frame.winfo_children():
            if isinstance(w, ctk.CTkLabel) and "Kritik" in str(w.cget("text")):
                continue
            if isinstance(w, ctk.CTkFrame):
                w.destroy()

        alerts = []
        if len(low_stock) > 0:
            alerts.append(f"⚠️ {len(low_stock)} ürün kritik stok seviyesinde!")
        if stock_val.get("total_cost", 0) > 500000:
            alerts.append(f"💰 Stok değeri yüksek: ₺{stock_val.get('total_cost', 0):,.0f}")
        if not alerts:
            alerts.append("✅ Herhangi bir kritik uyarı bulunmuyor.")

        for alert in alerts:
            is_ok = alert.startswith("✅")
            alert_row = ctk.CTkFrame(self._alerts_frame, fg_color=BG_SURFACE2,
                                      corner_radius=8)
            alert_row.pack(fill="x", padx=12, pady=(0, 8))
            ctk.CTkLabel(alert_row, text=alert, font=("Inter", 12),
                         text_color=SUCCESS if is_ok else WARNING).pack(
                anchor="w", padx=14, pady=10)

        ctk.CTkFrame(self._alerts_frame, height=6, fg_color="transparent").pack()
