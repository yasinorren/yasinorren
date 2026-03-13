"""
Yeniden kullanılabilir özel widget'lar
"""
import customtkinter as ctk
from ui.theme import *


class StatCard(ctk.CTkFrame):
    """KPI kart widget'ı"""
    def __init__(self, master, title: str, value: str, delta: str = "",
                 icon: str = "📊", accent_color: str = ACCENT, **kwargs):
        super().__init__(master, fg_color=BG_SURFACE2, corner_radius=12,
                         border_width=1, border_color=BORDER, **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self._accent_color = accent_color

        # Renkli sol çizgi
        self._stripe = ctk.CTkFrame(self, width=4, fg_color=accent_color,
                                    corner_radius=0)
        self._stripe.grid(row=0, column=0, rowspan=10, sticky="ns", padx=(0, 0))

        # İkon ve başlık
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.grid(row=0, column=1, sticky="ew", padx=(14, 14), pady=(14, 4))
        ctk.CTkLabel(header, text=icon, font=("Segoe UI Emoji", 18)).pack(side="left")
        ctk.CTkLabel(header, text=title, font=("Inter", 11),
                     text_color=TEXT_MUTED).pack(side="left", padx=(8, 0))

        # Değer
        self._value_label = ctk.CTkLabel(self, text=value,
                                          font=("Inter", 26, "bold"),
                                          text_color=TEXT_BRIGHT)
        self._value_label.grid(row=1, column=1, sticky="w", padx=(14, 14))

        # Delta (değişim)
        if delta:
            delta_color = SUCCESS if delta.startswith("+") else DANGER
            ctk.CTkLabel(self, text=delta, font=("Inter", 11),
                         text_color=delta_color).grid(
                row=2, column=1, sticky="w", padx=(14, 14), pady=(0, 14))
        else:
            ctk.CTkFrame(self, height=14, fg_color="transparent").grid(
                row=2, column=1, pady=(0, 6))

    def update_value(self, value: str, delta: str = ""):
        self._value_label.configure(text=value)


class SectionHeader(ctk.CTkFrame):
    """Bölüm başlığı"""
    def __init__(self, master, title: str, subtitle: str = "",
                 icon: str = "", **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.grid_columnconfigure(1, weight=1)

        if icon:
            ctk.CTkLabel(self, text=icon, font=("Segoe UI Emoji", 22)).grid(
                row=0, column=0, rowspan=2, padx=(0, 12))

        ctk.CTkLabel(self, text=title, font=("Inter", 18, "bold"),
                     text_color=TEXT_BRIGHT).grid(row=0, column=1, sticky="w")

        if subtitle:
            ctk.CTkLabel(self, text=subtitle, font=("Inter", 11),
                         text_color=TEXT_MUTED).grid(row=1, column=1, sticky="w")


class DataTable(ctk.CTkFrame):
    """Basit veri tablosu"""
    def __init__(self, master, columns: list, **kwargs):
        super().__init__(master, fg_color=BG_SURFACE, corner_radius=12,
                         border_width=1, border_color=BORDER, **kwargs)
        self._columns = columns
        self._rows = []

        # Başlık satırı
        header_frame = ctk.CTkFrame(self, fg_color=BG_SURFACE3, corner_radius=8)
        header_frame.pack(fill="x", padx=8, pady=(8, 0))
        header_frame.grid_columnconfigure(list(range(len(columns))), weight=1)

        for i, col in enumerate(columns):
            ctk.CTkLabel(header_frame, text=col, font=("Inter", 11, "bold"),
                         text_color=TEXT_MUTED).grid(
                row=0, column=i, sticky="w", padx=12, pady=8)

        # Scroll area
        self._scroll = ctk.CTkScrollableFrame(self, fg_color="transparent",
                                               scrollbar_button_color=BG_SURFACE3)
        self._scroll.pack(fill="both", expand=True, padx=8, pady=8)
        self._scroll.grid_columnconfigure(list(range(len(columns))), weight=1)

    def load_data(self, rows: list[list]):
        for widget in self._scroll.winfo_children():
            widget.destroy()
        self._rows = rows

        for r_idx, row in enumerate(rows):
            bg = BG_SURFACE if r_idx % 2 == 0 else BG_SURFACE2
            for c_idx, cell in enumerate(row):
                ctk.CTkLabel(self._scroll, text=str(cell),
                             font=("Inter", 11), text_color=TEXT_PRIMARY,
                             fg_color=bg).grid(
                    row=r_idx, column=c_idx, sticky="ew", padx=12, pady=5)


class AIResponseBox(ctk.CTkFrame):
    """AI yanıtı gösterme alanı"""
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=BG_SURFACE2, corner_radius=12,
                         border_width=1, border_color=BORDER, **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # Başlık
        header = ctk.CTkFrame(self, fg_color=BG_SURFACE3, corner_radius=8)
        header.grid(row=0, column=0, sticky="ew", padx=8, pady=(8, 0))
        ctk.CTkLabel(header, text="🤖  AI Analiz Sonucu",
                     font=("Inter", 12, "bold"), text_color=ACCENT).pack(
            side="left", padx=12, pady=8)

        self._progress = ctk.CTkProgressBar(header, width=120,
                                             progress_color=ACCENT,
                                             fg_color=BG_SURFACE)
        self._progress.pack(side="right", padx=12)
        self._progress.set(0)
        self._progress.pack_forget()  # başlangıçta gizli

        # Metin alanı
        self._textbox = ctk.CTkTextbox(
            self,
            font=("Consolas", 12),
            fg_color="transparent",
            text_color=TEXT_PRIMARY,
            wrap="word",
        )
        self._textbox.grid(row=1, column=0, sticky="nsew", padx=8, pady=8)

    def set_loading(self, loading: bool):
        if loading:
            self._progress.pack(side="right", padx=12)
            self._progress.configure(mode="indeterminate")
            self._progress.start()
        else:
            self._progress.stop()
            self._progress.pack_forget()

    def set_text(self, text: str):
        self._textbox.configure(state="normal")
        self._textbox.delete("1.0", "end")
        self._textbox.insert("end", text)
        self._textbox.configure(state="disabled")

    def append_text(self, text: str):
        self._textbox.configure(state="normal")
        self._textbox.insert("end", text)
        self._textbox.see("end")
        self._textbox.configure(state="disabled")

    def clear(self):
        self._textbox.configure(state="normal")
        self._textbox.delete("1.0", "end")
        self._textbox.configure(state="disabled")


class NavButton(ctk.CTkButton):
    """Sol menü navigasyon butonu"""
    def __init__(self, master, text: str, icon: str = "", command=None,
                 active: bool = False, **kwargs):
        self._icon = icon
        self._text = text
        display = f"  {icon}  {text}" if icon else f"  {text}"
        super().__init__(
            master,
            text=display,
            command=command,
            fg_color=ACCENT if active else "transparent",
            hover_color=BG_SURFACE3,
            text_color=TEXT_BRIGHT if active else TEXT_MUTED,
            anchor="w",
            height=44,
            corner_radius=8,
            font=("Inter", 12, "bold" if active else "normal"),
            **kwargs,
        )

    def set_active(self, active: bool):
        self.configure(
            fg_color=ACCENT if active else "transparent",
            text_color=TEXT_BRIGHT if active else TEXT_MUTED,
            font=("Inter", 12, "bold" if active else "normal"),
        )


class LoadingOverlay(ctk.CTkFrame):
    """Yükleme göstergesi"""
    def __init__(self, master, **kwargs):
        super().__init__(master, fg_color=BG_DARK + "cc", corner_radius=0, **kwargs)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=1)

        inner = ctk.CTkFrame(self, fg_color=BG_SURFACE2, corner_radius=16,
                              width=260, height=120)
        inner.grid(row=0, column=0)
        inner.grid_propagate(False)
        inner.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(inner, text="⚙️  AI Analiz Yapılıyor...",
                     font=("Inter", 14, "bold"), text_color=TEXT_BRIGHT).grid(
            row=0, column=0, pady=(24, 8))

        bar = ctk.CTkProgressBar(inner, width=200,
                                  progress_color=ACCENT, fg_color=BG_SURFACE3)
        bar.grid(row=1, column=0, pady=(0, 20))
        bar.configure(mode="indeterminate")
        bar.start()
