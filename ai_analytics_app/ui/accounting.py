"""
Muhasebe & Kar/Zarar paneli - Gelişmiş finansal analiz
"""
import customtkinter as ctk
import threading
from datetime import datetime
from ui.theme import *
from ui.widgets import SectionHeader, AIResponseBox, StatCard
from utils.charts import embed_chart, create_bar_chart, create_line_chart, create_donut_chart
import database as db
import ai_engine


class AccountingPanel(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=BG_DARK, **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        self._charts = []
        self._build_ui()

    def _build_ui(self):
        top = ctk.CTkFrame(self, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=24, pady=(24, 0))
        top.grid_columnconfigure(2, weight=1)
        SectionHeader(top, "Muhasebe & Kar/Zarar", "Finansal performans ve gelir tablosu", "💹").grid(
            row=0, column=0, sticky="w")

        year_label = ctk.CTkLabel(top, text="Yıl:", font=("Inter", 11), text_color=TEXT_MUTED)
        year_label.grid(row=0, column=2, sticky="e", padx=(0, 8))

        self._year_var = ctk.StringVar(value=str(datetime.now().year))
        years = [str(y) for y in range(datetime.now().year, datetime.now().year - 5, -1)]
        ctk.CTkOptionMenu(top, variable=self._year_var, width=100,
                           values=years, command=lambda _: self.load_data()
                           ).grid(row=0, column=3, padx=(0, 8))

        ctk.CTkButton(top, text="➕  Gider Ekle", width=130,
                       command=self._add_expense_dialog).grid(row=0, column=4, padx=(0, 8))
        ctk.CTkButton(top, text="🤖  AI Analiz", width=110,
                       fg_color=ACCENT2, command=self._run_ai).grid(row=0, column=5)

        # Tab görünümü
        self._tab = ctk.CTkTabview(self, fg_color=BG_SURFACE, corner_radius=12,
                                    segmented_button_fg_color=BG_SURFACE2,
                                    segmented_button_selected_color=ACCENT)
        self._tab.grid(row=1, column=0, sticky="nsew", padx=24, pady=(16, 24))

        self._pl_tab      = self._tab.add("💹 Gelir Tablosu")
        self._monthly_tab = self._tab.add("📅 Aylık Analiz")
        self._expense_tab = self._tab.add("💸 Giderler")
        self._ai_tab      = self._tab.add("🤖 AI Analiz")

        self._build_pl_tab()
        self._build_monthly_tab()
        self._build_expense_tab()
        self._build_ai_tab()

        self.load_data()

    def _build_pl_tab(self):
        tab = self._pl_tab
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_columnconfigure(1, weight=1)

        # Sol: Gelir tablosu
        left = ctk.CTkScrollableFrame(tab, fg_color="transparent",
                                       scrollbar_button_color=BG_SURFACE3)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8), pady=8)
        tab.grid_rowconfigure(0, weight=1)

        ctk.CTkLabel(left, text="📊  Gelir Tablosu",
                     font=("Inter", 14, "bold")).pack(anchor="w", pady=(0, 12))
        self._pl_rows_frame = ctk.CTkFrame(left, fg_color="transparent")
        self._pl_rows_frame.pack(fill="x")

        # Sağ: KPI Kartları + Pasta
        right = ctk.CTkFrame(tab, fg_color="transparent")
        right.grid(row=0, column=1, sticky="nsew", padx=(8, 0), pady=8)
        right.grid_columnconfigure(0, weight=1)

        self._kpi_grid = ctk.CTkFrame(right, fg_color="transparent")
        self._kpi_grid.pack(fill="x", pady=(0, 12))
        for i in range(2):
            self._kpi_grid.grid_columnconfigure(i, weight=1, uniform="kpi")

        self._rev_kpi    = StatCard(self._kpi_grid, "Brüt Gelir",       "₺0", "", "💰", SUCCESS)
        self._gross_kpi  = StatCard(self._kpi_grid, "Brüt Kar",         "₺0", "", "📈", ACCENT)
        self._net_kpi    = StatCard(self._kpi_grid, "Net Kar",          "₺0", "", "🏆", ACCENT2)
        self._margin_kpi = StatCard(self._kpi_grid, "Net Kar Marjı",   "0%", "", "📊", ACCENT3)

        self._rev_kpi.grid(row=0, column=0, sticky="ew", padx=(0, 6), pady=(0, 6))
        self._gross_kpi.grid(row=0, column=1, sticky="ew", padx=(6, 0), pady=(0, 6))
        self._net_kpi.grid(row=1, column=0, sticky="ew", padx=(0, 6))
        self._margin_kpi.grid(row=1, column=1, sticky="ew", padx=(6, 0))

        self._exp_chart_frame = ctk.CTkFrame(right, fg_color=BG_SURFACE,
                                              corner_radius=12, border_width=1,
                                              border_color=BORDER, height=280)
        self._exp_chart_frame.pack(fill="x", pady=(12, 0))
        self._exp_chart_frame.pack_propagate(False)
        ctk.CTkLabel(self._exp_chart_frame, text="💸  Gider Dağılımı",
                     font=("Inter", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 0))

    def _build_monthly_tab(self):
        tab = self._monthly_tab
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_rowconfigure(0, weight=1)
        self._monthly_cont = ctk.CTkFrame(tab, fg_color="transparent")
        self._monthly_cont.grid(row=0, column=0, sticky="nsew")
        self._monthly_cont.grid_columnconfigure(0, weight=1)
        self._monthly_cont.grid_rowconfigure(0, weight=1)
        self._monthly_cont.grid_rowconfigure(1, weight=1)

    def _build_expense_tab(self):
        tab = self._expense_tab
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_rowconfigure(0, weight=1)

        cont = ctk.CTkFrame(tab, fg_color=BG_SURFACE, corner_radius=12,
                             border_width=1, border_color=BORDER)
        cont.grid(row=0, column=0, sticky="nsew")
        cont.grid_columnconfigure(0, weight=1)
        cont.grid_rowconfigure(1, weight=1)

        hdr = ctk.CTkFrame(cont, fg_color=BG_SURFACE3, corner_radius=6)
        hdr.grid(row=0, column=0, sticky="ew", padx=8, pady=(8, 0))
        for i, (col, w) in enumerate([("Kategori", 130), ("Açıklama", 220), ("Tutar ₺", 100),
                                       ("Tarih", 100), ("Ödeme", 100), ("Makbuz No", 100)]):
            ctk.CTkLabel(hdr, text=col, font=("Inter", 10, "bold"),
                         text_color=TEXT_MUTED, width=w).grid(row=0, column=i, padx=5, pady=7)

        self._exp_scroll = ctk.CTkScrollableFrame(cont, fg_color="transparent",
                                                   scrollbar_button_color=BG_SURFACE3)
        self._exp_scroll.grid(row=1, column=0, sticky="nsew", padx=8, pady=4)

    def _build_ai_tab(self):
        tab = self._ai_tab
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_rowconfigure(1, weight=1)

        ctk.CTkButton(tab, text="🤖  Kapsamlı Finansal Analiz Yap", height=44,
                       command=self._run_ai).grid(
            row=0, column=0, sticky="ew", padx=16, pady=(16, 8))

        self._ai_box = AIResponseBox(tab)
        self._ai_box.grid(row=1, column=0, sticky="nsew", padx=16, pady=(0, 16))

    def load_data(self):
        for c in self._charts:
            try:
                c.get_tk_widget().destroy()
            except Exception:
                pass
        self._charts.clear()

        year = int(self._year_var.get())
        pl = db.get_profit_loss(year=year)
        monthly = db.get_monthly_pl(12)
        expenses = db.get_all_expenses(50)

        # P&L KPI
        self._rev_kpi.update_value(f"₺{pl['gross_revenue']:,.0f}")
        self._gross_kpi.update_value(f"₺{pl['gross_profit']:,.0f}")
        net = pl['net_income']
        self._net_kpi.update_value(f"₺{net:,.0f}")
        self._margin_kpi.update_value(f"%{pl['net_margin_pct']:.1f}")

        # Gelir tablosu satırları
        for w in self._pl_rows_frame.winfo_children():
            w.destroy()

        pl_items = [
            ("BRÜT GELİR", pl['gross_revenue'], SUCCESS, True),
            ("  Satılan Malın Maliyeti", -pl['cogs'], DANGER, False),
            ("BRÜT KAR", pl['gross_profit'], SUCCESS, True),
            ("  Toplam Faaliyet Giderleri", -pl['total_expenses'], DANGER, False),
            ("FAALİYET KARI (EBIT)", pl['operating_income'], ACCENT, True),
            ("  Vergi Karşılığı (%20)", -pl['tax_provision'], WARNING, False),
            ("NET KAR", pl['net_income'], SUCCESS if pl['net_income'] >= 0 else DANGER, True),
        ]

        for label, value, color, bold in pl_items:
            is_separator = bold
            row = ctk.CTkFrame(
                self._pl_rows_frame,
                fg_color=BG_SURFACE2 if is_separator else "transparent",
                corner_radius=6
            )
            row.pack(fill="x", pady=(4 if is_separator else 1))
            row.grid_columnconfigure(1, weight=1)

            ctk.CTkLabel(row, text=label,
                         font=("Inter", 11, "bold" if bold else "normal"),
                         text_color=TEXT_BRIGHT if bold else TEXT_MUTED,
                         anchor="w").grid(row=0, column=0, sticky="w", padx=14, pady=7)
            sign = "" if value == 0 else ("+" if value > 0 else "")
            ctk.CTkLabel(row, text=f"{sign}₺{value:,.0f}",
                         font=("Inter", 11, "bold" if bold else "normal"),
                         text_color=color, anchor="e").grid(
                row=0, column=1, sticky="e", padx=14, pady=7)

        # Marj oranları
        margins_frame = ctk.CTkFrame(self._pl_rows_frame, fg_color=BG_SURFACE3, corner_radius=8)
        margins_frame.pack(fill="x", pady=(16, 0))
        ctk.CTkLabel(margins_frame, text="📊  Oran Analizi",
                     font=("Inter", 11, "bold")).pack(anchor="w", padx=14, pady=(10, 6))
        for label, value, color in [
            ("Brüt Kar Marjı", f"%{pl['gross_margin_pct']:.1f}", SUCCESS),
            ("Faaliyet Kar Marjı", f"%{pl['operating_margin_pct']:.1f}", ACCENT),
            ("Net Kar Marjı", f"%{pl['net_margin_pct']:.1f}", ACCENT2),
        ]:
            row = ctk.CTkFrame(margins_frame, fg_color="transparent")
            row.pack(fill="x", padx=14, pady=2)
            row.grid_columnconfigure(1, weight=1)
            ctk.CTkLabel(row, text=label, font=("Inter", 11), text_color=TEXT_MUTED,
                         anchor="w").grid(row=0, column=0, sticky="w")
            ctk.CTkLabel(row, text=value, font=("Inter", 11, "bold"),
                         text_color=color, anchor="e").grid(row=0, column=1, sticky="e")
        ctk.CTkFrame(margins_frame, height=10, fg_color="transparent").pack()

        # Gider pasta grafiği
        exp_cats = pl.get("expenses_by_category", [])
        if exp_cats:
            labels = [e["category"] for e in exp_cats[:8]]
            vals = [e["total"] or 0 for e in exp_cats[:8]]
            fig = create_donut_chart(labels, vals)
            canvas = embed_chart(fig, self._exp_chart_frame)
            canvas.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=(0, 8))
            self._charts.append(canvas)

        # Aylık analiz grafikleri
        for w in self._monthly_cont.winfo_children():
            w.destroy()

        if monthly:
            months = [m["month"] for m in monthly]
            revenues = [m["revenue"] or 0 for m in monthly]
            gross_profits = [m["gross_profit"] or 0 for m in monthly]
            net_incomes = [m["net_income"] or 0 for m in monthly]

            chart1_frame = ctk.CTkFrame(self._monthly_cont, fg_color=BG_SURFACE,
                                         corner_radius=12, border_width=1, border_color=BORDER)
            chart1_frame.grid(row=0, column=0, sticky="nsew", pady=(8, 4))
            ctk.CTkLabel(chart1_frame, text="📈  Aylık Gelir & Kar Trendi",
                         font=("Inter", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 0))

            fig = create_line_chart({
                "Gelir": (months, revenues),
                "Brüt Kar": (months, gross_profits),
                "Net Kar": (months, net_incomes),
            }, title="", ylabel="₺")
            canvas = embed_chart(fig, chart1_frame)
            canvas.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=(0, 8))
            self._charts.append(canvas)

            chart2_frame = ctk.CTkFrame(self._monthly_cont, fg_color=BG_SURFACE,
                                         corner_radius=12, border_width=1, border_color=BORDER)
            chart2_frame.grid(row=1, column=0, sticky="nsew", pady=(4, 8))
            ctk.CTkLabel(chart2_frame, text="💸  Aylık Gider Trendi",
                         font=("Inter", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 0))

            expenses_list = [m["expenses"] or 0 for m in monthly]
            cogs_list = [m["cogs"] or 0 for m in monthly]

            fig2 = create_bar_chart(months, expenses_list,
                                    title="", ylabel="₺", color_index=4)
            canvas2 = embed_chart(fig2, chart2_frame)
            canvas2.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=(0, 8))
            self._charts.append(canvas2)

        # Gider listesi
        for w in self._exp_scroll.winfo_children():
            w.destroy()

        cat_colors = {
            "Kira": DANGER, "Maaşlar": WARNING, "Pazarlama": ACCENT2,
            "Tedarik": ACCENT3, "Vergi/Harç": DANGER,
        }

        for r, e in enumerate(expenses):
            bg = BG_SURFACE if r % 2 == 0 else BG_SURFACE2
            row_f = ctk.CTkFrame(self._exp_scroll, fg_color=bg, corner_radius=4)
            row_f.pack(fill="x", pady=1)
            cat_color = cat_colors.get(e.get("category", ""), TEXT_MUTED)
            cells = [
                (e.get("category", ""), 130, cat_color),
                ((e.get("description") or "")[:30], 220, TEXT_PRIMARY),
                (f"₺{e.get('amount', 0):,.0f}", 100, DANGER),
                (str(e.get("expense_date", ""))[:10], 100, TEXT_MUTED),
                (e.get("payment_method", ""), 100, TEXT_MUTED),
                (e.get("receipt_no") or "-", 100, TEXT_MUTED),
            ]
            for txt, w, col in cells:
                ctk.CTkLabel(row_f, text=txt, font=("Inter", 10),
                             text_color=col, width=w).pack(side="left", padx=5, pady=5)

    def _add_expense_dialog(self):
        dlg = ctk.CTkToplevel(self)
        dlg.title("Gider Ekle")
        dlg.geometry("480x560")
        dlg.configure(fg_color=BG_DARK)
        dlg.grab_set()

        ctk.CTkLabel(dlg, text="💸  Yeni Gider Kaydı",
                     font=("Inter", 16, "bold")).pack(padx=24, pady=(20, 12), anchor="w")

        fields = {}
        ctk.CTkLabel(dlg, text="Kategori *", font=("Inter", 11),
                     text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(6, 2))
        cat_var = ctk.StringVar(value="Diğer")
        ctk.CTkOptionMenu(dlg, variable=cat_var, width=430,
                           values=["Kira", "Maaşlar", "Elektrik/Su/Doğalgaz", "Pazarlama",
                                   "Tedarik", "Ulaşım", "Bakım/Onarım", "Sigorta",
                                   "Vergi/Harç", "Diğer"]).pack(padx=24)

        for key, label, default in [
            ("description", "Açıklama *", ""),
            ("amount", "Tutar ₺ *", ""),
            ("expense_date", "Tarih (YYYY-MM-DD) *", datetime.now().strftime("%Y-%m-%d")),
            ("receipt_no", "Makbuz/Fatura No", ""),
            ("notes", "Notlar", ""),
        ]:
            ctk.CTkLabel(dlg, text=label, font=("Inter", 11),
                         text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(6, 2))
            entry = ctk.CTkEntry(dlg, width=430)
            entry.insert(0, default)
            entry.pack(padx=24)
            fields[key] = entry

        ctk.CTkLabel(dlg, text="Ödeme Yöntemi", font=("Inter", 11),
                     text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(6, 2))
        pay_var = ctk.StringVar(value="Banka Transferi")
        ctk.CTkOptionMenu(dlg, variable=pay_var, width=430,
                           values=["Nakit", "Banka Transferi", "Kredi Kartı"]).pack(padx=24)

        def save():
            try:
                data = {
                    "category": cat_var.get(),
                    "description": fields["description"].get(),
                    "amount": float(fields["amount"].get()),
                    "expense_date": fields["expense_date"].get(),
                    "receipt_no": fields["receipt_no"].get(),
                    "notes": fields["notes"].get(),
                    "payment_method": pay_var.get(),
                }
                db.add_expense(data)
                dlg.destroy()
                self.load_data()
            except Exception as e:
                ctk.CTkLabel(dlg, text=f"❌ {e}", text_color=DANGER).pack(pady=4)

        btn_f = ctk.CTkFrame(dlg, fg_color="transparent")
        btn_f.pack(pady=16)
        ctk.CTkButton(btn_f, text="💾  Kaydet", command=save).pack(side="left")
        ctk.CTkButton(btn_f, text="İptal", fg_color=BG_SURFACE2,
                       command=dlg.destroy).pack(side="left", padx=(8, 0))

    def _run_ai(self):
        self._tab.set("🤖 AI Analiz")
        self._ai_box.clear()
        self._ai_box.set_loading(True)
        self._ai_box.append_text("⏳ Finansal analiz başlatılıyor...\n\n")

        def worker():
            year = int(self._year_var.get())
            pl = db.get_profit_loss(year=year)
            monthly = db.get_monthly_pl(12)

            context = {
                "yıl": year,
                "brüt_gelir": pl['gross_revenue'],
                "satılan_mal_maliyeti": pl['cogs'],
                "brüt_kar": pl['gross_profit'],
                "brüt_kar_marjı": f"%{pl['gross_margin_pct']:.1f}",
                "toplam_giderler": pl['total_expenses'],
                "faaliyet_karı": pl['operating_income'],
                "net_kar": pl['net_income'],
                "net_kar_marjı": f"%{pl['net_margin_pct']:.1f}",
                "gider_kategorileri": pl['expenses_by_category'],
                "aylık_trend": monthly[-6:] if len(monthly) >= 6 else monthly,
            }

            prompt = f"""Şu finansal verileri analiz et ve detaylı bir finansal rapor hazırla:

{context}

Lütfen şunları içer:
1. 📊 Genel Finansal Sağlık Değerlendirmesi
2. 💰 Gelir ve Maliyet Analizi
3. 📈 Karlılık Trendi ve Yorum
4. 💸 Gider Optimizasyonu Fırsatları
5. ⚠️ Finansal Riskler ve Uyarılar
6. 🎯 Karlılığı Artırmak İçin Stratejik Öneriler
7. 📋 Bütçe ve Nakit Akışı Tavsiyeleri
8. 🔮 Önümüzdeki Dönem Finansal Tahminler"""

            result = ai_engine._stream_response(
                ai_engine.get_client(), prompt,
                on_chunk=lambda t: self.after(0, self._ai_box.append_text, t)
            )
            db.save_analysis("accounting", "Muhasebe analizi", result)
            self.after(0, self._ai_box.set_loading, False)

        threading.Thread(target=worker, daemon=True).start()
