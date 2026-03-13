# AI Analytics Pro

Yapay Zeka Destekli İş Analiz ve Yönetim Sistemi

## 🚀 Özellikler

### 🏠 Ana Panel (Dashboard)
- Gerçek zamanlı KPI kartları (Gelir, Sipariş, Ort. Sipariş Değeri)
- Günlük satış trendi grafiği
- Kategori, bölge ve kanal dağılımı
- Kritik stok uyarıları

### 💹 Muhasebe & Kar/Zarar
- Tam gelir tablosu (Brüt Gelir → Net Kar)
- Aylık kar/zarar analizi ve trendler
- Gider kategorileri ve takibi
- Vergi karşılığı hesaplama
- AI destekli finansal analiz

### 🛒 Sipariş Yönetimi
- Sipariş oluşturma, güncelleme ve takibi
- KDV hesaplama ve indirim yönetimi
- Ödeme durumu takibi
- Detaylı sipariş görüntüleme

### 👥 Müşteri Yönetimi
- Bireysel ve kurumsal müşteri profilleri
- İletişim bilgileri (telefon, e-posta, adres, vergi no)
- Sipariş geçmişi ve harcama analizi
- Müşteri segmentasyonu

### 📦 Ürün Analizi
- Ürün portföyü yönetimi
- Fiyat ve marj analizi
- AI destekli ürün performans analizi

### 📈 Satış Analizi
- Dönemsel satış raporları
- Kategori, bölge ve kanal analizleri
- AI destekli satış içgörüleri

### 🏭 Stok & Envanter
- Kritik stok uyarıları
- Stok değer analizi
- Sipariş yönetimi
- AI destekli stok optimizasyonu

### 📣 Pazarlama
- Kampanya yönetimi
- AI destekli pazarlama önerileri
- Özel soru-cevap sistemi

## 📋 Kurulum

### Gereksinimler
- Python 3.10+
- Windows / Linux / macOS

### Kurulum Adımları

```bash
# 1. Bağımlılıkları yükle
pip install -r requirements.txt

# 2. Anthropic API anahtarını ayarla
# Uygulama içinden Ayarlar > API Anahtarı menüsünden girebilirsiniz
# Veya ortam değişkeni olarak:
export ANTHROPIC_API_KEY=sk-ant-...  # Linux/Mac
set ANTHROPIC_API_KEY=sk-ant-...     # Windows

# 3. Uygulamayı çalıştır
python main.py
```

### Windows EXE Oluşturma

```bash
# Tek komutla EXE derle
build.bat

# Ya da:
pip install pyinstaller
pyinstaller --clean build.spec
# Çıktı: dist/AIAnalyticsPro.exe
```

## 🔧 Kullanım

1. Uygulamayı başlatın
2. **Ayarlar > API Anahtarı** menüsünden Anthropic API anahtarınızı girin
3. Demo veriler otomatik olarak yüklenir
4. Sol menüden istediğiniz modüle gidin
5. AI butonlarına tıklayarak yapay zeka analizlerini başlatın

## 📁 Veri Depolama

Tüm veriler yerel olarak saklanır:
- Windows: `C:\Users\[kullanıcı]\.ai_analytics\data.db`
- Linux/Mac: `~/.ai_analytics/data.db`

## 🤖 AI Model

Claude Opus 4.6 (Anthropic) kullanılmaktadır.
- Adaptive thinking ile gelişmiş akıl yürütme
- Streaming yanıtlar ile anlık geri bildirim
- Türkçe optimizasyon
