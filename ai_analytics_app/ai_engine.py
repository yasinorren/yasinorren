"""
AI Engine - Claude API ile yapay zeka analizleri
"""
import anthropic
import json
import os
from typing import Callable


def get_client() -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    return anthropic.Anthropic(api_key=api_key)


SYSTEM_PROMPT = """Sen bir üst düzey iş analisti ve pazarlama uzmanısın.
Türkçe konuşan bir işletmeye hizmet veriyorsun.
Verilen verileri analiz ederek:
- Net, uygulanabilir içgörüler sun
- Önemli trendleri ve örüntüleri vurgula
- Somut öneriler ve eylem planları oluştur
- Rakamsal tahminler ve hedefler öner
- Riskleri ve fırsatları dengeli biçimde değerlendir

Yanıtlarını yapılandırılmış, madde işaretleri ve başlıklar kullanarak sun.
Emojiler kullanarak yanıtları daha okunabilir yap."""


def analyze_sales(sales_data: dict, days: int = 30, on_chunk: Callable = None) -> str:
    """Satış verilerini analiz et"""
    client = get_client()

    prompt = f"""Aşağıdaki {days} günlük satış verilerini analiz et:

📊 GENEL ÖZET:
- Toplam Sipariş: {sales_data.get('total_orders', 0):,}
- Toplam Birim: {sales_data.get('total_units', 0):,}
- Toplam Gelir: ₺{sales_data.get('total_revenue', 0):,.2f}
- Ortalama Sipariş Değeri: ₺{sales_data.get('avg_order_value', 0):,.2f}

📦 KATEGORİ BAZINDA:
{json.dumps(sales_data.get('by_category', []), ensure_ascii=False, indent=2)}

🌍 BÖLGE BAZINDA:
{json.dumps(sales_data.get('by_region', []), ensure_ascii=False, indent=2)}

📱 KANAL BAZINDA:
{json.dumps(sales_data.get('by_channel', []), ensure_ascii=False, indent=2)}

Lütfen şunları analiz et:
1. En iyi performans gösteren kategoriler ve nedenlerini
2. Bölgesel büyüme fırsatları
3. Kanal optimizasyonu önerileri
4. Gelir artışı için stratejik öneriler
5. Dikkat edilmesi gereken riskler
6. Önümüzdeki dönem için tahminler ve hedefler"""

    result = _stream_response(client, prompt, on_chunk)
    return result


def analyze_products(products: list, top_products: list, on_chunk: Callable = None) -> str:
    """Ürün performansını analiz et"""
    client = get_client()

    total_products = len(products)
    low_margin = [p for p in products if p.get('sell_price', 0) > 0 and
                  (p.get('sell_price', 0) - p.get('buy_price', 0)) / p.get('sell_price', 0) < 0.20]

    prompt = f"""Ürün portföyünü analiz et:

📦 GENEL ÜRÜN BİLGİSİ:
- Toplam Ürün Sayısı: {total_products}
- Düşük Marjlı Ürünler (<%%20): {len(low_margin)}

🏆 EN ÇOK SATAN TOP 10 ÜRÜN:
{json.dumps(top_products, ensure_ascii=False, indent=2)}

💰 DÜŞÜK MARJLI ÜRÜNLER:
{json.dumps([{
    'name': p.get('name'),
    'margin_pct': round((p.get('sell_price',0) - p.get('buy_price',0)) / max(p.get('sell_price',1), 1) * 100, 1)
} for p in low_margin[:10]], ensure_ascii=False, indent=2)}

Lütfen şunları analiz et:
1. En iyi performans gösteren ürün grupları
2. Fiyatlandırma optimizasyonu fırsatları
3. Portföy dengesi ve çeşitlendirme önerileri
4. Düşük performanslı ürünler için aksiyon planı
5. Yeni ürün kategorisi fırsatları
6. Cross-selling ve up-selling stratejileri"""

    result = _stream_response(client, prompt, on_chunk)
    return result


def analyze_inventory(low_stock: list, stock_value: dict, all_products: list, on_chunk: Callable = None) -> str:
    """Stok durumunu analiz et"""
    client = get_client()

    categories = {}
    for p in all_products:
        cat = p.get('category', 'Diğer')
        if cat not in categories:
            categories[cat] = {'count': 0, 'total_stock': 0, 'total_value': 0}
        categories[cat]['count'] += 1
        categories[cat]['total_stock'] += p.get('stock', 0)
        categories[cat]['total_value'] += p.get('stock', 0) * p.get('buy_price', 0)

    prompt = f"""Stok ve envanter durumunu analiz et:

📊 STOK DEĞER ÖZETİ:
- Toplam Maliyet Değeri: ₺{stock_value.get('total_cost', 0):,.2f}
- Toplam Perakende Değeri: ₺{stock_value.get('total_retail', 0):,.2f}
- Potansiyel Kar: ₺{stock_value.get('total_retail', 0) - stock_value.get('total_cost', 0):,.2f}
- Toplam Ürün Çeşidi: {stock_value.get('product_count', 0)}
- Toplam Birim: {stock_value.get('total_units', 0):,}

⚠️ KRİTİK STOK UYARILARI ({len(low_stock)} ürün):
{json.dumps([{'name': p.get('name'), 'category': p.get('category'), 'stock': p.get('stock'), 'min_stock': p.get('min_stock')} for p in low_stock[:15]], ensure_ascii=False, indent=2)}

📦 KATEGORİ BAZINDA STOK DAĞILIMI:
{json.dumps([{'category': k, **v} for k, v in categories.items()], ensure_ascii=False, indent=2)}

Lütfen şunları analiz et:
1. Acil sipariş verilmesi gereken ürünler ve öncelik sırası
2. Stok optimizasyon stratejileri
3. Aşırı stok riski taşıyan kategoriler
4. Tedarik zinciri iyileştirme önerileri
5. Mevsimsel stok planlama tavsiyeleri
6. ABC analizi çerçevesinde stok yönetim önerileri"""

    result = _stream_response(client, prompt, on_chunk)
    return result


def generate_marketing_recommendations(sales_data: dict, products: list, campaigns: list, on_chunk: Callable = None) -> str:
    """Pazarlama stratejisi ve öneriler üret"""
    client = get_client()

    active_campaigns = [c for c in campaigns if c.get('status') == 'Aktif']
    total_budget = sum(c.get('budget', 0) for c in campaigns)

    top_categories = sales_data.get('by_category', [])[:5]
    top_regions = sales_data.get('by_region', [])[:5]
    top_channels = sales_data.get('by_channel', [])[:4]

    prompt = f"""Kapsamlı bir pazarlama stratejisi ve öneriler geliştir:

📊 MEVCUT PERFORMANS:
- Toplam Gelir: ₺{sales_data.get('total_revenue', 0):,.2f}
- Toplam Sipariş: {sales_data.get('total_orders', 0):,}
- Ortalama Sipariş Değeri: ₺{sales_data.get('avg_order_value', 0):,.2f}

🏆 EN İYİ KATEGORİLER:
{json.dumps(top_categories, ensure_ascii=False, indent=2)}

🌍 EN İYİ BÖLGELER:
{json.dumps(top_regions, ensure_ascii=False, indent=2)}

📱 KANAL PERFORMANSI:
{json.dumps(top_channels, ensure_ascii=False, indent=2)}

📣 AKTİF KAMPANYALAR ({len(active_campaigns)} adet):
{json.dumps([{'name': c.get('name'), 'channel': c.get('channel'), 'budget': c.get('budget')} for c in active_campaigns], ensure_ascii=False, indent=2)}

💰 TOPLAM KAMPANYA BÜTÇESİ: ₺{total_budget:,.2f}

Lütfen şunları oluştur:
1. 🎯 Hedef kitle segmentasyonu ve kişiselleştirme stratejileri
2. 📱 Dijital pazarlama önerileri (sosyal medya, SEO, e-posta)
3. 🎁 Promosyon ve kampanya fikirleri (sezona özel, müşteri sadakati)
4. 🌍 Bölgesel genişleme fırsatları
5. 📊 Pazarlama bütçesi dağılım önerileri
6. 🔄 Müşteri geri kazanma ve elde tutma stratejileri
7. 📈 Büyüme hedefleri ve KPI önerileri
8. 🤝 İşbirliği ve influencer marketing fırsatları"""

    result = _stream_response(client, prompt, on_chunk)
    return result


def chat_with_ai(user_message: str, context_data: dict, on_chunk: Callable = None) -> str:
    """Serbest AI sohbeti"""
    client = get_client()

    context_str = json.dumps(context_data, ensure_ascii=False, indent=2) if context_data else "Veri yok"

    prompt = f"""Mevcut iş verileri bağlamı:
{context_str}

Kullanıcı sorusu: {user_message}"""

    result = _stream_response(client, prompt, on_chunk)
    return result


def _stream_response(client: anthropic.Anthropic, prompt: str, on_chunk: Callable = None) -> str:
    """Claude API ile streaming yanıt al"""
    full_response = ""

    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            full_response += text
            if on_chunk:
                on_chunk(text)

    return full_response
