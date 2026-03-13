"""
Database layer - SQLite ile tüm veri yönetimi
Müşteri, Sipariş, Muhasebe tabloları dahil
"""
import sqlite3
import os
import json
import random
from datetime import datetime, timedelta
from pathlib import Path


DB_PATH = Path.home() / ".ai_analytics" / "data.db"


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Veritabanını başlat ve tabloları oluştur"""
    conn = get_connection()
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            address TEXT,
            city TEXT,
            tax_number TEXT,
            company TEXT,
            customer_type TEXT DEFAULT 'Bireysel',
            total_spent REAL DEFAULT 0,
            order_count INTEGER DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            sku TEXT UNIQUE NOT NULL,
            buy_price REAL NOT NULL,
            sell_price REAL NOT NULL,
            stock INTEGER DEFAULT 0,
            min_stock INTEGER DEFAULT 10,
            supplier TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number TEXT UNIQUE NOT NULL,
            customer_id INTEGER,
            customer_name TEXT,
            total_amount REAL NOT NULL,
            discount REAL DEFAULT 0,
            tax_rate REAL DEFAULT 18,
            tax_amount REAL DEFAULT 0,
            net_amount REAL NOT NULL,
            status TEXT DEFAULT 'Beklemede',
            payment_method TEXT DEFAULT 'Nakit',
            payment_status TEXT DEFAULT 'Ödenmedi',
            shipping_address TEXT,
            notes TEXT,
            order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            total_price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            total_price REAL NOT NULL,
            customer TEXT,
            region TEXT,
            channel TEXT DEFAULT 'Mağaza',
            sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            movement_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS accounting_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_type TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            direction TEXT NOT NULL,
            reference TEXT,
            transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            expense_date TEXT NOT NULL,
            payment_method TEXT DEFAULT 'Nakit',
            receipt_no TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ai_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_type TEXT NOT NULL,
            prompt TEXT NOT NULL,
            result TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS marketing_campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            channel TEXT NOT NULL,
            budget REAL DEFAULT 0,
            start_date TEXT,
            end_date TEXT,
            status TEXT DEFAULT 'Aktif',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    conn.commit()
    conn.close()


def seed_sample_data():
    """Demo veriler ekle"""
    conn = get_connection()
    c = conn.cursor()

    c.execute("SELECT COUNT(*) FROM products")
    if c.fetchone()[0] > 0:
        conn.close()
        return

    # ── Ürünler ───────────────────────────────────────────────────────────────
    products_data = [
        ("Samsung Galaxy A54", "Elektronik", "ELK-001", 8500, 11999, 45, 15, "TechSupply A.Ş."),
        ("iPhone 15 Kılıf Deri", "Elektronik", "ELK-002", 180, 349, 120, 30, "TechSupply A.Ş."),
        ("Bluetooth Kulaklık Pro", "Elektronik", "ELK-003", 650, 1299, 67, 20, "TechSupply A.Ş."),
        ("Erkek Slim Fit Ceket", "Giyim", "GIY-001", 320, 699, 89, 25, "FashionTR Ltd."),
        ("Kadın Deri Bot", "Giyim", "GIY-002", 450, 1199, 34, 20, "FashionTR Ltd."),
        ("Çocuk Spor Ayakkabı", "Giyim", "GIY-003", 180, 399, 156, 40, "FashionTR Ltd."),
        ("Organik Zeytinyağı 1L", "Gıda", "GDA-001", 85, 159, 340, 100, "GıdaMarket"),
        ("Türk Kahvesi 500g", "Gıda", "GDA-002", 45, 95, 280, 80, "GıdaMarket"),
        ("Badem Ezmesi 300g", "Gıda", "GDA-003", 65, 135, 190, 60, "GıdaMarket"),
        ("Yüz Temizleme Jeli", "Kozmetik", "KOZ-001", 55, 139, 234, 70, "BeautyPro"),
        ("Anti-Aging Krem 50ml", "Kozmetik", "KOZ-002", 120, 299, 145, 50, "BeautyPro"),
        ("Parfüm EDP 100ml", "Kozmetik", "KOZ-003", 280, 699, 78, 30, "BeautyPro"),
        ("Koşu Ayakkabısı Pro", "Spor", "SPO-001", 650, 1499, 56, 20, "SportZone"),
        ("Yoga Matı Eco", "Spor", "SPO-002", 85, 199, 123, 40, "SportZone"),
        ("Dumbbell Set 20kg", "Spor", "SPO-003", 380, 799, 34, 15, "SportZone"),
        ("LED Masa Lambası", "Ev & Yaşam", "EV-001", 145, 329, 89, 30, "HomeDecor"),
        ("Dekoratif Mum Seti", "Ev & Yaşam", "EV-002", 45, 119, 267, 60, "HomeDecor"),
        ("Bambu Mutfak Seti", "Ev & Yaşam", "EV-003", 95, 229, 145, 40, "HomeDecor"),
        ("LEGO Creator Set", "Oyuncak", "OYN-001", 320, 699, 67, 25, "ToysWorld"),
        ("Peluş Ayıcık XL", "Oyuncak", "OYN-002", 85, 199, 189, 50, "ToysWorld"),
        ("Roman: Gece Yarısı", "Kitap", "KIT-001", 25, 59, 345, 100, "KitapEvi"),
        ("Python Programlama", "Kitap", "KIT-002", 65, 149, 234, 80, "KitapEvi"),
        ("Akıllı Saat Serisi 5", "Elektronik", "ELK-004", 2800, 4999, 28, 10, "TechSupply A.Ş."),
        ("Tablet 10 inch", "Elektronik", "ELK-005", 3200, 5499, 19, 10, "TechSupply A.Ş."),
        ("Elbise Yazlık Çiçekli", "Giyim", "GIY-004", 220, 549, 78, 25, "FashionTR Ltd."),
    ]
    c.executemany("""
        INSERT INTO products (name, category, sku, buy_price, sell_price, stock, min_stock, supplier)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, products_data)

    # ── Müşteriler ────────────────────────────────────────────────────────────
    customers_data = [
        ("Ahmet Yılmaz", "ahmet@example.com", "0532 111 2233", "Atatürk Cad. No:5", "İstanbul", "12345678901", "Yılmaz Ticaret", "Kurumsal"),
        ("Fatma Kaya", "fatma@example.com", "0541 222 3344", "Bağlar Sok. No:12", "Ankara", "", "", "Bireysel"),
        ("Mehmet Demir", "mehmet@example.com", "0555 333 4455", "Cumhuriyet Mah.", "İzmir", "98765432100", "Demir A.Ş.", "Kurumsal"),
        ("Ayşe Şahin", "ayse@example.com", "0542 444 5566", "Çiçek Sok. No:3", "Bursa", "", "", "Bireysel"),
        ("Ali Rıza Öz", "ali@example.com", "0543 555 6677", "Liman Cad. No:8", "Antalya", "55566677788", "Öz Ticaret", "Kurumsal"),
        ("Zeynep Türk", "zeynep@example.com", "0544 666 7788", "Park Mah. No:15", "Konya", "", "", "Bireysel"),
        ("Mustafa Boz", "mustafa@example.com", "0545 777 8899", "İstiklal Sok.", "Adana", "22233344455", "Boz Ltd.", "Kurumsal"),
        ("Hatice Güneş", "hatice@example.com", "0546 888 9900", "Bahçe Yolu No:7", "Gaziantep", "", "", "Bireysel"),
        ("İbrahim Can", "ibrahim@example.com", "0547 999 0011", "Meydan Cad. No:20", "Trabzon", "66677788899", "Can Holding", "Kurumsal"),
        ("Elif Yıldız", "elif@example.com", "0548 000 1122", "Gül Sok. No:4", "İstanbul", "", "", "Bireysel"),
        ("Hasan Çelik", "hasan@example.com", "0549 111 2233", "Sanayi Cad. No:11", "İzmir", "33344455566", "Çelik Endüstri", "Kurumsal"),
        ("Meryem Aktaş", "meryem@example.com", "0530 222 3344", "Akasya Mah. No:6", "Ankara", "", "", "Bireysel"),
    ]
    c.executemany("""
        INSERT INTO customers (name, email, phone, address, city, tax_number, company, customer_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, customers_data)

    c.execute("SELECT id, sell_price, buy_price FROM products")
    all_products = c.fetchall()

    c.execute("SELECT id, name FROM customers")
    all_customers = c.fetchall()

    # ── Satışlar ──────────────────────────────────────────────────────────────
    regions = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep"]
    channels = ["Mağaza", "Online", "Toptan", "Pazar Yeri"]
    base_date = datetime.now() - timedelta(days=365)
    sales_data = []
    for _ in range(800):
        prod = random.choice(all_products)
        qty = random.randint(1, 15)
        price = prod[1] * random.uniform(0.90, 1.05)
        sale_date = base_date + timedelta(
            days=random.randint(0, 365),
            hours=random.randint(8, 22),
            minutes=random.randint(0, 59)
        )
        cust = random.choice(all_customers)
        sales_data.append((prod[0], qty, round(price, 2), round(price * qty, 2),
                           cust[1], random.choice(regions),
                           random.choice(channels),
                           sale_date.strftime("%Y-%m-%d %H:%M:%S")))
    c.executemany("""
        INSERT INTO sales (product_id, quantity, unit_price, total_price, customer, region, channel, sale_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, sales_data)

    # ── Siparişler ────────────────────────────────────────────────────────────
    statuses = ["Teslim Edildi", "Teslim Edildi", "Teslim Edildi", "Kargoda", "Hazırlanıyor", "İptal"]
    pay_methods = ["Nakit", "Kredi Kartı", "Havale/EFT", "Kapıda Ödeme"]
    pay_statuses = ["Ödendi", "Ödendi", "Ödendi", "Beklemede"]

    for i in range(1, 81):
        customer = random.choice(all_customers)
        num_items = random.randint(1, 4)
        items = random.sample(all_products, min(num_items, len(all_products)))
        total = 0
        order_date = base_date + timedelta(days=random.randint(0, 365))
        order_num = f"SIP-{order_date.strftime('%Y%m')}-{i:04d}"

        discount = random.choice([0, 0, 0, 50, 100, 150]) * 1.0
        tax_rate = 18.0
        subtotal = sum(p[1] * random.randint(1, 5) for p in items)
        tax_amount = round((subtotal - discount) * tax_rate / 100, 2)
        net_amount = round(subtotal - discount + tax_amount, 2)
        status = random.choice(statuses)
        pay_method = random.choice(pay_methods)
        pay_status = "Ödendi" if status == "Teslim Edildi" else random.choice(pay_statuses)

        c.execute("""
            INSERT INTO orders (order_number, customer_id, customer_name, total_amount,
                                discount, tax_rate, tax_amount, net_amount, status,
                                payment_method, payment_status, order_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (order_num, customer[0], customer[1], subtotal, discount, tax_rate,
              tax_amount, net_amount, status, pay_method, pay_status,
              order_date.strftime("%Y-%m-%d %H:%M:%S")))

        order_id = c.lastrowid
        for prod in items:
            qty = random.randint(1, 5)
            c.execute("""
                INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
                SELECT ?, id, name, ?, sell_price, ? FROM products WHERE id=?
            """, (order_id, qty, round(prod[1] * qty, 2), prod[0]))

    # ── Gider kayıtları ───────────────────────────────────────────────────────
    expense_cats = ["Kira", "Maaşlar", "Elektrik/Su/Doğalgaz", "Pazarlama", "Tedarik",
                    "Ulaşım", "Bakım/Onarım", "Sigorta", "Vergi/Harç", "Diğer"]
    for i in range(120):
        exp_date = base_date + timedelta(days=random.randint(0, 365))
        cat = random.choice(expense_cats)
        amount = random.uniform(500, 50000)
        c.execute("""
            INSERT INTO expenses (category, description, amount, expense_date, payment_method)
            VALUES (?, ?, ?, ?, ?)
        """, (cat, f"{cat} gideri - {exp_date.strftime('%B %Y')}",
              round(amount, 2), exp_date.strftime("%Y-%m-%d"),
              random.choice(["Nakit", "Banka Transferi", "Kredi Kartı"])))

    # ── Kampanyalar ───────────────────────────────────────────────────────────
    campaigns_data = [
        ("Yaz İndirimi 2024", "Sosyal Medya", 15000, "2024-06-01", "2024-08-31", "Tamamlandı", "Instagram ve Facebook reklamları"),
        ("Okula Dönüş", "E-posta", 8000, "2024-09-01", "2024-09-30", "Tamamlandı", "Segmentli e-posta kampanyası"),
        ("Kış Sezonu Lansmanı", "Çoklu Kanal", 25000, "2024-11-01", "2024-12-31", "Tamamlandı", "TV, dijital, sosyal medya"),
        ("Bahar Koleksiyonu", "Influencer", 12000, "2025-03-01", "2025-04-30", "Aktif", "10 influencer ile işbirliği"),
        ("Anneler Günü Özel", "E-posta + SMS", 6000, "2025-05-01", "2025-05-15", "Planlanan", "Kişiselleştirilmiş mesajlar"),
    ]
    c.executemany("""
        INSERT INTO marketing_campaigns (name, channel, budget, start_date, end_date, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, campaigns_data)

    conn.commit()
    conn.close()


# ── Product CRUD ──────────────────────────────────────────────────────────────

def get_all_products():
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM products ORDER BY category, name")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def add_product(data: dict):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO products (name, category, sku, buy_price, sell_price, stock, min_stock, supplier)
        VALUES (:name, :category, :sku, :buy_price, :sell_price, :stock, :min_stock, :supplier)
    """, data)
    conn.commit()
    conn.close()


def update_product(product_id: int, data: dict):
    conn = get_connection()
    c = conn.cursor()
    data["id"] = product_id
    data["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("""
        UPDATE products
        SET name=:name, category=:category, sku=:sku, buy_price=:buy_price,
            sell_price=:sell_price, stock=:stock, min_stock=:min_stock,
            supplier=:supplier, updated_at=:updated_at
        WHERE id=:id
    """, data)
    conn.commit()
    conn.close()


def delete_product(product_id: int):
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM products WHERE id=?", (product_id,))
    conn.commit()
    conn.close()


# ── Customer CRUD ─────────────────────────────────────────────────────────────

def get_all_customers():
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        SELECT cu.*,
               COALESCE(SUM(o.net_amount), 0) as total_spent_calc,
               COUNT(o.id) as order_count_calc
        FROM customers cu
        LEFT JOIN orders o ON cu.id = o.customer_id AND o.payment_status = 'Ödendi'
        GROUP BY cu.id
        ORDER BY total_spent_calc DESC
    """)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def add_customer(data: dict):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO customers (name, email, phone, address, city, tax_number, company, customer_type, notes)
        VALUES (:name, :email, :phone, :address, :city, :tax_number, :company, :customer_type, :notes)
    """, data)
    conn.commit()
    conn.close()


def update_customer(customer_id: int, data: dict):
    conn = get_connection()
    c = conn.cursor()
    data["id"] = customer_id
    c.execute("""
        UPDATE customers
        SET name=:name, email=:email, phone=:phone, address=:address,
            city=:city, tax_number=:tax_number, company=:company,
            customer_type=:customer_type, notes=:notes
        WHERE id=:id
    """, data)
    conn.commit()
    conn.close()


def get_customer_orders(customer_id: int):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM orders WHERE customer_id=? ORDER BY order_date DESC", (customer_id,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


# ── Orders CRUD ───────────────────────────────────────────────────────────────

def get_all_orders(status: str = None, limit: int = 200):
    conn = get_connection()
    c = conn.cursor()
    if status and status != "Tümü":
        c.execute("""
            SELECT o.*, cu.phone as customer_phone
            FROM orders o LEFT JOIN customers cu ON o.customer_id = cu.id
            WHERE o.status=? ORDER BY o.order_date DESC LIMIT ?
        """, (status, limit))
    else:
        c.execute("""
            SELECT o.*, cu.phone as customer_phone
            FROM orders o LEFT JOIN customers cu ON o.customer_id = cu.id
            ORDER BY o.order_date DESC LIMIT ?
        """, (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_order_items(order_id: int):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM order_items WHERE order_id=?", (order_id,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def add_order(order_data: dict, items: list):
    """Yeni sipariş ekle: items = [{product_id, product_name, quantity, unit_price, total_price}]"""
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO orders (order_number, customer_id, customer_name, total_amount,
                            discount, tax_rate, tax_amount, net_amount, status,
                            payment_method, payment_status, shipping_address, notes, order_date)
        VALUES (:order_number, :customer_id, :customer_name, :total_amount,
                :discount, :tax_rate, :tax_amount, :net_amount, :status,
                :payment_method, :payment_status, :shipping_address, :notes, :order_date)
    """, order_data)
    order_id = c.lastrowid
    for item in items:
        item["order_id"] = order_id
        c.execute("""
            INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
            VALUES (:order_id, :product_id, :product_name, :quantity, :unit_price, :total_price)
        """, item)
    conn.commit()
    conn.close()
    return order_id


def update_order_status(order_id: int, status: str, payment_status: str = None):
    conn = get_connection()
    c = conn.cursor()
    if payment_status:
        c.execute("UPDATE orders SET status=?, payment_status=? WHERE id=?",
                  (status, payment_status, order_id))
    else:
        c.execute("UPDATE orders SET status=? WHERE id=?", (status, order_id))
    conn.commit()
    conn.close()


def get_order_stats():
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        SELECT
            COUNT(*) as total_orders,
            SUM(CASE WHEN payment_status='Ödendi' THEN net_amount ELSE 0 END) as total_revenue,
            SUM(CASE WHEN payment_status='Beklemede' THEN net_amount ELSE 0 END) as pending_revenue,
            SUM(CASE WHEN status='Beklemede' THEN 1 ELSE 0 END) as pending_orders,
            SUM(CASE WHEN status='Kargoda' THEN 1 ELSE 0 END) as shipped_orders,
            SUM(CASE WHEN status='İptal' THEN 1 ELSE 0 END) as cancelled_orders
        FROM orders
    """)
    row = dict(c.fetchone())
    conn.close()
    return row


# ── Accounting / Finance ──────────────────────────────────────────────────────

def get_profit_loss(year: int = None, month: int = None):
    conn = get_connection()
    c = conn.cursor()

    where_sales = ""
    where_expenses = ""
    params_sales = []
    params_expenses = []

    if year:
        where_sales = "WHERE strftime('%Y', s.sale_date) = ?"
        params_sales = [str(year)]
        where_expenses = "WHERE strftime('%Y', e.expense_date) = ?"
        params_expenses = [str(year)]

    if year and month:
        where_sales = "WHERE strftime('%Y', s.sale_date) = ? AND strftime('%m', s.sale_date) = ?"
        params_sales = [str(year), f"{month:02d}"]
        where_expenses = "WHERE strftime('%Y', e.expense_date) = ? AND strftime('%m', e.expense_date) = ?"
        params_expenses = [str(year), f"{month:02d}"]

    # Satış geliri
    c.execute(f"""
        SELECT
            SUM(s.total_price) as gross_revenue,
            SUM(s.quantity * p.buy_price) as cost_of_goods
        FROM sales s
        JOIN products p ON s.product_id = p.id
        {where_sales}
    """, params_sales)
    sales_row = dict(c.fetchone())

    # Giderler
    c.execute(f"""
        SELECT category, SUM(amount) as total
        FROM expenses e
        {where_expenses}
        GROUP BY category
    """, params_expenses)
    expense_rows = [dict(r) for r in c.fetchall()]

    c.execute(f"""
        SELECT SUM(amount) as total_expenses
        FROM expenses e
        {where_expenses}
    """, params_expenses)
    total_expenses_row = dict(c.fetchone())

    gross_revenue = sales_row.get("gross_revenue") or 0
    cogs = sales_row.get("cost_of_goods") or 0
    gross_profit = gross_revenue - cogs
    total_expenses = total_expenses_row.get("total_expenses") or 0
    operating_income = gross_profit - total_expenses
    tax_provision = max(operating_income * 0.20, 0)  # %20 kurumlar vergisi
    net_income = operating_income - tax_provision

    conn.close()
    return {
        "gross_revenue": gross_revenue,
        "cogs": cogs,
        "gross_profit": gross_profit,
        "gross_margin_pct": (gross_profit / max(gross_revenue, 1)) * 100,
        "total_expenses": total_expenses,
        "operating_income": operating_income,
        "operating_margin_pct": (operating_income / max(gross_revenue, 1)) * 100,
        "tax_provision": tax_provision,
        "net_income": net_income,
        "net_margin_pct": (net_income / max(gross_revenue, 1)) * 100,
        "expenses_by_category": expense_rows,
    }


def get_monthly_pl(months: int = 12):
    conn = get_connection()
    c = conn.cursor()
    cutoff = (datetime.now() - timedelta(days=months * 30)).strftime("%Y-%m-%d")
    c.execute("""
        SELECT strftime('%Y-%m', s.sale_date) as month,
               SUM(s.total_price) as revenue,
               SUM(s.quantity * p.buy_price) as cogs
        FROM sales s
        JOIN products p ON s.product_id = p.id
        WHERE s.sale_date >= ?
        GROUP BY month ORDER BY month
    """, (cutoff,))
    sales_rows = {r["month"]: dict(r) for r in c.fetchall()}

    c.execute("""
        SELECT strftime('%Y-%m', expense_date) as month,
               SUM(amount) as expenses
        FROM expenses WHERE expense_date >= ?
        GROUP BY month ORDER BY month
    """, (cutoff,))
    expense_rows = {r["month"]: dict(r) for r in c.fetchall()}

    all_months = sorted(set(list(sales_rows.keys()) + list(expense_rows.keys())))
    result = []
    for m in all_months:
        rev = sales_rows.get(m, {}).get("revenue", 0) or 0
        cogs = sales_rows.get(m, {}).get("cogs", 0) or 0
        exp = expense_rows.get(m, {}).get("expenses", 0) or 0
        gross = rev - cogs
        net = gross - exp
        result.append({"month": m, "revenue": rev, "cogs": cogs,
                       "gross_profit": gross, "expenses": exp, "net_income": net})
    conn.close()
    return result


def get_all_expenses(limit: int = 100):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM expenses ORDER BY expense_date DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def add_expense(data: dict):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO expenses (category, description, amount, expense_date, payment_method, receipt_no, notes)
        VALUES (:category, :description, :amount, :expense_date, :payment_method, :receipt_no, :notes)
    """, data)
    conn.commit()
    conn.close()


# ── Sales Queries ─────────────────────────────────────────────────────────────

def get_sales_summary(days: int = 30):
    conn = get_connection()
    c = conn.cursor()
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    c.execute("""
        SELECT COUNT(*) as total_orders, SUM(quantity) as total_units,
               SUM(total_price) as total_revenue, AVG(total_price) as avg_order_value
        FROM sales WHERE sale_date >= ?
    """, (cutoff,))
    summary = dict(c.fetchone())

    c.execute("""
        SELECT p.category, SUM(s.total_price) as revenue, SUM(s.quantity) as units
        FROM sales s JOIN products p ON s.product_id = p.id
        WHERE s.sale_date >= ?
        GROUP BY p.category ORDER BY revenue DESC
    """, (cutoff,))
    summary["by_category"] = [dict(r) for r in c.fetchall()]

    c.execute("""
        SELECT s.region, SUM(s.total_price) as revenue
        FROM sales s WHERE s.sale_date >= ?
        GROUP BY s.region ORDER BY revenue DESC
    """, (cutoff,))
    summary["by_region"] = [dict(r) for r in c.fetchall()]

    c.execute("""
        SELECT s.channel, SUM(s.total_price) as revenue, COUNT(*) as orders
        FROM sales s WHERE s.sale_date >= ?
        GROUP BY s.channel ORDER BY revenue DESC
    """, (cutoff,))
    summary["by_channel"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return summary


def get_daily_sales(days: int = 30):
    conn = get_connection()
    c = conn.cursor()
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    c.execute("""
        SELECT DATE(sale_date) as day, SUM(total_price) as revenue, COUNT(*) as orders
        FROM sales WHERE sale_date >= ?
        GROUP BY day ORDER BY day
    """, (cutoff,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_top_products(limit: int = 10, days: int = 30):
    conn = get_connection()
    c = conn.cursor()
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    c.execute("""
        SELECT p.name, p.category, SUM(s.total_price) as revenue,
               SUM(s.quantity) as units, AVG(s.unit_price) as avg_price
        FROM sales s JOIN products p ON s.product_id = p.id
        WHERE s.sale_date >= ?
        GROUP BY p.id ORDER BY revenue DESC LIMIT ?
    """, (cutoff, limit))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_monthly_trend(months: int = 12):
    conn = get_connection()
    c = conn.cursor()
    cutoff = (datetime.now() - timedelta(days=months * 30)).strftime("%Y-%m-%d")
    c.execute("""
        SELECT strftime('%Y-%m', sale_date) as month,
               SUM(total_price) as revenue, COUNT(*) as orders, SUM(quantity) as units
        FROM sales WHERE sale_date >= ?
        GROUP BY month ORDER BY month
    """, (cutoff,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


# ── Inventory ─────────────────────────────────────────────────────────────────

def get_low_stock_products():
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM products WHERE stock <= min_stock ORDER BY stock ASC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_stock_value():
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        SELECT SUM(stock * buy_price) as total_cost,
               SUM(stock * sell_price) as total_retail,
               COUNT(*) as product_count, SUM(stock) as total_units
        FROM products
    """)
    row = dict(c.fetchone())
    conn.close()
    return row


def update_stock(product_id: int, quantity: int, movement_type: str, reason: str = ""):
    conn = get_connection()
    c = conn.cursor()
    c.execute("UPDATE products SET stock = stock + ? WHERE id=?", (quantity, product_id))
    c.execute("""
        INSERT INTO stock_movements (product_id, movement_type, quantity, reason)
        VALUES (?, ?, ?, ?)
    """, (product_id, movement_type, quantity, reason))
    conn.commit()
    conn.close()


# ── AI Analysis Storage ───────────────────────────────────────────────────────

def save_analysis(analysis_type: str, prompt: str, result: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO ai_analyses (analysis_type, prompt, result)
        VALUES (?, ?, ?)
    """, (analysis_type, prompt, result))
    conn.commit()
    conn.close()


def get_recent_analyses(limit: int = 20):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM ai_analyses ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


# ── Marketing ─────────────────────────────────────────────────────────────────

def get_all_campaigns():
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM marketing_campaigns ORDER BY created_at DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def add_campaign(data: dict):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO marketing_campaigns (name, channel, budget, start_date, end_date, status, notes)
        VALUES (:name, :channel, :budget, :start_date, :end_date, :status, :notes)
    """, data)
    conn.commit()
    conn.close()
