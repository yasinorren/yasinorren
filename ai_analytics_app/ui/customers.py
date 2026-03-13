"""
Müşteri Yönetimi paneli
"""
import customtkinter as ctk
from ui.theme import *
from ui.widgets import SectionHeader, StatCard
import database as db


class CustomersPanel(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=BG_DARK, **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)
        self._all_customers = []
        self._build_ui()

    def _build_ui(self):
        # Başlık
        top = ctk.CTkFrame(self, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=24, pady=(24, 0))
        top.grid_columnconfigure(2, weight=1)
        SectionHeader(top, "Müşteri Yönetimi", "Müşteri bilgileri ve sipariş geçmişi", "👥").grid(
            row=0, column=0, sticky="w")

        self._search_var = ctk.StringVar()
        search = ctk.CTkEntry(top, placeholder_text="🔍 Müşteri ara...", width=200,
                               textvariable=self._search_var)
        search.grid(row=0, column=2, sticky="e", padx=(0, 8))
        search.bind("<KeyRelease>", lambda e: self._filter())

        self._type_var = ctk.StringVar(value="Tümü")
        ctk.CTkOptionMenu(top, variable=self._type_var, width=130,
                           values=["Tümü", "Bireysel", "Kurumsal"],
                           command=lambda _: self._filter()).grid(row=0, column=3, padx=(0, 8))

        ctk.CTkButton(top, text="➕  Müşteri Ekle", width=140,
                       command=self._add_dialog).grid(row=0, column=4)

        # KPI
        kpi_f = ctk.CTkFrame(self, fg_color="transparent")
        kpi_f.grid(row=1, column=0, sticky="ew", padx=24, pady=(14, 0))
        for i in range(4):
            kpi_f.grid_columnconfigure(i, weight=1, uniform="kpi")

        self._total_card    = StatCard(kpi_f, "Toplam Müşteri",   "0",   "", "👥", ACCENT)
        self._corp_card     = StatCard(kpi_f, "Kurumsal",         "0",   "", "🏢", ACCENT2)
        self._revenue_card  = StatCard(kpi_f, "En Yüksek Harcama","₺0",  "", "💰", SUCCESS)
        self._loyal_card    = StatCard(kpi_f, "En Sadık Müşteri", "-",   "", "⭐", WARNING)

        self._total_card.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self._corp_card.grid(row=0, column=1, sticky="ew", padx=(0, 8))
        self._revenue_card.grid(row=0, column=2, sticky="ew", padx=(0, 8))
        self._loyal_card.grid(row=0, column=3, sticky="ew")

        # Tablo
        table_cont = ctk.CTkFrame(self, fg_color=BG_SURFACE, corner_radius=12,
                                   border_width=1, border_color=BORDER)
        table_cont.grid(row=2, column=0, sticky="nsew", padx=24, pady=(14, 24))
        table_cont.grid_columnconfigure(0, weight=1)
        table_cont.grid_rowconfigure(1, weight=1)

        hdr = ctk.CTkFrame(table_cont, fg_color=BG_SURFACE3, corner_radius=6)
        hdr.grid(row=0, column=0, sticky="ew", padx=8, pady=(8, 0))
        cols = [("Ad Soyad", 160), ("Şirket", 140), ("Tip", 80), ("Şehir", 90),
                ("Telefon", 120), ("E-posta", 180), ("Harcama ₺", 100), ("Sipariş", 70), ("Aksiyon", 80)]
        for i, (col, w) in enumerate(cols):
            ctk.CTkLabel(hdr, text=col, font=("Inter", 10, "bold"),
                         text_color=TEXT_MUTED, width=w).grid(row=0, column=i, padx=5, pady=7)

        self._scroll = ctk.CTkScrollableFrame(table_cont, fg_color="transparent",
                                               scrollbar_button_color=BG_SURFACE3)
        self._scroll.grid(row=1, column=0, sticky="nsew", padx=8, pady=4)

        self.load_data()

    def load_data(self):
        self._all_customers = db.get_all_customers()
        total = len(self._all_customers)
        corp = sum(1 for c in self._all_customers if c.get("customer_type") == "Kurumsal")
        max_spent = max((c.get("total_spent_calc") or 0 for c in self._all_customers), default=0)
        loyal = next((c["name"] for c in self._all_customers
                      if (c.get("total_spent_calc") or 0) == max_spent), "-")

        self._total_card.update_value(str(total))
        self._corp_card.update_value(str(corp))
        self._revenue_card.update_value(f"₺{max_spent:,.0f}")
        self._loyal_card.update_value(loyal[:16])
        self._filter()

    def _filter(self):
        search = self._search_var.get().lower()
        type_f = self._type_var.get()
        filtered = [
            c for c in self._all_customers
            if (type_f == "Tümü" or c.get("customer_type") == type_f)
            and (not search
                 or search in (c.get("name") or "").lower()
                 or search in (c.get("email") or "").lower()
                 or search in (c.get("company") or "").lower()
                 or search in (c.get("city") or "").lower())
        ]
        self._render_table(filtered)

    def _render_table(self, customers: list):
        for w in self._scroll.winfo_children():
            w.destroy()

        for r, c in enumerate(customers):
            bg = BG_SURFACE if r % 2 == 0 else BG_SURFACE2
            row_f = ctk.CTkFrame(self._scroll, fg_color=bg, corner_radius=4)
            row_f.pack(fill="x", pady=1)

            spent = c.get("total_spent_calc") or 0
            orders = c.get("order_count_calc") or 0
            type_color = ACCENT2 if c.get("customer_type") == "Kurumsal" else ACCENT3

            cells = [
                (c.get("name", "")[:22], 160, TEXT_PRIMARY),
                ((c.get("company") or "-")[:20], 140, TEXT_MUTED),
                (c.get("customer_type", ""), 80, type_color),
                (c.get("city", ""), 90, TEXT_MUTED),
                (c.get("phone", "") or "-", 120, TEXT_MUTED),
                ((c.get("email") or "-")[:26], 180, TEXT_MUTED),
                (f"₺{spent:,.0f}", 100, SUCCESS if spent > 0 else TEXT_MUTED),
                (str(orders), 70, TEXT_PRIMARY),
            ]
            for txt, w, col in cells:
                ctk.CTkLabel(row_f, text=txt, font=("Inter", 10),
                             text_color=col, width=w).pack(side="left", padx=5, pady=5)

            detail_btn = ctk.CTkButton(
                row_f, text="👁️", width=36, height=24,
                fg_color=BG_SURFACE3, hover_color=ACCENT,
                font=("Inter", 10),
                command=lambda cid=c["id"]: self._show_detail(cid)
            )
            detail_btn.pack(side="left", padx=2)

            edit_btn = ctk.CTkButton(
                row_f, text="✏️", width=30, height=24,
                fg_color=BG_SURFACE3, hover_color=ACCENT2,
                font=("Inter", 10),
                command=lambda cid=c["id"]: self._edit_dialog(cid)
            )
            edit_btn.pack(side="left", padx=2)

    def _show_detail(self, customer_id: int):
        customer = next((c for c in self._all_customers if c["id"] == customer_id), None)
        if not customer:
            return

        dlg = ctk.CTkToplevel(self)
        dlg.title(f"Müşteri Detayı - {customer.get('name')}")
        dlg.geometry("600x620")
        dlg.configure(fg_color=BG_DARK)
        dlg.grab_set()

        scroll = ctk.CTkScrollableFrame(dlg, fg_color=BG_DARK)
        scroll.pack(fill="both", expand=True, padx=16, pady=16)

        # Başlık kartı
        header_card = ctk.CTkFrame(scroll, fg_color=BG_SURFACE2, corner_radius=12)
        header_card.pack(fill="x", pady=(0, 16))
        ctk.CTkLabel(header_card, text=customer.get("name", ""),
                     font=("Inter", 20, "bold"), text_color=TEXT_BRIGHT).pack(
            anchor="w", padx=20, pady=(16, 4))
        if customer.get("company"):
            ctk.CTkLabel(header_card, text=f"🏢 {customer['company']}",
                         font=("Inter", 13), text_color=ACCENT2).pack(anchor="w", padx=20, pady=(0, 4))
        type_color = ACCENT2 if customer.get("customer_type") == "Kurumsal" else ACCENT3
        ctk.CTkLabel(header_card, text=f"● {customer.get('customer_type', 'Bireysel')}",
                     font=("Inter", 11), text_color=type_color).pack(anchor="w", padx=20, pady=(0, 16))

        # İletişim bilgileri
        info_card = ctk.CTkFrame(scroll, fg_color=BG_SURFACE, corner_radius=10)
        info_card.pack(fill="x", pady=(0, 12))
        ctk.CTkLabel(info_card, text="📞  İletişim Bilgileri",
                     font=("Inter", 12, "bold")).pack(anchor="w", padx=16, pady=(12, 8))

        contact_items = [
            ("📧 E-posta", customer.get("email") or "-"),
            ("📱 Telefon", customer.get("phone") or "-"),
            ("📍 Adres", customer.get("address") or "-"),
            ("🏙️ Şehir", customer.get("city") or "-"),
            ("🔢 Vergi No", customer.get("tax_number") or "-"),
        ]
        for label, value in contact_items:
            row = ctk.CTkFrame(info_card, fg_color="transparent")
            row.pack(fill="x", padx=16, pady=3)
            ctk.CTkLabel(row, text=label, font=("Inter", 11), text_color=TEXT_MUTED,
                         width=120, anchor="w").pack(side="left")
            ctk.CTkLabel(row, text=value, font=("Inter", 11),
                         text_color=TEXT_PRIMARY, anchor="w").pack(side="left")
        ctk.CTkFrame(info_card, height=8, fg_color="transparent").pack()

        # Sipariş özeti
        spent = customer.get("total_spent_calc") or 0
        orders_count = customer.get("order_count_calc") or 0

        stats_card = ctk.CTkFrame(scroll, fg_color=BG_SURFACE, corner_radius=10)
        stats_card.pack(fill="x", pady=(0, 12))
        ctk.CTkLabel(stats_card, text="📊  Alışveriş Özeti",
                     font=("Inter", 12, "bold")).pack(anchor="w", padx=16, pady=(12, 8))

        stats_items = [
            ("💰 Toplam Harcama", f"₺{spent:,.2f}", SUCCESS),
            ("🛒 Sipariş Sayısı", str(orders_count), ACCENT),
            ("📦 Ort. Sipariş Değeri",
             f"₺{spent / max(orders_count, 1):,.2f}", ACCENT3),
            ("📅 Kayıt Tarihi", str(customer.get("created_at", ""))[:10], TEXT_MUTED),
        ]
        for label, value, color in stats_items:
            row = ctk.CTkFrame(stats_card, fg_color="transparent")
            row.pack(fill="x", padx=16, pady=3)
            ctk.CTkLabel(row, text=label, font=("Inter", 11), text_color=TEXT_MUTED,
                         width=180, anchor="w").pack(side="left")
            ctk.CTkLabel(row, text=value, font=("Inter", 11, "bold"),
                         text_color=color).pack(side="left")
        ctk.CTkFrame(stats_card, height=8, fg_color="transparent").pack()

        # Son siparişler
        orders = db.get_customer_orders(customer_id)
        ctk.CTkLabel(scroll, text="🛒  Son Siparişler",
                     font=("Inter", 12, "bold")).pack(anchor="w", pady=(8, 6))

        ord_frame = ctk.CTkFrame(scroll, fg_color=BG_SURFACE, corner_radius=10)
        ord_frame.pack(fill="x", pady=(0, 12))

        status_colors = {
            "Teslim Edildi": SUCCESS, "Kargoda": ACCENT3,
            "Beklemede": TEXT_MUTED, "İptal": DANGER
        }

        for i, o in enumerate(orders[:10]):
            bg = BG_SURFACE2 if i % 2 == 0 else "transparent"
            row = ctk.CTkFrame(ord_frame, fg_color=bg, corner_radius=4)
            row.pack(fill="x", padx=8, pady=2)
            ctk.CTkLabel(row, text=o.get("order_number", ""), font=("Inter", 10),
                         text_color=ACCENT, width=130, anchor="w").pack(side="left", padx=8, pady=5)
            ctk.CTkLabel(row, text=str(o.get("order_date", ""))[:10], font=("Inter", 10),
                         text_color=TEXT_MUTED, width=90).pack(side="left")
            ctk.CTkLabel(row, text=f"₺{o.get('net_amount', 0):,.0f}", font=("Inter", 10),
                         text_color=SUCCESS, width=90).pack(side="left")
            status = o.get("status", "")
            ctk.CTkLabel(row, text=status, font=("Inter", 10),
                         text_color=status_colors.get(status, TEXT_MUTED), width=100).pack(side="left")

        ctk.CTkFrame(ord_frame, height=8, fg_color="transparent").pack()

        if customer.get("notes"):
            ctk.CTkLabel(scroll, text="📝  Notlar",
                         font=("Inter", 12, "bold")).pack(anchor="w", pady=(8, 6))
            ctk.CTkTextbox(scroll, height=60, font=("Inter", 11)).pack(fill="x")

        ctk.CTkButton(scroll, text="✕  Kapat", fg_color=BG_SURFACE2,
                       hover_color=BG_SURFACE3, text_color=TEXT_PRIMARY,
                       command=dlg.destroy).pack(pady=12)

    def _add_dialog(self):
        self._customer_dialog(None)

    def _edit_dialog(self, customer_id: int):
        customer = next((c for c in self._all_customers if c["id"] == customer_id), None)
        self._customer_dialog(customer)

    def _customer_dialog(self, customer):
        dlg = ctk.CTkToplevel(self)
        dlg.title("Müşteri Ekle" if not customer else "Müşteri Düzenle")
        dlg.geometry("500x640")
        dlg.configure(fg_color=BG_DARK)
        dlg.grab_set()

        scroll = ctk.CTkScrollableFrame(dlg, fg_color=BG_DARK)
        scroll.pack(fill="both", expand=True, padx=0, pady=0)

        title = "👥  Müşteri Ekle" if not customer else "✏️  Müşteri Düzenle"
        ctk.CTkLabel(scroll, text=title, font=("Inter", 16, "bold")).pack(
            padx=24, pady=(20, 12), anchor="w")

        fields = {}
        field_defs = [
            ("name", "Ad Soyad *", ""),
            ("email", "E-posta", ""),
            ("phone", "Telefon", ""),
            ("company", "Şirket Adı", ""),
            ("tax_number", "Vergi Numarası", ""),
            ("address", "Adres", ""),
            ("city", "Şehir", ""),
            ("notes", "Notlar", ""),
        ]

        for key, label, placeholder in field_defs:
            ctk.CTkLabel(scroll, text=label, font=("Inter", 11),
                         text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(6, 2))
            entry = ctk.CTkEntry(scroll, width=450, placeholder_text=placeholder)
            entry.pack(padx=24)
            if customer and customer.get(key):
                entry.insert(0, str(customer[key]))
            fields[key] = entry

        ctk.CTkLabel(scroll, text="Müşteri Tipi", font=("Inter", 11),
                     text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(6, 2))
        type_var = ctk.StringVar(value=customer.get("customer_type", "Bireysel") if customer else "Bireysel")
        ctk.CTkOptionMenu(scroll, variable=type_var, width=450,
                           values=["Bireysel", "Kurumsal"]).pack(padx=24)

        def save():
            try:
                data = {
                    "name": fields["name"].get(),
                    "email": fields["email"].get(),
                    "phone": fields["phone"].get(),
                    "company": fields["company"].get(),
                    "tax_number": fields["tax_number"].get(),
                    "address": fields["address"].get(),
                    "city": fields["city"].get(),
                    "notes": fields["notes"].get(),
                    "customer_type": type_var.get(),
                }
                if customer:
                    db.update_customer(customer["id"], data)
                else:
                    db.add_customer(data)
                dlg.destroy()
                self.load_data()
            except Exception as e:
                ctk.CTkLabel(scroll, text=f"❌ {e}", text_color=DANGER).pack(pady=4)

        btn_f = ctk.CTkFrame(scroll, fg_color="transparent")
        btn_f.pack(pady=16)
        ctk.CTkButton(btn_f, text="💾  Kaydet", command=save).pack(side="left")
        ctk.CTkButton(btn_f, text="İptal", fg_color=BG_SURFACE2,
                       command=dlg.destroy).pack(side="left", padx=(8, 0))
