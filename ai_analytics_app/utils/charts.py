"""
Grafik yardımcıları - Matplotlib ile modern grafikler
"""
import matplotlib
matplotlib.use("TkAgg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
import numpy as np
from typing import Optional
import tkinter as tk

# ── Renk Paleti ───────────────────────────────────────────────────────────────
COLORS = {
    "bg": "#0f1117",
    "surface": "#1a1d2e",
    "surface2": "#252840",
    "accent": "#6366f1",
    "accent2": "#8b5cf6",
    "accent3": "#06b6d4",
    "success": "#10b981",
    "warning": "#f59e0b",
    "danger": "#ef4444",
    "text": "#e2e8f0",
    "text_muted": "#94a3b8",
    "border": "#334155",
}

CHART_COLORS = [
    "#6366f1", "#8b5cf6", "#06b6d4", "#10b981",
    "#f59e0b", "#ef4444", "#ec4899", "#14b8a6",
    "#f97316", "#84cc16",
]

plt.rcParams.update({
    "figure.facecolor": COLORS["surface"],
    "axes.facecolor": COLORS["bg"],
    "axes.labelcolor": COLORS["text"],
    "axes.titlecolor": COLORS["text"],
    "xtick.color": COLORS["text_muted"],
    "ytick.color": COLORS["text_muted"],
    "text.color": COLORS["text"],
    "grid.color": COLORS["border"],
    "grid.alpha": 0.4,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.edgecolor": COLORS["border"],
    "font.family": "sans-serif",
    "font.size": 10,
})


def embed_chart(fig: Figure, parent: tk.Widget) -> FigureCanvasTkAgg:
    """Matplotlib figürünü tkinter widget'ına göm"""
    canvas = FigureCanvasTkAgg(fig, master=parent)
    canvas.draw()
    return canvas


def create_line_chart(data_dict: dict, title: str = "", xlabel: str = "", ylabel: str = "₺") -> Figure:
    """Çizgi grafik oluştur"""
    fig, ax = plt.subplots(figsize=(10, 4))
    fig.patch.set_facecolor(COLORS["surface"])
    ax.set_facecolor(COLORS["bg"])

    for i, (label, (xs, ys)) in enumerate(data_dict.items()):
        color = CHART_COLORS[i % len(CHART_COLORS)]
        ax.plot(xs, ys, color=color, linewidth=2.5, label=label, marker='o', markersize=4)
        ax.fill_between(xs, ys, alpha=0.08, color=color)

    ax.set_title(title, fontsize=13, fontweight="bold", pad=12, color=COLORS["text"])
    ax.set_xlabel(xlabel, color=COLORS["text_muted"])
    ax.set_ylabel(ylabel, color=COLORS["text_muted"])
    ax.grid(True, linestyle="--", alpha=0.3)
    ax.tick_params(axis='x', rotation=45)

    if len(data_dict) > 1:
        ax.legend(facecolor=COLORS["surface2"], edgecolor=COLORS["border"], labelcolor=COLORS["text"])

    fig.tight_layout()
    return fig


def create_bar_chart(labels: list, values: list, title: str = "",
                     ylabel: str = "₺", horizontal: bool = False,
                     color_index: int = 0) -> Figure:
    """Bar grafik oluştur"""
    fig, ax = plt.subplots(figsize=(10, 4))
    fig.patch.set_facecolor(COLORS["surface"])
    ax.set_facecolor(COLORS["bg"])

    colors = [CHART_COLORS[(i + color_index) % len(CHART_COLORS)] for i in range(len(labels))]

    if horizontal:
        bars = ax.barh(labels, values, color=colors, edgecolor="none", height=0.65)
        ax.set_xlabel(ylabel, color=COLORS["text_muted"])
        for bar, val in zip(bars, values):
            ax.text(bar.get_width() + max(values) * 0.01, bar.get_y() + bar.get_height() / 2,
                    f"₺{val:,.0f}", va='center', fontsize=9, color=COLORS["text_muted"])
    else:
        bars = ax.bar(labels, values, color=colors, edgecolor="none", width=0.65)
        ax.set_ylabel(ylabel, color=COLORS["text_muted"])
        ax.tick_params(axis='x', rotation=30)
        for bar, val in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max(values) * 0.01,
                    f"₺{val:,.0f}", ha='center', fontsize=9, color=COLORS["text_muted"])

    ax.set_title(title, fontsize=13, fontweight="bold", pad=12, color=COLORS["text"])
    ax.grid(True, linestyle="--", alpha=0.3, axis='x' if horizontal else 'y')
    fig.tight_layout()
    return fig


def create_donut_chart(labels: list, values: list, title: str = "") -> Figure:
    """Donut (çörek) grafik oluştur"""
    fig, ax = plt.subplots(figsize=(6, 5))
    fig.patch.set_facecolor(COLORS["surface"])
    ax.set_facecolor(COLORS["surface"])

    colors = CHART_COLORS[:len(labels)]
    wedges, texts, autotexts = ax.pie(
        values,
        labels=None,
        autopct="%1.1f%%",
        colors=colors,
        startangle=90,
        wedgeprops={"width": 0.55, "edgecolor": COLORS["surface"], "linewidth": 2},
        pctdistance=0.75,
    )

    for autotext in autotexts:
        autotext.set_color(COLORS["text"])
        autotext.set_fontsize(9)
        autotext.set_fontweight("bold")

    total = sum(values)
    ax.text(0, 0, f"₺{total:,.0f}", ha='center', va='center',
            fontsize=11, color=COLORS["text"], fontweight="bold")

    patches = [mpatches.Patch(color=colors[i], label=f"{labels[i]}: ₺{values[i]:,.0f}")
               for i in range(len(labels))]
    ax.legend(handles=patches, loc="lower center", bbox_to_anchor=(0.5, -0.15),
              ncol=2, facecolor=COLORS["surface2"], edgecolor=COLORS["border"],
              labelcolor=COLORS["text"], fontsize=9)

    ax.set_title(title, fontsize=13, fontweight="bold", pad=12, color=COLORS["text"])
    fig.tight_layout()
    return fig


def create_multi_bar_chart(categories: list, series_dict: dict, title: str = "") -> Figure:
    """Grup bar grafik oluştur"""
    fig, ax = plt.subplots(figsize=(10, 4))
    fig.patch.set_facecolor(COLORS["surface"])
    ax.set_facecolor(COLORS["bg"])

    x = np.arange(len(categories))
    n = len(series_dict)
    width = 0.75 / n
    offsets = np.linspace(-(n - 1) / 2 * width, (n - 1) / 2 * width, n)

    for i, (label, values) in enumerate(series_dict.items()):
        ax.bar(x + offsets[i], values, width, label=label,
               color=CHART_COLORS[i % len(CHART_COLORS)], edgecolor="none", alpha=0.9)

    ax.set_xticks(x)
    ax.set_xticklabels(categories, rotation=30, ha='right')
    ax.set_title(title, fontsize=13, fontweight="bold", pad=12, color=COLORS["text"])
    ax.legend(facecolor=COLORS["surface2"], edgecolor=COLORS["border"], labelcolor=COLORS["text"])
    ax.grid(True, linestyle="--", alpha=0.3, axis='y')
    fig.tight_layout()
    return fig


def create_heatmap(data: list[list], row_labels: list, col_labels: list, title: str = "") -> Figure:
    """Isı haritası oluştur"""
    fig, ax = plt.subplots(figsize=(10, 4))
    fig.patch.set_facecolor(COLORS["surface"])

    data_arr = np.array(data)
    im = ax.imshow(data_arr, cmap="YlOrRd", aspect="auto")

    ax.set_xticks(np.arange(len(col_labels)))
    ax.set_yticks(np.arange(len(row_labels)))
    ax.set_xticklabels(col_labels, rotation=45, ha="right")
    ax.set_yticklabels(row_labels)

    for i in range(len(row_labels)):
        for j in range(len(col_labels)):
            ax.text(j, i, f"{data_arr[i, j]:,.0f}",
                    ha="center", va="center", fontsize=8, color=COLORS["bg"])

    plt.colorbar(im, ax=ax)
    ax.set_title(title, fontsize=13, fontweight="bold", pad=12, color=COLORS["text"])
    fig.tight_layout()
    return fig


def create_kpi_figure(kpis: list[dict]) -> Figure:
    """KPI kartları figürü oluştur - {label, value, delta, color}"""
    n = len(kpis)
    fig, axes = plt.subplots(1, n, figsize=(n * 3, 2))
    if n == 1:
        axes = [axes]
    fig.patch.set_facecolor(COLORS["bg"])

    for ax, kpi in zip(axes, kpis):
        ax.set_facecolor(COLORS["surface"])
        color = kpi.get("color", COLORS["accent"])
        ax.text(0.5, 0.65, kpi.get("value", ""), ha="center", va="center",
                fontsize=18, fontweight="bold", color=color, transform=ax.transAxes)
        ax.text(0.5, 0.30, kpi.get("label", ""), ha="center", va="center",
                fontsize=10, color=COLORS["text_muted"], transform=ax.transAxes)
        delta = kpi.get("delta", "")
        if delta:
            delta_color = COLORS["success"] if str(delta).startswith("+") else COLORS["danger"]
            ax.text(0.5, 0.12, delta, ha="center", va="center",
                    fontsize=9, color=delta_color, transform=ax.transAxes)
        for spine in ax.spines.values():
            spine.set_edgecolor(color)
            spine.set_linewidth(1.5)
        ax.set_xticks([])
        ax.set_yticks([])

    fig.tight_layout(pad=0.5)
    return fig
