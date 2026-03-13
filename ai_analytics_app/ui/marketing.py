"""
Pazarlama önerileri paneli
"""
import customtkinter as ctk
import threading
from ui.theme import *
from ui.widgets import SectionHeader, AIResponseBox
import database as db
import ai_engine


class MarketingPanel(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=BG_DARK, **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        self._build_ui()

    def _build_ui(self):
        top = ctk.CTkFrame(self, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=24, pady=(24, 0))
        top.grid_columnconfigure(1, weight=1)
        SectionHeader(top, "Pazarlama Önerileri", "AI destekli pazarlama stratejileri", "📣").grid(
            row=0, column=0, sticky="w")

        # Ana içerik
        content = ctk.CTkFrame(self, fg_color="transparent")
        content.grid(row=1, column=0, sticky="nsew", padx=24, pady=(16, 24))
        content.grid_columnconfigure(0, weight=1)
        content.grid_columnconfigure(1, weight=1)
        content.grid_rowconfigure(0, weight=1)

        # Sol: Kampanyalar
        left = ctk.CTkFrame(content, fg_color=BG_SURFACE, corner_radius=12,
                             border_width=1, border_color=BORDER)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        left.grid_columnconfigure(0, weight=1)
        left.grid_rowconfigure(2, weight=1)

        camp_header = ctk.CTkFrame(left, fg_color="transparent")
        camp_header.grid(row=0, column=0, sticky="ew", padx=12, pady=(14, 0))
        camp_header.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(camp_header, text="📣  Kampanyalar",
                     font=("Inter", 13, "bold")).grid(row=0, column=0, sticky="w")
        ctk.CTkButton(camp_header, text="➕  Yeni", width=80, height=30,
                       command=self._add_campaign).grid(row=0, column=1)

        # Kampanya başlık
        camp_hdr = ctk.CTkFrame(left, fg_color=BG_SURFACE3, corner_radius=6)
        camp_hdr.grid(row=1, column=0, sticky="ew", padx=8, pady=(8, 0))
        for i, (col, w) in enumerate([("Kampanya Adı", 160), ("Kanal", 100),
                                       ("Bütçe ₺", 80), ("Durum", 80)]):
            ctk.CTkLabel(camp_hdr, text=col, font=("Inter", 10, "bold"),
                         text_color=TEXT_MUTED, width=w).grid(row=0, column=i, padx=6, pady=7)

        self._camp_scroll = ctk.CTkScrollableFrame(left, fg_color="transparent",
                                                    scrollbar_button_color=BG_SURFACE3)
        self._camp_scroll.grid(row=2, column=0, sticky="nsew", padx=8, pady=4)

        # Sağ: AI Önerileri
        right = ctk.CTkFrame(content, fg_color="transparent")
        right.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        right.grid_columnconfigure(0, weight=1)
        right.grid_rowconfigure(2, weight=1)

        # Soru / prompt
        ctk.CTkLabel(right, text="💬  Özel Pazarlama Sorusu",
                     font=("Inter", 12, "bold"), text_color=TEXT_PRIMARY).grid(
            row=0, column=0, sticky="w", pady=(0, 6))

        input_row = ctk.CTkFrame(right, fg_color="transparent")
        input_row.grid(row=1, column=0, sticky="ew", pady=(0, 8))
        input_row.grid_columnconfigure(0, weight=1)

        self._prompt_entry = ctk.CTkEntry(
            input_row,
            placeholder_text="Ör: 'Kışlık ürünler için en etkili kampanya stratejisi nedir?'",
            height=44
        )
        self._prompt_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))

        ctk.CTkButton(input_row, text="🚀  Sor", width=80, height=44,
                       command=self._run_custom).grid(row=0, column=1)

        # Genel AI önerisi butonu
        ctk.CTkButton(right, text="🤖  Kapsamlı Pazarlama Analizi Yap", height=40,
                       command=self._run_full_analysis).grid(
            row=2, column=0, sticky="ew", pady=(0, 8))
        # Kaldırıldı, row=3'e taşındı
        self._ai_box = AIResponseBox(right)
        self._ai_box.grid(row=3, column=0, sticky="nsew")
        right.grid_rowconfigure(3, weight=1)

        self._load_campaigns()

    def _load_campaigns(self):
        for w in self._camp_scroll.winfo_children():
            w.destroy()

        campaigns = db.get_all_campaigns()
        status_colors = {
            "Aktif": SUCCESS,
            "Tamamlandı": TEXT_MUTED,
            "Planlanan": ACCENT3,
            "Durduruldu": DANGER,
        }

        for r, c in enumerate(campaigns):
            bg = BG_SURFACE if r % 2 == 0 else BG_SURFACE2
            row_f = ctk.CTkFrame(self._camp_scroll, fg_color=bg, corner_radius=4)
            row_f.pack(fill="x", pady=1)

            status_color = status_colors.get(c.get("status", ""), TEXT_MUTED)
            cells = [
                (c.get("name", "")[:22], 160, TEXT_PRIMARY),
                (c.get("channel", ""), 100, TEXT_MUTED),
                (f"₺{c.get('budget', 0):,.0f}", 80, SUCCESS),
                (c.get("status", ""), 80, status_color),
            ]
            for txt, w, col in cells:
                ctk.CTkLabel(row_f, text=txt, font=("Inter", 10),
                             text_color=col, width=w).pack(side="left", padx=6, pady=6)

    def _add_campaign(self):
        dialog = ctk.CTkToplevel(self)
        dialog.title("Yeni Kampanya")
        dialog.geometry("480x520")
        dialog.configure(fg_color=BG_DARK)
        dialog.grab_set()

        ctk.CTkLabel(dialog, text="📣  Yeni Kampanya",
                     font=("Inter", 16, "bold")).pack(padx=24, pady=(20, 12), anchor="w")

        fields = {}
        field_defs = [
            ("name", "Kampanya Adı *"),
            ("channel", "Kanal (Sosyal Medya, E-posta, vb.) *"),
            ("budget", "Bütçe ₺"),
            ("start_date", "Başlangıç Tarihi (YYYY-MM-DD)"),
            ("end_date", "Bitiş Tarihi (YYYY-MM-DD)"),
            ("notes", "Notlar"),
        ]
        for key, label in field_defs:
            ctk.CTkLabel(dialog, text=label, font=("Inter", 11),
                         text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(6, 2))
            entry = ctk.CTkEntry(dialog, width=430)
            entry.pack(padx=24)
            fields[key] = entry

        ctk.CTkLabel(dialog, text="Durum", font=("Inter", 11),
                     text_color=TEXT_MUTED).pack(anchor="w", padx=24, pady=(6, 2))
        status_var = ctk.StringVar(value="Aktif")
        ctk.CTkOptionMenu(dialog, variable=status_var,
                           values=["Aktif", "Planlanan", "Tamamlandı", "Durduruldu"],
                           width=430).pack(padx=24)

        def save():
            try:
                data = {
                    "name": fields["name"].get(),
                    "channel": fields["channel"].get(),
                    "budget": float(fields["budget"].get() or 0),
                    "start_date": fields["start_date"].get(),
                    "end_date": fields["end_date"].get(),
                    "status": status_var.get(),
                    "notes": fields["notes"].get(),
                }
                db.add_campaign(data)
                dialog.destroy()
                self._load_campaigns()
            except Exception as e:
                ctk.CTkLabel(dialog, text=f"❌ {e}", text_color=DANGER).pack(pady=4)

        btn_f = ctk.CTkFrame(dialog, fg_color="transparent")
        btn_f.pack(pady=16)
        ctk.CTkButton(btn_f, text="💾  Kaydet", command=save).pack(side="left")
        ctk.CTkButton(btn_f, text="İptal", fg_color=BG_SURFACE2,
                       command=dialog.destroy).pack(side="left", padx=(8, 0))

    def _run_full_analysis(self):
        self._ai_box.clear()
        self._ai_box.set_loading(True)
        self._ai_box.append_text("⏳ Kapsamlı pazarlama analizi başlatılıyor...\n\n")

        def worker():
            summary = db.get_sales_summary(30)
            products = db.get_all_products()
            campaigns = db.get_all_campaigns()
            result = ai_engine.generate_marketing_recommendations(
                summary, products, campaigns,
                on_chunk=lambda t: self.after(0, self._ai_box.append_text, t)
            )
            db.save_analysis("marketing", "Pazarlama analizi", result)
            self.after(0, self._ai_box.set_loading, False)

        threading.Thread(target=worker, daemon=True).start()

    def _run_custom(self):
        question = self._prompt_entry.get().strip()
        if not question:
            return
        self._ai_box.clear()
        self._ai_box.set_loading(True)
        self._ai_box.append_text(f"❓ Soru: {question}\n\n")

        def worker():
            summary = db.get_sales_summary(30)
            context = {
                "total_revenue": summary.get("total_revenue"),
                "top_categories": summary.get("by_category", [])[:5],
                "top_channels": summary.get("by_channel", [])[:4],
            }
            result = ai_engine.chat_with_ai(
                question, context,
                on_chunk=lambda t: self.after(0, self._ai_box.append_text, t)
            )
            db.save_analysis("chat", question, result)
            self.after(0, self._ai_box.set_loading, False)

        threading.Thread(target=worker, daemon=True).start()
