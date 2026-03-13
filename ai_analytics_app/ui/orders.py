"""
Sipariş Yönetimi paneli
"""
import customtkinter as ctk
from datetime import datetime
from ui.theme import *
from ui.widgets import SectionHeader, StatCard
import database as db


class OrdersPanel(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=BG_DARK, **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)
        self._all_orders = []
        self._build_ui()

    def _build_ui(self):
        # Başlık
        top = ctk.CTkFrame(self, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=24, pady=(24, 0))
        top.grid_columnconfigure(3, weight=1)
        SectionHeader(top, "Sipariş Yönetimi", "Tüm siparişler ve takip", "🛒").grid(
            row=0, column=0, sticky="w")

        self._search_var = ctk.StringVar()
        search = ctk.CTkEntry(top, placeholder_text="🔍 Sipariş/Müşteri ara...",
                               width=220, textvariable=self._search_var)
        search.grid(row=0, column=3, sticky="e", padx=(0, 8))
        search.bind("<KeyRelease>", lambda e: self._filter_orders())

        self._status_var = ctk.StringVar(value="Tümü")
        ctk.CTkOptionMenu(top, variable=self._status_var, width=140,
                           values=["Tümü", "Beklemede", "Hazırlanıyor",
                                   "Kargoda", "Teslim Edildi", "İptal"],
                           command=lambda _: self._filter_orders()).grid(row=0, column=4, padx=(0, 8))

        ctk.CTkButton(top, text="➕  Yeni Sipariş", width=140,
                       command=self._new_order).grid(row=0, column=5)

        # KPI
        kpi_f = ctk.CTkFrame(self, fg_color="transparent")
        kpi_f.grid(row=1, column=0, sticky="ew", padx=24, pady=(14, 0))
        for i in range(4):
            kpi_f.grid_columnconfigure(i, weight=1, uniform="kpi")

        self._total_card   = StatCard(kpi_f, "Toplam Sipariş",    "0",   "", "🛒", ACCENT)
        self._rev_card     = StatCard(kpi_f, "Tahsil Edilen",     "₺0",  "", "💰", SUCCESS)
        self._pending_card = StatCard(kpi_f, "Bekleyen Ödeme",    "₺0",  "", "⏳", WARNING)
        self._ship_card    = StatCard(kpi_f, "Kargoda",           "0",   "", "🚚", ACCENT3)

        self._total_card.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self._rev_card.grid(row=0, column=1, sticky="ew", padx=(0, 8))
        self._pending_card.grid(row=0, column=2, sticky="ew", padx=(0, 8))
        self._ship_card.grid(row=0, column=3, sticky="ew")

        # Tablo
        table_cont = ctk.CTkFrame(self, fg_color=BG_SURFACE, corner_radius=12,
                                   border_width=1, border_color=BORDER)
        table_cont.grid(row=2, column=0, sticky="nsew", padx=24, pady=(14, 24))
        table_cont.grid_columnconfigure(0, weight=1)
        table_cont.grid_rowconfigure(1, weight=1)

        # Başlık
        hdr = ctk.CTkFrame(table_cont, fg_color=BG_SURFACE3, corner_radius=6)
        hdr.grid(row=0, column=0, sticky="ew", padx=8, pady=(8, 0))
        cols = [("Sipariş No", 130), ("Müşteri", 150), ("Tarih", 130),
                ("Tutar ₺", 90), ("Ödeme", 100), ("Durum", 110),
                ("Ödeme D.", 100), ("Aksiyon", 110)]
        for i, (col, w) in enumerate(cols):
            ctk.CTkLabel(hdr, text=col, font=("Inter", 10, "bold"),
                         text_color=TEXT_MUTED, width=w).grid(row=0, column=i, padx=5, pady=7)

        self._scroll = ctk.CTkScrollableFrame(table_cont, fg_color="transparent",
                                               scrollbar_button_color=BG_SURFACE3)
        self._scroll.grid(row=1, column=0, sticky="nsew", padx=8, pady=4)

        self.load_data()

    def load_data(self):
        self._all_orders = db.get_all_orders()
        stats = db.get_order_stats()
        self._total_card.update_value(str(stats.get("total_orders", 0)))
        self._rev_card.update_value(f"₺{stats.get('total_revenue', 0):,.0f}")
        self._pending_card.update_value(f"₺{stats.get('pending_revenue', 0):,.0f}")
        self._ship_card.update_value(str(stats.get("shipped_orders", 0)))
        self._filter_orders()

    def _filter_orders(self):
        search = self._search_var.get().lower()
        status = self._status_var.get()
        filtered = [
            o for o in self._all_orders
            if (status == "Tümü" or o.get("status") == status)
            and (not search
                 or search in (o.get("order_number") or "").lower()
                 or search in (o.get("customer_name") or "").lower())
        ]
        self._render_table(filtered)

    def _render_table(self, orders: list):
        for w in self._scroll.winfo_children():
            w.destroy()

        status_colors = {
            "Teslim Edildi": SUCCESS,
            "Kargoda": ACCENT3,
            "Hazırlanıyor": WARNING,
            "Beklemede": TEXT_MUTED,
            "İptal": DANGER,
        }
        pay_colors = {"Ödendi": SUCCESS, "Beklemede": WARNING, "İade": DANGER}

        for r, o in enumerate(orders):
            bg = BG_SURFACE if r % 2 == 0 else BG_SURFACE2
            row_f = ctk.CTkFrame(self._scroll, fg_color=bg, corner_radius=4)
            row_f.pack(fill="x", pady=1)

            date_str = str(o.get("order_date", ""))[:10]
            status = o.get("status", "")
            pay_status = o.get("payment_status", "")

            cells = [
                (o.get("order_number", ""), 130, ACCENT),
                ((o.get("customer_name") or "Bilinmiyor")[:20], 150, TEXT_PRIMARY),
                (date_str, 130, TEXT_MUTED),
                (f"₺{o.get('net_amount', 0):,.0f}", 90, TEXT_PRIMARY),
                (o.get("payment_method", ""), 100, TEXT_MUTED),
                (status, 110, status_colors.get(status, TEXT_MUTED)),
                (pay_status, 100, pay_colors.get(pay_status, TEXT_MUTED)),
            ]
            for txt, w, col in cells:
                ctk.CTkLabel(row_f, text=txt, font=("Inter", 10),
                             text_color=col, width=w).pack(side="left", padx=5, pady=5)

            detail_btn = ctk.CTkButton(
                row_f, text="📋 Detay", width=55, height=24,
                fg_color=BG_SURFACE3, hover_color=ACCENT,
                text_color=TEXT_PRIMARY, font=("Inter", 9),
                command=lambda oid=o["id"]: self._show_order_detail(oid)
            )
            detail_btn.pack(side="left", padx=2)

            status_btn = ctk.CTkButton(
                row_f, text="✏️ Güncelle", width=75, height=24,
                fg_color=BG_SURFACE3, hover_color=ACCENT2,
                text_color=TEXT_PRIMARY, font=("Inter", 9),
                command=lambda oid=o["id"], st=status: self._update_status_dialog(oid, st)
            )
            status_btn.pack(side="left", padx=2)

    def _show_order_detail(self, order_id: int):
        order = next((o for o in self._all_orders if o["id"] == order_id), None)
        if not order:
            return

        dlg = ctk.CTkToplevel(self)
        dlg.title(f"Sipariş Detayı - {order.get('order_number')}")
        dlg.geometry("620x600")
        dlg.configure(fg_color=BG_DARK)
        dlg.grab_set()

        scroll = ctk.CTkScrollableFrame(dlg, fg_color=BG_DARK)
        scroll.pack(fill="both", expand=True, padx=16, pady=16)

        # Başlık
        ctk.CTkLabel(scroll, text=f"📋  {order.get('order_number')}",
                     font=("Inter", 18, "bold"), text_color=ACCENT).pack(anchor="w", pady=(0, 16))

        # Sipariş bilgileri
        info_frame = ctk.CTkFrame(scroll, fg_color=BG_SURFACE, corner_radius=10)
        info_frame.pack(fill="x", pady=(0, 12))

        info_items = [
            ("👤 Müşteri", order.get("customer_name") or "-"),
            ("📅 Tarih", str(order.get("order_date", ""))[:16]),
            ("📦 Durum", order.get("status", "")),
            ("💳 Ödeme Yöntemi", order.get("payment_method", "")),
            ("✅ Ödeme Durumu", order.get("payment_status", "")),
            ("📍 Teslimat Adresi", order.get("shipping_address") or "-"),
            ("📝 Notlar", order.get("notes") or "-"),
        ]

        for label, value in info_items:
            row = ctk.CTkFrame(info_frame, fg_color="transparent")
            row.pack(fill="x", padx=16, pady=4)
            ctk.CTkLabel(row, text=label, font=("Inter", 11),
                         text_color=TEXT_MUTED, width=150, anchor="w").pack(side="left")
            ctk.CTkLabel(row, text=value, font=("Inter", 11),
                         text_color=TEXT_PRIMARY, anchor="w").pack(side="left")

        # Ürün listesi
        ctk.CTkLabel(scroll, text="🛍️  Sipariş Kalemleri",
                     font=("Inter", 13, "bold")).pack(anchor="w", pady=(12, 6))

        items_frame = ctk.CTkFrame(scroll, fg_color=BG_SURFACE, corner_radius=10)
        items_frame.pack(fill="x", pady=(0, 12))

        hdr = ctk.CTkFrame(items_frame, fg_color=BG_SURFACE3, corner_radius=6)
        hdr.pack(fill="x", padx=8, pady=(8, 0))
        for col, w in [("Ürün", 200), ("Adet", 60), ("Birim Fiyat", 100), ("Toplam", 100)]:
            ctk.CTkLabel(hdr, text=col, font=("Inter", 10, "bold"),
                         text_color=TEXT_MUTED, width=w, anchor="w").pack(side="left", padx=8, pady=6)

        items = db.get_order_items(order_id)
        for item in items:
            row = ctk.CTkFrame(items_frame, fg_color="transparent")
            row.pack(fill="x", padx=8, pady=2)
            for val, w, col in [
                (item.get("product_name", ""), 200, TEXT_PRIMARY),
                (str(item.get("quantity", 0)), 60, TEXT_MUTED),
                (f"₺{item.get('unit_price', 0):,.2f}", 100, TEXT_MUTED),
                (f"₺{item.get('total_price', 0):,.2f}", 100, SUCCESS),
            ]:
                ctk.CTkLabel(row, text=val, font=("Inter", 10),
                             text_color=col, width=w, anchor="w").pack(side="left", padx=8, pady=3)

        # Finansal özet
        ctk.CTkLabel(scroll, text="💰  Finansal Özet",
                     font=("Inter", 13, "bold")).pack(anchor="w", pady=(12, 6))

        fin_frame = ctk.CTkFrame(scroll, fg_color=BG_SURFACE, corner_radius=10)
        fin_frame.pack(fill="x", pady=(0, 12))

        fin_items = [
            ("Ara Toplam", f"₺{order.get('total_amount', 0):,.2f}"),
            ("İndirim", f"-₺{order.get('discount', 0):,.2f}"),
            (f"KDV (%{order.get('tax_rate', 18):.0f})", f"₺{order.get('tax_amount', 0):,.2f}"),
            ("Genel Toplam", f"₺{order.get('net_amount', 0):,.2f}"),
        ]
        for label, value in fin_items:
            row = ctk.CTkFrame(fin_frame, fg_color="transparent")
            row.pack(fill="x", padx=16, pady=3)
            bold = label == "Genel Toplam"
            ctk.CTkLabel(row, text=label, font=("Inter", 11, "bold" if bold else "normal"),
                         text_color=TEXT_MUTED if not bold else TEXT_BRIGHT,
                         width=200, anchor="w").pack(side="left")
            ctk.CTkLabel(row, text=value, font=("Inter", 11, "bold" if bold else "normal"),
                         text_color=SUCCESS if bold else TEXT_PRIMARY).pack(side="left")
        ctk.CTkFrame(fin_frame, height=8, fg_color="transparent").pack()

        ctk.CTkButton(scroll, text="✕  Kapat", fg_color=BG_SURFACE2,
                       hover_color=BG_SURFACE3, text_color=TEXT_PRIMARY,
                       command=dlg.destroy).pack(pady=8)

    def _update_status_dialog(self, order_id: int, current_status: str):
        dlg = ctk.CTkToplevel(self)
        dlg.title("Sipariş Güncelle")
        dlg.geometry("360x260")
        dlg.configure(fg_color=BG_DARK)
        dlg.grab_set()

        ctk.CTkLabel(dlg, text="✏️  Sipariş Durumu Güncelle",
                     font=("Inter", 14, "bold")).pack(padx=24, pady=(20, 12), anchor="w")

        ctk.CTkLabel(dlg, text="Durum:", font=("Inter", 11),
                     text_color=TEXT_MUTED).pack(padx=24, pady=(6, 2), anchor="w")
        status_var = ctk.StringVar(value=current_status)
        ctk.CTkOptionMenu(dlg, variable=status_var, width=312,
                           values=["Beklemede", "Hazırlanıyor", "Kargoda",
                                   "Teslim Edildi", "İptal"]).pack(padx=24)

        ctk.CTkLabel(dlg, text="Ödeme Durumu:", font=("Inter", 11),
                     text_color=TEXT_MUTED).pack(padx=24, pady=(10, 2), anchor="w")
        pay_var = ctk.StringVar(value="Ödendi")
        ctk.CTkOptionMenu(dlg, variable=pay_var, width=312,
                           values=["Ödendi", "Beklemede", "İade"]).pack(padx=24)

        def save():
            db.update_order_status(order_id, status_var.get(), pay_var.get())
            dlg.destroy()
            self.load_data()

        btn_f = ctk.CTkFrame(dlg, fg_color="transparent")
        btn_f.pack(pady=16)
        ctk.CTkButton(btn_f, text="💾  Kaydet", command=save).pack(side="left")
        ctk.CTkButton(btn_f, text="İptal", fg_color=BG_SURFACE2,
                       command=dlg.destroy).pack(side="left", padx=(8, 0))

    def _new_order(self):
        dlg = ctk.CTkToplevel(self)
        dlg.title("Yeni Sipariş")
        dlg.geometry("700x680")
        dlg.configure(fg_color=BG_DARK)
        dlg.grab_set()

        scroll = ctk.CTkScrollableFrame(dlg, fg_color=BG_DARK)
        scroll.pack(fill="both", expand=True, padx=0, pady=0)

        ctk.CTkLabel(scroll, text="🛒  Yeni Sipariş Oluştur",
                     font=("Inter", 16, "bold")).pack(padx=24, pady=(20, 12), anchor="w")

        # Müşteri seçimi
        customers = db.get_all_customers()
        cust_names = [f"{c['name']} - {c.get('city','')}" for c in customers]
        ctk.CTkLabel(scroll, text="Müşteri *", font=("Inter", 11),
                     text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(6, 2))
        cust_var = ctk.StringVar()
        cust_combo = ctk.CTkComboBox(scroll, values=cust_names, variable=cust_var, width=640)
        cust_combo.pack(padx=24)

        # Ürün ekleme
        ctk.CTkLabel(scroll, text="Ürünler *", font=("Inter", 11, "bold")).pack(
            anchor="w", padx=24, pady=(16, 6))

        products = db.get_all_products()
        product_names = [f"{p['name']} (₺{p['sell_price']:,.0f})" for p in products]
        cart_items = []

        cart_frame = ctk.CTkFrame(scroll, fg_color=BG_SURFACE, corner_radius=10)
        cart_frame.pack(fill="x", padx=24, pady=(0, 8))

        cart_scroll = ctk.CTkScrollableFrame(cart_frame, fg_color="transparent", height=150)
        cart_scroll.pack(fill="x", padx=8, pady=8)
        total_label = ctk.CTkLabel(cart_frame, text="Toplam: ₺0",
                                    font=("Inter", 12, "bold"), text_color=SUCCESS)
        total_label.pack(anchor="e", padx=12, pady=(0, 8))

        def refresh_cart():
            for w in cart_scroll.winfo_children():
                w.destroy()
            total = 0
            for item in cart_items:
                row = ctk.CTkFrame(cart_scroll, fg_color=BG_SURFACE2, corner_radius=4)
                row.pack(fill="x", pady=2)
                ctk.CTkLabel(row, text=item["product_name"][:30], font=("Inter", 10),
                             text_color=TEXT_PRIMARY, width=220, anchor="w").pack(side="left", padx=8)
                ctk.CTkLabel(row, text=f"x{item['quantity']}", font=("Inter", 10),
                             text_color=TEXT_MUTED, width=40).pack(side="left")
                ctk.CTkLabel(row, text=f"₺{item['total_price']:,.0f}", font=("Inter", 10),
                             text_color=SUCCESS, width=80).pack(side="left")
                ctk.CTkButton(row, text="✕", width=24, height=20, fg_color=DANGER,
                               command=lambda it=item: (cart_items.remove(it), refresh_cart())
                               ).pack(side="right", padx=4)
                total += item["total_price"]
            total_label.configure(text=f"Toplam: ₺{total:,.2f}")

        add_row = ctk.CTkFrame(scroll, fg_color="transparent")
        add_row.pack(fill="x", padx=24, pady=(0, 12))
        prod_var = ctk.StringVar()
        ctk.CTkComboBox(add_row, values=product_names, variable=prod_var, width=380).pack(side="left")
        qty_entry = ctk.CTkEntry(add_row, placeholder_text="Adet", width=80)
        qty_entry.pack(side="left", padx=(8, 0))
        qty_entry.insert(0, "1")

        def add_to_cart():
            sel = prod_var.get()
            if not sel:
                return
            idx = product_names.index(sel) if sel in product_names else -1
            if idx < 0:
                return
            p = products[idx]
            try:
                qty = int(qty_entry.get())
            except ValueError:
                qty = 1
            cart_items.append({
                "product_id": p["id"],
                "product_name": p["name"],
                "quantity": qty,
                "unit_price": p["sell_price"],
                "total_price": p["sell_price"] * qty
            })
            refresh_cart()

        ctk.CTkButton(add_row, text="➕ Ekle", width=80,
                       command=add_to_cart).pack(side="left", padx=(8, 0))

        # Diğer alanlar
        fields = {}
        for key, label, default in [
            ("discount", "İndirim ₺", "0"),
            ("shipping_address", "Teslimat Adresi", ""),
            ("notes", "Notlar", ""),
        ]:
            ctk.CTkLabel(scroll, text=label, font=("Inter", 11),
                         text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(6, 2))
            entry = ctk.CTkEntry(scroll, width=640)
            entry.insert(0, default)
            entry.pack(padx=24)
            fields[key] = entry

        ctk.CTkLabel(scroll, text="Ödeme Yöntemi", font=("Inter", 11),
                     text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(6, 2))
        pay_var = ctk.StringVar(value="Kredi Kartı")
        ctk.CTkOptionMenu(scroll, variable=pay_var, width=640,
                           values=["Nakit", "Kredi Kartı", "Havale/EFT", "Kapıda Ödeme"]
                           ).pack(padx=24)

        def save_order():
            if not cart_items:
                return
            try:
                cust_sel = cust_var.get()
                cust_idx = cust_names.index(cust_sel) if cust_sel in cust_names else -1
                cust_id = customers[cust_idx]["id"] if cust_idx >= 0 else None
                cust_name = customers[cust_idx]["name"] if cust_idx >= 0 else "Bilinmiyor"

                subtotal = sum(i["total_price"] for i in cart_items)
                discount = float(fields["discount"].get() or 0)
                tax_rate = 18.0
                tax_amount = round((subtotal - discount) * tax_rate / 100, 2)
                net_amount = round(subtotal - discount + tax_amount, 2)

                order_num = f"SIP-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
                order_data = {
                    "order_number": order_num,
                    "customer_id": cust_id,
                    "customer_name": cust_name,
                    "total_amount": subtotal,
                    "discount": discount,
                    "tax_rate": tax_rate,
                    "tax_amount": tax_amount,
                    "net_amount": net_amount,
                    "status": "Beklemede",
                    "payment_method": pay_var.get(),
                    "payment_status": "Beklemede",
                    "shipping_address": fields["shipping_address"].get(),
                    "notes": fields["notes"].get(),
                    "order_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                }
                db.add_order(order_data, cart_items)
                dlg.destroy()
                self.load_data()
            except Exception as e:
                ctk.CTkLabel(scroll, text=f"❌ Hata: {e}",
                             text_color=DANGER).pack(pady=4)

        btn_f = ctk.CTkFrame(scroll, fg_color="transparent")
        btn_f.pack(pady=16)
        ctk.CTkButton(btn_f, text="💾  Sipariş Oluştur", command=save_order).pack(side="left")
        ctk.CTkButton(btn_f, text="İptal", fg_color=BG_SURFACE2,
                       command=dlg.destroy).pack(side="left", padx=(8, 0))
