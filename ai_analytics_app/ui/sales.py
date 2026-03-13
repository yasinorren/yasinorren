"""
Satış Analizi paneli
"""
import customtkinter as ctk
import threading
from ui.theme import *
from ui.widgets import SectionHeader, AIResponseBox, StatCard
from utils.charts import embed_chart, create_line_chart, create_bar_chart, create_donut_chart
import database as db
import ai_engine


class SalesPanel(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=BG_DARK, **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        self._charts = []
        self._period = 30
        self._build_ui()

    def _build_ui(self):
        # Başlık
        top = ctk.CTkFrame(self, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=24, pady=(24, 0))
        top.grid_columnconfigure(2, weight=1)

        SectionHeader(top, "Satış Analizi", "Gelir ve sipariş performansı", "📈").grid(
            row=0, column=0, sticky="w")

        period_label = ctk.CTkLabel(top, text="Dönem:", font=("Inter", 11),
                                     text_color=TEXT_MUTED)
        period_label.grid(row=0, column=2, sticky="e", padx=(0, 8))

        self._period_var = ctk.StringVar(value="Son 30 Gün")
        period_menu = ctk.CTkOptionMenu(
            top, variable=self._period_var, width=140,
            values=["Son 7 Gün", "Son 30 Gün", "Son 90 Gün", "Son 365 Gün"],
            command=self._on_period_change
        )
        period_menu.grid(row=0, column=3, padx=(0, 8))

        refresh_btn = ctk.CTkButton(top, text="🔄  Yenile", width=110,
                                     fg_color=BG_SURFACE2, hover_color=BG_SURFACE3,
                                     text_color=TEXT_PRIMARY, command=self.load_data)
        refresh_btn.grid(row=0, column=4)

        # KPI kartları
        kpi_frame = ctk.CTkFrame(self, fg_color="transparent")
        kpi_frame.grid(row=1, column=0, sticky="ew", padx=24, pady=(16, 0))
        for i in range(4):
            kpi_frame.grid_columnconfigure(i, weight=1, uniform="kpi")

        self._rev_card   = StatCard(kpi_frame, "Toplam Gelir",    "₺0",  "+0%", "💰", SUCCESS)
        self._ord_card   = StatCard(kpi_frame, "Sipariş Sayısı",  "0",   "+0%", "🛒", ACCENT)
        self._unit_card  = StatCard(kpi_frame, "Satılan Birim",   "0",   "+0%", "📦", ACCENT2)
        self._aov_card   = StatCard(kpi_frame, "Ort. Sipariş ₺", "₺0",  "",    "💳", ACCENT3)

        self._rev_card.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self._ord_card.grid(row=0, column=1, sticky="ew", padx=(0, 8))
        self._unit_card.grid(row=0, column=2, sticky="ew", padx=(0, 8))
        self._aov_card.grid(row=0, column=3, sticky="ew")

        # Tab görünümü
        self._tab = ctk.CTkTabview(self, fg_color=BG_SURFACE, corner_radius=12,
                                    segmented_button_fg_color=BG_SURFACE2,
                                    segmented_button_selected_color=ACCENT)
        self._tab.grid(row=2, column=0, sticky="nsew", padx=24, pady=(16, 0))
        self.grid_rowconfigure(2, weight=1)

        self._trend_tab     = self._tab.add("📈 Trend")
        self._cat_tab       = self._tab.add("🗂️ Kategori")
        self._region_tab    = self._tab.add("🌍 Bölge")
        self._channel_tab   = self._tab.add("📱 Kanal")
        self._ai_tab        = self._tab.add("🤖 AI Analiz")

        for tab in [self._trend_tab, self._cat_tab, self._region_tab,
                    self._channel_tab, self._ai_tab]:
            tab.grid_columnconfigure(0, weight=1)
            tab.grid_rowconfigure(0, weight=1)

        # Trend chart container
        self._trend_cont = ctk.CTkFrame(self._trend_tab, fg_color="transparent")
        self._trend_cont.grid(row=0, column=0, sticky="nsew")
        self._trend_cont.grid_columnconfigure(0, weight=1)
        self._trend_cont.grid_rowconfigure(0, weight=1)

        # Kategori chart container
        self._cat_cont = ctk.CTkFrame(self._cat_tab, fg_color="transparent")
        self._cat_cont.grid(row=0, column=0, sticky="nsew")
        self._cat_cont.grid_columnconfigure(0, weight=1)
        self._cat_cont.grid_rowconfigure(0, weight=1)

        # Bölge chart container
        self._region_cont = ctk.CTkFrame(self._region_tab, fg_color="transparent")
        self._region_cont.grid(row=0, column=0, sticky="nsew")
        self._region_cont.grid_columnconfigure(0, weight=1)
        self._region_cont.grid_rowconfigure(0, weight=1)

        # Kanal chart container
        self._channel_cont = ctk.CTkFrame(self._channel_tab, fg_color="transparent")
        self._channel_cont.grid(row=0, column=0, sticky="nsew")
        self._channel_cont.grid_columnconfigure(0, weight=1)
        self._channel_cont.grid_rowconfigure(0, weight=1)

        # AI tab
        ai_frame = ctk.CTkFrame(self._ai_tab, fg_color="transparent")
        ai_frame.grid(row=0, column=0, sticky="nsew")
        ai_frame.grid_columnconfigure(0, weight=1)
        ai_frame.grid_rowconfigure(1, weight=1)

        ctk.CTkButton(ai_frame, text="🤖  AI Satış Analizi Yap", height=40,
                       command=self._run_ai).grid(row=0, column=0, sticky="ew",
                                                   padx=16, pady=(16, 8))
        self._ai_box = AIResponseBox(ai_frame)
        self._ai_box.grid(row=1, column=0, sticky="nsew", padx=16, pady=(0, 16))

        self.load_data()

    def _on_period_change(self, value: str):
        period_map = {"Son 7 Gün": 7, "Son 30 Gün": 30,
                      "Son 90 Gün": 90, "Son 365 Gün": 365}
        self._period = period_map.get(value, 30)
        self.load_data()

    def load_data(self):
        for c in self._charts:
            try:
                c.get_tk_widget().destroy()
            except Exception:
                pass
        self._charts.clear()

        summary = db.get_sales_summary(self._period)
        daily = db.get_daily_sales(self._period)

        rev = summary.get("total_revenue") or 0
        orders = summary.get("total_orders") or 0
        units = summary.get("total_units") or 0
        aov = summary.get("avg_order_value") or 0

        self._rev_card.update_value(f"₺{rev:,.0f}")
        self._ord_card.update_value(f"{orders:,}")
        self._unit_card.update_value(f"{units:,}")
        self._aov_card.update_value(f"₺{aov:,.0f}")

        # Trend grafiği
        if daily:
            step = max(1, len(daily) // 20)
            days = [d["day"][-5:] if i % step == 0 else "" for i, d in enumerate(daily)]
            revs = [d["revenue"] or 0 for d in daily]
            orders_list = [d["orders"] or 0 for d in daily]
            fig = create_line_chart(
                {"Gelir ₺": (range(len(daily)), revs)},
                title="Günlük Satış Geliri", ylabel="₺"
            )
            canvas = embed_chart(fig, self._trend_cont)
            canvas.get_tk_widget().grid(row=0, column=0, sticky="nsew", padx=8, pady=8)
            self._charts.append(canvas)

        # Kategori
        cats = summary.get("by_category", [])
        if cats:
            labels = [c["category"] for c in cats]
            vals = [c["revenue"] or 0 for c in cats]
            fig = create_bar_chart(labels, vals, title="Kategori Bazında Gelir")
            canvas = embed_chart(fig, self._cat_cont)
            canvas.get_tk_widget().grid(row=0, column=0, sticky="nsew", padx=8, pady=8)
            self._charts.append(canvas)

        # Bölge
        regions = summary.get("by_region", [])
        if regions:
            labels = [r["region"] for r in regions]
            vals = [r["revenue"] or 0 for r in regions]
            fig = create_bar_chart(labels, vals, horizontal=True,
                                   title="Bölge Bazında Gelir", color_index=2)
            canvas = embed_chart(fig, self._region_cont)
            canvas.get_tk_widget().grid(row=0, column=0, sticky="nsew", padx=8, pady=8)
            self._charts.append(canvas)

        # Kanal
        channels = summary.get("by_channel", [])
        if channels:
            labels = [c["channel"] for c in channels]
            vals = [c["revenue"] or 0 for c in channels]
            fig = create_donut_chart(labels, vals, title="Satış Kanalı Dağılımı")
            canvas = embed_chart(fig, self._channel_cont)
            canvas.get_tk_widget().grid(row=0, column=0, sticky="nsew", padx=8, pady=8)
            self._charts.append(canvas)

    def _run_ai(self):
        self._ai_box.clear()
        self._ai_box.set_loading(True)
        self._ai_box.append_text("⏳ AI satış analizi başlatılıyor...\n\n")

        def worker():
            summary = db.get_sales_summary(self._period)
            result = ai_engine.analyze_sales(
                summary, self._period,
                on_chunk=lambda t: self.after(0, self._ai_box.append_text, t)
            )
            db.save_analysis("sales", "Satış analizi", result)
            self.after(0, self._ai_box.set_loading, False)

        threading.Thread(target=worker, daemon=True).start()
