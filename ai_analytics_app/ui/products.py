"""
Ürünler paneli - ürün yönetimi ve AI analizi
"""
import customtkinter as ctk
import threading
from ui.theme import *
from ui.widgets import SectionHeader, AIResponseBox
from utils.charts import embed_chart, create_bar_chart, create_donut_chart
import database as db
import ai_engine


class ProductsPanel(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=BG_DARK, **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        self._charts = []
        self._all_products = []
        self._build_ui()

    def _build_ui(self):
        # Başlık
        top = ctk.CTkFrame(self, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=24, pady=(24, 0))
        top.grid_columnconfigure(2, weight=1)

        SectionHeader(top, "Ürün Analizi", "Ürün performansı ve yönetimi", "📦").grid(
            row=0, column=0, sticky="w")

        # Filtre
        self._search_var = ctk.StringVar()
        search = ctk.CTkEntry(top, placeholder_text="🔍 Ürün ara...", width=200,
                               textvariable=self._search_var)
        search.grid(row=0, column=2, sticky="e", padx=(0, 8))
        search.bind("<KeyRelease>", lambda e: self._filter_products())

        self._category_var = ctk.StringVar(value="Tümü")
        self._cat_menu = ctk.CTkOptionMenu(top, variable=self._category_var,
                                            values=["Tümü"], width=140,
                                            command=lambda _: self._filter_products())
        self._cat_menu.grid(row=0, column=3, padx=(0, 8))

        add_btn = ctk.CTkButton(top, text="➕  Ürün Ekle", width=130,
                                 command=self._open_add_dialog)
        add_btn.grid(row=0, column=4)

        # Ana split: tablo sol | grafikler+AI sağ
        split = ctk.CTkFrame(self, fg_color="transparent")
        split.grid(row=1, column=0, sticky="nsew", padx=24, pady=(16, 24))
        split.grid_columnconfigure(0, weight=3)
        split.grid_columnconfigure(1, weight=2)
        split.grid_rowconfigure(0, weight=1)

        # ── Sol: Tablo ─────────────────────────────────────────────────────────
        left = ctk.CTkFrame(split, fg_color=BG_SURFACE, corner_radius=12,
                             border_width=1, border_color=BORDER)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        left.grid_rowconfigure(1, weight=1)
        left.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(left, text="📋  Ürün Listesi",
                     font=("Inter", 12, "bold")).grid(
            row=0, column=0, sticky="w", padx=16, pady=(12, 0))

        # Tablo başlıkları
        cols = ["Ürün Adı", "Kategori", "SKU", "Alış ₺", "Satış ₺", "Stok", "Marj%", "Aksiyon"]
        header_frame = ctk.CTkFrame(left, fg_color=BG_SURFACE3, corner_radius=6)
        header_frame.grid(row=1, column=0, sticky="ew", padx=8, pady=(8, 0))
        widths = [200, 100, 90, 70, 70, 60, 60, 80]
        for i, (col, w) in enumerate(zip(cols, widths)):
            ctk.CTkLabel(header_frame, text=col, font=("Inter", 10, "bold"),
                         text_color=TEXT_MUTED, width=w, anchor="w").grid(
                row=0, column=i, padx=6, pady=6)

        # Scrollable rows
        self._table_scroll = ctk.CTkScrollableFrame(left, fg_color="transparent",
                                                      scrollbar_button_color=BG_SURFACE3)
        self._table_scroll.grid(row=2, column=0, sticky="nsew", padx=8, pady=4)
        left.grid_rowconfigure(2, weight=1)

        # ── Sağ: Grafikler + AI ────────────────────────────────────────────────
        right = ctk.CTkFrame(split, fg_color="transparent")
        right.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        right.grid_columnconfigure(0, weight=1)
        right.grid_rowconfigure(2, weight=1)

        # Top ürünler grafiği
        self._chart_frame = ctk.CTkFrame(right, fg_color=BG_SURFACE,
                                          corner_radius=12, border_width=1,
                                          border_color=BORDER, height=280)
        self._chart_frame.grid(row=0, column=0, sticky="ew")
        self._chart_frame.grid_propagate(False)
        ctk.CTkLabel(self._chart_frame, text="🏆  En Çok Satan Ürünler",
                     font=("Inter", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 0))

        # Kategori pasta
        self._cat_chart_frame = ctk.CTkFrame(right, fg_color=BG_SURFACE,
                                              corner_radius=12, border_width=1,
                                              border_color=BORDER, height=250)
        self._cat_chart_frame.grid(row=1, column=0, sticky="ew", pady=(12, 0))
        self._cat_chart_frame.grid_propagate(False)
        ctk.CTkLabel(self._cat_chart_frame, text="🗂️  Kategori Gelir Dağılımı",
                     font=("Inter", 12, "bold")).pack(anchor="w", padx=14, pady=(12, 0))

        # AI Analiz
        ai_section = ctk.CTkFrame(right, fg_color="transparent")
        ai_section.grid(row=2, column=0, sticky="nsew", pady=(12, 0))
        ai_section.grid_columnconfigure(0, weight=1)
        ai_section.grid_rowconfigure(1, weight=1)

        ai_btn = ctk.CTkButton(ai_section, text="🤖  AI Ürün Analizi Yap",
                                height=40, command=self._run_ai_analysis)
        ai_btn.grid(row=0, column=0, sticky="ew", pady=(0, 8))

        self._ai_box = AIResponseBox(ai_section)
        self._ai_box.grid(row=1, column=0, sticky="nsew")

        self.load_data()

    def load_data(self):
        self._all_products = db.get_all_products()

        # Kategorileri güncelle
        cats = ["Tümü"] + sorted({p["category"] for p in self._all_products})
        self._cat_menu.configure(values=cats)

        self._filter_products()
        self._refresh_charts()

    def _filter_products(self):
        search = self._search_var.get().lower()
        cat_filter = self._category_var.get()

        filtered = [
            p for p in self._all_products
            if (cat_filter == "Tümü" or p["category"] == cat_filter)
            and (not search or search in p["name"].lower() or search in p["sku"].lower())
        ]
        self._render_table(filtered)

    def _render_table(self, products: list):
        for w in self._table_scroll.winfo_children():
            w.destroy()

        for r, p in enumerate(products):
            margin = ((p["sell_price"] - p["buy_price"]) / max(p["sell_price"], 1)) * 100
            low = p["stock"] <= p["min_stock"]
            stock_color = DANGER if low else SUCCESS

            bg = BG_SURFACE if r % 2 == 0 else BG_SURFACE2
            row_frame = ctk.CTkFrame(self._table_scroll, fg_color=bg, corner_radius=4)
            row_frame.pack(fill="x", pady=1)

            cells = [
                (p["name"][:28], 200, TEXT_PRIMARY),
                (p["category"], 100, TEXT_MUTED),
                (p["sku"], 90, TEXT_MUTED),
                (f"₺{p['buy_price']:,.0f}", 70, TEXT_MUTED),
                (f"₺{p['sell_price']:,.0f}", 70, SUCCESS),
                (str(p["stock"]), 60, stock_color),
                (f"%{margin:.0f}", 60, SUCCESS if margin >= 20 else WARNING),
            ]
            for txt, w, col in cells:
                ctk.CTkLabel(row_frame, text=txt, font=("Inter", 10),
                             text_color=col, width=w, anchor="w").pack(
                    side="left", padx=6, pady=5)

            edit_btn = ctk.CTkButton(row_frame, text="✏️", width=32, height=24,
                                      fg_color=BG_SURFACE3, hover_color=ACCENT,
                                      text_color=TEXT_PRIMARY,
                                      command=lambda pid=p["id"]: self._open_edit_dialog(pid))
            edit_btn.pack(side="left", padx=2)

            del_btn = ctk.CTkButton(row_frame, text="🗑️", width=32, height=24,
                                     fg_color=BG_SURFACE3, hover_color=DANGER,
                                     text_color=TEXT_PRIMARY,
                                     command=lambda pid=p["id"]: self._delete_product(pid))
            del_btn.pack(side="left", padx=2)

    def _refresh_charts(self):
        for c in self._charts:
            try:
                c.get_tk_widget().destroy()
            except Exception:
                pass
        self._charts.clear()

        top = db.get_top_products(8)
        if top:
            names = [p["name"][:18] for p in top]
            revs = [p["revenue"] or 0 for p in top]
            fig = create_bar_chart(names, revs, horizontal=True, ylabel="₺")
            canvas = embed_chart(fig, self._chart_frame)
            canvas.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=(0, 8))
            self._charts.append(canvas)

        summary = db.get_sales_summary(30)
        cats = summary.get("by_category", [])[:6]
        if cats:
            labels = [c["category"] for c in cats]
            vals = [c["revenue"] or 0 for c in cats]
            fig = create_donut_chart(labels, vals)
            canvas = embed_chart(fig, self._cat_chart_frame)
            canvas.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=(0, 8))
            self._charts.append(canvas)

    def _run_ai_analysis(self):
        self._ai_box.clear()
        self._ai_box.set_loading(True)
        self._ai_box.append_text("⏳ AI analizi başlatılıyor...\n\n")

        def worker():
            products = db.get_all_products()
            top = db.get_top_products(10)
            result = ai_engine.analyze_products(
                products, top,
                on_chunk=lambda text: self.after(0, self._ai_box.append_text, text)
            )
            db.save_analysis("products", "Ürün analizi", result)
            self.after(0, self._ai_box.set_loading, False)

        threading.Thread(target=worker, daemon=True).start()

    def _open_add_dialog(self):
        self._open_product_dialog(None)

    def _open_edit_dialog(self, product_id: int):
        product = next((p for p in self._all_products if p["id"] == product_id), None)
        self._open_product_dialog(product)

    def _open_product_dialog(self, product):
        dialog = ctk.CTkToplevel(self)
        dialog.title("Ürün Ekle" if not product else "Ürün Düzenle")
        dialog.geometry("480x560")
        dialog.configure(fg_color=BG_DARK)
        dialog.grab_set()

        ctk.CTkLabel(dialog, text="📦  Ürün Bilgileri" if not product else "✏️  Ürün Düzenle",
                     font=("Inter", 16, "bold")).pack(padx=24, pady=(20, 16), anchor="w")

        fields = {}
        field_defs = [
            ("name", "Ürün Adı *"),
            ("category", "Kategori *"),
            ("sku", "SKU *"),
            ("buy_price", "Alış Fiyatı ₺ *"),
            ("sell_price", "Satış Fiyatı ₺ *"),
            ("stock", "Stok Miktarı *"),
            ("min_stock", "Min. Stok *"),
            ("supplier", "Tedarikçi"),
        ]

        for key, label in field_defs:
            ctk.CTkLabel(dialog, text=label, font=("Inter", 11),
                         text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(8, 2))
            entry = ctk.CTkEntry(dialog, width=430)
            entry.pack(padx=24)
            if product and product.get(key) is not None:
                entry.insert(0, str(product[key]))
            fields[key] = entry

        def save():
            try:
                data = {
                    "name": fields["name"].get(),
                    "category": fields["category"].get(),
                    "sku": fields["sku"].get(),
                    "buy_price": float(fields["buy_price"].get()),
                    "sell_price": float(fields["sell_price"].get()),
                    "stock": int(fields["stock"].get()),
                    "min_stock": int(fields["min_stock"].get()),
                    "supplier": fields["supplier"].get(),
                }
                if product:
                    db.update_product(product["id"], data)
                else:
                    db.add_product(data)
                dialog.destroy()
                self.load_data()
            except ValueError as e:
                ctk.CTkLabel(dialog, text=f"❌ Hata: {e}",
                             text_color=DANGER).pack(pady=4)

        btn_frame = ctk.CTkFrame(dialog, fg_color="transparent")
        btn_frame.pack(fill="x", padx=24, pady=(16, 20))
        ctk.CTkButton(btn_frame, text="💾  Kaydet", command=save).pack(side="left")
        ctk.CTkButton(btn_frame, text="İptal", fg_color=BG_SURFACE2,
                       hover_color=BG_SURFACE3, text_color=TEXT_MUTED,
                       command=dialog.destroy).pack(side="left", padx=(8, 0))

    def _delete_product(self, product_id: int):
        confirm = ctk.CTkToplevel(self)
        confirm.title("Onay")
        confirm.geometry("360x160")
        confirm.configure(fg_color=BG_DARK)
        confirm.grab_set()
        ctk.CTkLabel(confirm, text="🗑️  Bu ürünü silmek istediğinizden emin misiniz?",
                     font=("Inter", 12), wraplength=320).pack(pady=30)
        btn_f = ctk.CTkFrame(confirm, fg_color="transparent")
        btn_f.pack()
        ctk.CTkButton(btn_f, text="Evet, Sil", fg_color=DANGER, hover_color="#c0392b",
                       command=lambda: [db.delete_product(product_id),
                                        confirm.destroy(), self.load_data()]).pack(side="left")
        ctk.CTkButton(btn_f, text="İptal", fg_color=BG_SURFACE2,
                       command=confirm.destroy).pack(side="left", padx=(8, 0))
