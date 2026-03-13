"""
Uygulama teması ve renk sistemi
"""

# ── Ana Renkler ───────────────────────────────────────────────────────────────
BG_DARK       = "#0f1117"
BG_SURFACE    = "#1a1d2e"
BG_SURFACE2   = "#252840"
BG_SURFACE3   = "#2d3158"
BORDER        = "#334155"

ACCENT        = "#6366f1"
ACCENT_HOVER  = "#4f52d6"
ACCENT2       = "#8b5cf6"
ACCENT3       = "#06b6d4"

SUCCESS       = "#10b981"
WARNING       = "#f59e0b"
DANGER        = "#ef4444"
INFO          = "#3b82f6"

TEXT_PRIMARY  = "#e2e8f0"
TEXT_MUTED    = "#94a3b8"
TEXT_BRIGHT   = "#f8fafc"

# ── Widget Stilleri ───────────────────────────────────────────────────────────
CTK_THEME = {
    "CTk": {
        "fg_color": [BG_DARK, BG_DARK],
    },
    "CTkFrame": {
        "fg_color": [BG_SURFACE, BG_SURFACE],
        "border_color": [BORDER, BORDER],
        "border_width": 1,
        "corner_radius": 12,
    },
    "CTkButton": {
        "fg_color": [ACCENT, ACCENT],
        "hover_color": [ACCENT_HOVER, ACCENT_HOVER],
        "text_color": [TEXT_BRIGHT, TEXT_BRIGHT],
        "corner_radius": 8,
        "border_width": 0,
    },
    "CTkLabel": {
        "text_color": [TEXT_PRIMARY, TEXT_PRIMARY],
    },
    "CTkEntry": {
        "fg_color": [BG_SURFACE2, BG_SURFACE2],
        "border_color": [BORDER, BORDER],
        "text_color": [TEXT_PRIMARY, TEXT_PRIMARY],
        "placeholder_text_color": [TEXT_MUTED, TEXT_MUTED],
        "corner_radius": 8,
    },
    "CTkTextbox": {
        "fg_color": [BG_SURFACE2, BG_SURFACE2],
        "border_color": [BORDER, BORDER],
        "text_color": [TEXT_PRIMARY, TEXT_PRIMARY],
        "corner_radius": 8,
    },
    "CTkScrollbar": {
        "fg_color": [BG_SURFACE, BG_SURFACE],
        "button_color": [BG_SURFACE3, BG_SURFACE3],
        "button_hover_color": [ACCENT, ACCENT],
    },
    "CTkOptionMenu": {
        "fg_color": [BG_SURFACE2, BG_SURFACE2],
        "button_color": [BG_SURFACE3, BG_SURFACE3],
        "button_hover_color": [ACCENT, ACCENT],
        "text_color": [TEXT_PRIMARY, TEXT_PRIMARY],
        "corner_radius": 8,
    },
    "CTkComboBox": {
        "fg_color": [BG_SURFACE2, BG_SURFACE2],
        "border_color": [BORDER, BORDER],
        "text_color": [TEXT_PRIMARY, TEXT_PRIMARY],
        "button_color": [BG_SURFACE3, BG_SURFACE3],
        "corner_radius": 8,
    },
    "CTkSlider": {
        "fg_color": [BG_SURFACE3, BG_SURFACE3],
        "progress_color": [ACCENT, ACCENT],
        "button_color": [ACCENT2, ACCENT2],
        "button_hover_color": [ACCENT, ACCENT],
    },
    "CTkTabview": {
        "fg_color": [BG_SURFACE, BG_SURFACE],
        "segmented_button_fg_color": [BG_SURFACE2, BG_SURFACE2],
        "segmented_button_selected_color": [ACCENT, ACCENT],
        "segmented_button_selected_hover_color": [ACCENT_HOVER, ACCENT_HOVER],
        "segmented_button_unselected_color": [BG_SURFACE2, BG_SURFACE2],
        "segmented_button_unselected_hover_color": [BG_SURFACE3, BG_SURFACE3],
        "text_color": [TEXT_PRIMARY, TEXT_PRIMARY],
        "text_color_disabled": [TEXT_MUTED, TEXT_MUTED],
    },
    "CTkSegmentedButton": {
        "fg_color": [BG_SURFACE2, BG_SURFACE2],
        "selected_color": [ACCENT, ACCENT],
        "selected_hover_color": [ACCENT_HOVER, ACCENT_HOVER],
        "unselected_color": [BG_SURFACE2, BG_SURFACE2],
        "unselected_hover_color": [BG_SURFACE3, BG_SURFACE3],
        "text_color": [TEXT_PRIMARY, TEXT_PRIMARY],
        "text_color_disabled": [TEXT_MUTED, TEXT_MUTED],
    },
    "CTkSwitch": {
        "fg_color": [BG_SURFACE3, BG_SURFACE3],
        "progress_color": [ACCENT, ACCENT],
        "button_color": [TEXT_PRIMARY, TEXT_PRIMARY],
    },
    "CTkCheckBox": {
        "fg_color": [ACCENT, ACCENT],
        "border_color": [BORDER, BORDER],
        "hover_color": [ACCENT_HOVER, ACCENT_HOVER],
        "checkmark_color": [TEXT_BRIGHT, TEXT_BRIGHT],
    },
    "CTkProgressBar": {
        "fg_color": [BG_SURFACE3, BG_SURFACE3],
        "progress_color": [ACCENT, ACCENT],
        "corner_radius": 4,
    },
}
