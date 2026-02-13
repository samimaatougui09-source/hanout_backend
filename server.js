require("dotenv").config();
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const db = new sqlite3.Database("./hanout.db");

const HANOUT_KEY = process.env.ADMIN_KEY || "hanout-tea";
const SITE_KEY = process.env.SITE_KEY || "sami-site";
const SITE_NAME = process.env.SITE_NAME || "Tea Shop";

// ==================== CRÉATION DES TABLES ====================
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname TEXT,
    password TEXT,
    shop_name TEXT,
    shop_address TEXT,
    blocked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER,
    name TEXT,
    price REAL,
    unit TEXT,
    sizes TEXT,
    available INTEGER DEFAULT 1,
    FOREIGN KEY(shop_id) REFERENCES admins(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER,
    order_number TEXT UNIQUE,
    customer TEXT,
    phone TEXT,
    address TEXT,
    total REAL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shop_id) REFERENCES admins(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_name TEXT,
    quantity TEXT,
    price REAL,
    size TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  )`);

  // ========== PREMIER SHOP (شاي تيميمون - 23 produits) ==========
  db.get("SELECT COUNT(*) as count FROM admins", [], (err, row) => {
    if (row.count === 0) {
      console.log("🛠️ création du premier shop (شاي تيميمون)...");
      
      db.run(
        `INSERT INTO admins (fullname, password, shop_name, shop_address) VALUES (?, ?, ?, ?)`,
        ["admin", "admin123", "شاي تيميمون - Thé Timimoun", "Alger Centre"],
        function(err) {
          if (err) return;
          const shopId = this.lastID;
          
          const stmt = db.prepare(
            `INSERT INTO menu_items (shop_id, name, price, unit, sizes) VALUES (?, ?, ?, ?, ?)`
          );
          
          // THÉS (3)
          stmt.run(shopId, "Thé normal - شاي عادي", 30, "fixed", "Petite صغير,Moyenne وسط,Grande كبير");
          stmt.run(shopId, "Thé au miel - شاي بالعسل", 40, "fixed", "Petite صغير,Moyenne وسط,Grande كبير");
          stmt.run(shopId, "Thé au miel & citron - شاي بالعسل والليمون", 40, "fixed", "Petite صغير,Moyenne وسط,Grande كبير");
          
          // PÂTISSERIES (9)
          stmt.run(shopId, "Ktaïf - قطايف", 70, "fixed", null);
          stmt.run(shopId, "Flan aux pistaches - فلون بالبستاش", 50, "fixed", null);
          stmt.run(shopId, "Flan à la crème (pot) - فلون بالكريمة", 70, "fixed", null);
          stmt.run(shopId, "Cœur d'amande - قلب اللوز", 50, "fixed", null);
          stmt.run(shopId, "Tarte chamia turque - طارت شامية تركية", 80, "fixed", null);
          stmt.run(shopId, "Baklava turc - بقلاوة تركية", 70, "fixed", null);
          stmt.run(shopId, "Cigare au chocolat - سيڨار شوكولا", 80, "fixed", null);
          stmt.run(shopId, "Tarte au chocolat - طارت شوكولا", 80, "fixed", null);
          stmt.run(shopId, "Chamia Sid Cheikh - شامية سيد الشيخ", 180, "fixed", null);
          
          // FRUITS SECS (11)
          stmt.run(shopId, "Chips - شيبس", 120, "gram", null);
          stmt.run(shopId, "Cacahuètes - كاوكاو", 80, "gram", null);
          stmt.run(shopId, "Cacahuètes fumées - كاوكاو مدخن", 120, "gram", null);
          stmt.run(shopId, "Noix de cajou - كاجو", 380, "gram", null);
          stmt.run(shopId, "Pistaches - بستاش", 380, "gram", null);
          stmt.run(shopId, "Amandes - لوز", 350, "gram", null);
          stmt.run(shopId, "Noix - جوز ممتاز", 260, "gram", null);
          stmt.run(shopId, "Graines de citrouille - بدور اليقطين", 260, "gram", null);
          
          stmt.finalize();
          console.log("✅ شاي تيميمون créé avec 23 produits!");
        }
      );
    }
  });
});

// ==================== MIDDLEWARE ====================
function verifySiteKey(req, res, next) {
  const key = req.headers["site-key"];
  if (key !== SITE_KEY) return res.status(403).json({ error: "ممنوع - مفتاح الموقع خطأ" });
  next();
}

// ==================== ROUTES SITE OWNER ====================
app.get("/api/v1/site/admins", verifySiteKey, (req, res) => {
  db.all(`
    SELECT a.*, 
      COUNT(DISTINCT o.id) as total_orders,
      IFNULL(SUM(o.total), 0) as total_revenue,
      COUNT(DISTINCT m.id) as total_products
    FROM admins a
    LEFT JOIN orders o ON a.id = o.shop_id
    LEFT JOIN menu_items m ON a.id = m.shop_id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

app.delete("/api/v1/site/admins/:id", verifySiteKey, (req, res) => {
  db.run("DELETE FROM admins WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "✅ محل حذف شد" });
  });
});

app.put("/api/v1/site/admins/:id/block", verifySiteKey, (req, res) => {
  const { blocked } = req.body;
  db.run("UPDATE admins SET blocked = ? WHERE id = ?", [blocked ? 1 : 0, req.params.id], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: blocked ? "🚫 تم الحظر" : "✅ رفع الحظر" });
  });
});

app.get("/api/v1/site/stats", verifySiteKey, (req, res) => {
  db.get(`
    SELECT 
      (SELECT COUNT(*) FROM admins) as total_shops,
      (SELECT COUNT(*) FROM admins WHERE blocked = 1) as blocked_shops,
      (SELECT COUNT(*) FROM orders) as total_orders,
      (SELECT IFNULL(SUM(total), 0) FROM orders) as total_revenue,
      (SELECT COUNT(*) FROM menu_items) as total_products
  `, [], (err, stats) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: stats });
  });
});

// ==================== ADMIN SIGNUP (Nouveau shop = 11 produits) ====================
app.post("/api/v1/admin/signup", (req, res) => {
  const { fullname, password, shop_name, shop_address, key } = req.body;
  
  if (key !== HANOUT_KEY) {
    return res.status(403).json({ success: false, error: "❌ مفتاح التسجيل خطأ" });
  }

  db.run(
    `INSERT INTO admins (fullname, password, shop_name, shop_address) VALUES (?, ?, ?, ?)`,
    [fullname, password, shop_name, shop_address],
    function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      
      const shopId = this.lastID;
      const stmt = db.prepare(
        `INSERT INTO menu_items (shop_id, name, price, unit, sizes) VALUES (?, ?, ?, ?, ?)`
      );
      
      // THÉS (3 - avec tailles)
      stmt.run(shopId, "Thé normal - شاي عادي", 30, "fixed", "Petite صغير,Moyenne وسط,Grande كبير");
      stmt.run(shopId, "Thé au miel - شاي بالعسل", 40, "fixed", "Petite صغير,Moyenne وسط,Grande كبير");
      stmt.run(shopId, "Thé au miel & citron - شاي بالعسل والليمون", 40, "fixed", "Petite صغير,Moyenne وسط,Grande كبير");
      
      // FRUITS SECS (8 - en grammes)
      stmt.run(shopId, "Chips - شيبس", 120, "gram", null);
      stmt.run(shopId, "Cacahuètes - كاوكاو", 80, "gram", null);
      stmt.run(shopId, "Cacahuètes fumées - كاوكاو مدخن", 120, "gram", null);
      stmt.run(shopId, "Noix de cajou - كاجو", 380, "gram", null);
      stmt.run(shopId, "Pistaches - بستاش", 380, "gram", null);
      stmt.run(shopId, "Amandes - لوز", 350, "gram", null);
      stmt.run(shopId, "Noix - جوز ممتاز", 260, "gram", null);
      stmt.run(shopId, "Graines de citrouille - بدور اليقطين", 260, "gram", null);
      
      stmt.finalize();
      
      res.json({ 
        success: true, 
        message: "✅ محل جديد + 11 منتج (طاي + مكسرات)",
        adminId: shopId 
      });
    }
  );
});

// ==================== ADMIN LOGIN ====================
app.post("/api/v1/admin/login", (req, res) => {
  const { fullname, password } = req.body;
  db.get(
    `SELECT * FROM admins WHERE fullname = ? AND password = ?`,
    [fullname, password],
    (err, admin) => {
      if (err || !admin) {
        return res.status(401).json({ success: false, error: "❌ اسم المستخدم أو كلمة السر خطأ" });
      }
      if (admin.blocked === 1) {
        return res.status(403).json({ success: false, error: "🚫 هذا المحل محظور" });
      }
      res.json({ 
        success: true, 
        data: {
          adminId: admin.id,
          shop_name: admin.shop_name,
          shop_address: admin.shop_address
        }
      });
    }
  );
});

// ==================== MENU ROUTES ====================
app.get("/api/v1/menu/:shopId", (req, res) => {
  db.all(`SELECT * FROM menu_items WHERE shop_id = ? AND available = 1`, [req.params.shopId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

app.post("/api/v1/menu", (req, res) => {
  const { shop_id, name, price, unit, sizes } = req.body;
  db.run(
    `INSERT INTO menu_items (shop_id, name, price, unit, sizes) VALUES (?, ?, ?, ?, ?)`,
    [shop_id, name, price, unit, sizes || null],
    function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put("/api/v1/menu/:id", (req, res) => {
  const { name, price, unit, sizes, available } = req.body;
  db.run(
    `UPDATE menu_items SET name = ?, price = ?, unit = ?, sizes = ?, available = ? WHERE id = ?`,
    [name, price, unit, sizes, available ? 1 : 0, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete("/api/v1/menu/:id", (req, res) => {
  db.run(`DELETE FROM menu_items WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true });
  });
});

// ==================== ORDERS ROUTES ====================
app.post("/api/v1/order", (req, res) => {
  const { shop_id, customer, phone, address, total, description, items } = req.body;
  const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  db.run(
    `INSERT INTO orders (shop_id, order_number, customer, phone, address, total, description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [shop_id, orderNumber, customer, phone, address || null, total, description || null],
    function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      
      const orderId = this.lastID;
      const stmt = db.prepare(
        `INSERT INTO order_items (order_id, product_name, quantity, price, size) VALUES (?, ?, ?, ?, ?)`
      );
      
      items.forEach(item => {
        stmt.run(orderId, item.name, item.qty, item.price, item.size || null);
      });
      
      stmt.finalize();
      res.json({ success: true, orderNumber, orderId });
    }
  );
});

app.get("/api/v1/orders/:shopId", (req, res) => {
  const { status } = req.query;
  let query = `SELECT * FROM orders WHERE shop_id = ?`;
  let params = [req.params.shopId];
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

app.put("/api/v1/orders/:id/status", (req, res) => {
  const { status } = req.body;
  db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true });
  });
});

app.delete("/api/v1/orders/:id", (req, res) => {
  db.run(`DELETE FROM orders WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true });
  });
});
// -------------------- GET ORDER ITEMS --------------------
app.get("/api/v1/order_items/:orderId", (req, res) => {
  db.all(
    `SELECT * FROM order_items WHERE order_id = ?`,
    [req.params.orderId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, data: rows });
    }
  );
});

// ==================== SHOPS ROUTES ====================
app.get("/api/v1/shops", (req, res) => {
  db.all(`SELECT id, shop_name, shop_address FROM admins WHERE blocked = 0`, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

app.get("/api/v1/shops/count", (req, res) => {
  db.get(`SELECT COUNT(*) as count FROM admins`, [], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, count: row.count });
  });
});

// ==================== SERVER ====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 ======================================
  🚀 ${SITE_NAME}
  🚀 ======================================
  📡 Port: ${PORT}
  🔑 Admin Key: ${HANOUT_KEY ? '✓' : '✗'}
  👑 Site Key: ${SITE_KEY ? '✓' : '✗'}
  🏪 Premier Shop: شاي تيميمون (23 produits)
  🆕 Nouveaux Shops: 11 produits (Thés + Fruits secs)
  🚀 ======================================
  `);
});