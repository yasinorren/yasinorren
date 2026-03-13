"""
Stok & Envanter paneli
"""
import customtkinter as ctk
import threading
from ui.theme import *
from ui.widgets import SectionHeader, AIResponseBox, StatCard
from utils.charts import embed_chart, create_bar_chart
import database as db
import ai_engine


class InventoryPanel(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=BG_DARK, **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        self._charts = []
        self._build_ui()

    def _build_ui(self):
        top = ctk.CTkFrame(self, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=24, pady=(24, 0))
        top.grid_columnconfigure(1, weight=1)
        SectionHeader(top, "Stok & Envanter", "Stok seviyeleri ve yönetimi", "📦").grid(
            row=0, column=0, sticky="w")
        ctk.CTkButton(top, text="🔄  Yenile", width=110,
                       fg_color=BG_SURFACE2, hover_color=BG_SURFACE3,
                       text_color=TEXT_PRIMARY, command=self.load_data).grid(
            row=0, column=1, sticky="e")

        # KPI
        kpi_f = ctk.CTkFrame(self, fg_color="transparent")
        kpi_f.grid(row=1, column=0, sticky="ew", padx=24, pady=(16, 0))
        for i in range(4):
            kpi_f.grid_columnconfigure(i, weight=1, uniform="kpi")

        self._cost_card   = StatCard(kpi_f, "Stok Maliyeti",    "₺0", "", "💰", WARNING)
        self._retail_card = StatCard(kpi_f, "Perakende Değer",  "₺0", "", "🏷️", SUCCESS)
        self._profit_card = StatCard(kpi_f, "Potansiyel Kar",   "₺0", "", "📈", ACCENT)
        self._low_card    = StatCard(kpi_f, "Kritik Stok",      "0",  "", "⚠️", DANGER)

        self._cost_card.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self._retail_card.grid(row=0, column=1, sticky="ew", padx=(0, 8))
        self._profit_card.grid(row=0, column=2, sticky="ew", padx=(0, 8))
        self._low_card.grid(row=0, column=3, sticky="ew")

        # İçerik alanı
        content = ctk.CTkFrame(self, fg_color="transparent")
        content.grid(row=2, column=0, sticky="nsew", padx=24, pady=(16, 0))
        content.grid_columnconfigure(0, weight=2)
        content.grid_columnconfigure(1, weight=1)
        content.grid_rowconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        # Sol: Kritik stok listesi
        left = ctk.CTkFrame(content, fg_color=BG_SURFACE, corner_radius=12,
                             border_width=1, border_color=BORDER)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        left.grid_columnconfigure(0, weight=1)
        left.grid_rowconfigure(2, weight=1)

        ctk.CTkLabel(left, text="⚠️  Kritik Stok Uyarıları",
                     font=("Inter", 13, "bold"), text_color=WARNING).grid(
            row=0, column=0, sticky="w", padx=16, pady=(14, 0))

        # Tablo başlık
        hdr = ctk.CTkFrame(left, fg_color=BG_SURFACE3, corner_radius=6)
        hdr.grid(row=1, column=0, sticky="ew", padx=8, pady=(8, 0))
        for i, (col, w) in enumerate([("Ürün", 200), ("Kategori", 110), ("Mevcut", 70),
                                       ("Min.", 60), ("Eksi", 60), ("Aksiyon", 90)]):
            ctk.CTkLabel(hdr, text=col, font=("Inter", 10, "bold"),
                         text_color=TEXT_MUTED, width=w).grid(
                row=0, column=i, padx=6, pady=7)

        self._low_scroll = ctk.CTkScrollableFrame(left, fg_color="transparent",
                                                   scrollbar_button_color=BG_SURFACE3)
        self._low_scroll.grid(row=2, column=0, sticky="nsew", padx=8, pady=4)

        # Sağ: Grafikler + AI
        right = ctk.CTkFrame(content, fg_color="transparent")
        right.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        right.grid_columnconfigure(0, weight=1)
        right.grid_rowconfigure(1, weight=1)

        self._chart_frame = ctk.CTkFrame(right, fg_color=BG_SURFACE, corner_radius=12,
                                          border_width=1, border_color=BORDER, height=250)
        self._chart_frame.grid(row=0, column=0, sticky="ew")
        self._chart_frame.grid_propagate(False)
        ctk.CTkLabel(self._chart_frame, text="📊  Kategori Stok Dağılımı",
                     font=("Inter", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 0))

        ai_frame = ctk.CTkFrame(right, fg_color="transparent")
        ai_frame.grid(row=1, column=0, sticky="nsew", pady=(12, 0))
        ai_frame.grid_columnconfigure(0, weight=1)
        ai_frame.grid_rowconfigure(1, weight=1)

        ctk.CTkButton(ai_frame, text="🤖  AI Stok Analizi", height=40,
                       command=self._run_ai).grid(
            row=0, column=0, sticky="ew", pady=(0, 8))
        self._ai_box = AIResponseBox(ai_frame)
        self._ai_box.grid(row=1, column=0, sticky="nsew")

        self.load_data()

    def load_data(self):
        for c in self._charts:
            try:
                c.get_tk_widget().destroy()
            except Exception:
                pass
        self._charts.clear()

        stock_val = db.get_stock_value()
        low_stock = db.get_low_stock_products()
        all_products = db.get_all_products()

        cost = stock_val.get("total_cost") or 0
        retail = stock_val.get("total_retail") or 0
        profit = retail - cost

        self._cost_card.update_value(f"₺{cost:,.0f}")
        self._retail_card.update_value(f"₺{retail:,.0f}")
        self._profit_card.update_value(f"₺{profit:,.0f}")
        self._low_card.update_value(str(len(low_stock)))

        # Kritik stok tablosu
        for w in self._low_scroll.winfo_children():
            w.destroy()

        for r, p in enumerate(low_stock):
            deficit = p["min_stock"] - p["stock"]
            bg = BG_SURFACE if r % 2 == 0 else BG_SURFACE2
            row_f = ctk.CTkFrame(self._low_scroll, fg_color=bg, corner_radius=4)
            row_f.pack(fill="x", pady=1)

            cells = [
                (p["name"][:26], 200, TEXT_PRIMARY),
                (p["category"], 110, TEXT_MUTED),
                (str(p["stock"]), 70, DANGER if p["stock"] == 0 else WARNING),
                (str(p["min_stock"]), 60, TEXT_MUTED),
                (str(deficit), 60, DANGER),
            ]
            for txt, w, col in cells:
                ctk.CTkLabel(row_f, text=txt, font=("Inter", 10),
                             text_color=col, width=w).pack(side="left", padx=6, pady=5)

            ctk.CTkButton(row_f, text="📥 Sipariş", width=85, height=24,
                           fg_color=ACCENT, hover_color=ACCENT_HOVER,
                           font=("Inter", 9),
                           command=lambda pid=p["id"], d=deficit: self._reorder(pid, d)
                           ).pack(side="left", padx=4)

        # Kategori stok bar grafiği
        cat_stock = {}
        for p in all_products:
            cat = p["category"]
            if cat not in cat_stock:
                cat_stock[cat] = 0
            cat_stock[cat] += p["stock"]

        if cat_stock:
            labels = list(cat_stock.keys())
            vals = list(cat_stock.values())
            fig = create_bar_chart(labels, vals, ylabel="Birim", color_index=1)
            canvas = embed_chart(fig, self._chart_frame)
            canvas.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=(0, 8))
            self._charts.append(canvas)

    def _reorder(self, product_id: int, deficit: int):
        dialog = ctk.CTkToplevel(self)
        dialog.title("Stok Güncelle")
        dialog.geometry("360x240")
        dialog.configure(fg_color=BG_DARK)
        dialog.grab_set()
        ctk.CTkLabel(dialog, text="📥  Stok Güncelleme",
                     font=("Inter", 14, "bold")).pack(padx=20, pady=(20, 8), anchor="w")
        ctk.CTkLabel(dialog, text=f"Önerilen sipariş miktarı: {max(deficit, 20)} adet",
                     text_color=TEXT_MUTED).pack(padx=20, anchor="w")

        ctk.CTkLabel(dialog, text="Eklenecek Miktar:", font=("Inter", 11),
                     text_color=TEXT_MUTED).pack(padx=20, pady=(12, 4), anchor="w")
        qty_entry = ctk.CTkEntry(dialog, width=320)
        qty_entry.insert(0, str(max(deficit, 20)))
        qty_entry.pack(padx=20)

        def confirm():
            try:
                qty = int(qty_entry.get())
                db.update_stock(product_id, qty, "giriş", "Sipariş alındı")
                dialog.destroy()
                self.load_data()
            except ValueError:
                pass

        btn_f = ctk.CTkFrame(dialog, fg_color="transparent")
        btn_f.pack(pady=16)
        ctk.CTkButton(btn_f, text="✅  Onayla", command=confirm).pack(side="left")
        ctk.CTkButton(btn_f, text="İptal", fg_color=BG_SURFACE2,
                       command=dialog.destroy).pack(side="left", padx=(8, 0))

    def _run_ai(self):
        self._ai_box.clear()
        self._ai_box.set_loading(True)
        self._ai_box.append_text("⏳ AI stok analizi başlatılıyor...\n\n")

        def worker():
            low_stock = db.get_low_stock_products()
            stock_val = db.get_stock_value()
            all_products = db.get_all_products()
            result = ai_engine.analyze_inventory(
                low_stock, stock_val, all_products,
                on_chunk=lambda t: self.after(0, self._ai_box.append_text, t)
            )
            db.save_analysis("inventory", "Stok analizi", result)
            self.after(0, self._ai_box.set_loading, False)

        threading.Thread(target=worker, daemon=True).start()
