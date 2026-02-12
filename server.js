const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./hanout.db");

db.serialize(() => {
  // Admins
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT,
      password TEXT,
      shop_name TEXT,
      shop_address TEXT
    )
  `);

  // Orders
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      customer TEXT,
      phone TEXT,
      total REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_name TEXT,
      quantity TEXT,
      price REAL
    )
  `);

  // Menu items
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      name TEXT,
      price REAL,
      unit TEXT
    )
  `);
});

// ---------------- ADMIN ----------------
app.post("/admin/signup", (req, res) => {
  const { fullname, password, shop_name, shop_address } = req.body;
  db.run(
    `INSERT INTO admins (fullname, password, shop_name, shop_address) VALUES (?, ?, ?, ?)`,
    [fullname, password, shop_name, shop_address],
    function(err) {
      if(err) return res.status(500).json(err);
      res.json({ success: true, adminId: this.lastID });
    }
  );
});

app.post("/admin/login", (req, res) => {
  const { fullname, password } = req.body;
  db.get(
    `SELECT * FROM admins WHERE fullname = ? AND password = ?`,
    [fullname, password],
    (err, admin) => {
      if(err || !admin) return res.status(401).json({ error: "Unauthorized" });
      res.json({ success: true, adminId: admin.id, shop_name: admin.shop_name });
    }
  );
});

// ---------------- MENU ----------------
app.post("/menu", (req, res) => {
  const { shop_id, name, price, unit } = req.body;
  db.run(
    `INSERT INTO menu_items (shop_id, name, price, unit) VALUES (?, ?, ?, ?)`,
    [shop_id, name, price, unit],
    function(err) {
      if(err) return res.status(500).json(err);
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.get("/menu/:shopId", (req, res) => {
  db.all(
    `SELECT * FROM menu_items WHERE shop_id = ?`,
    [req.params.shopId],
    (err, rows) => {
      if(err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

app.put("/menu/:id", (req, res) => {
  const { name, price, unit } = req.body;
  db.run(
    `UPDATE menu_items SET name = ?, price = ?, unit = ? WHERE id = ?`,
    [name, price, unit, req.params.id],
    err => {
      if(err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

app.delete("/menu/:id", (req, res) => {
  db.run(`DELETE FROM menu_items WHERE id = ?`, [req.params.id], err => {
    if(err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// ---------------- ORDERS ----------------
app.post("/order", (req, res) => {
  const { shop_id, customer, phone, total, items } = req.body;
  db.run(
    `INSERT INTO orders (shop_id, customer, phone, total) VALUES (?, ?, ?, ?)`,
    [shop_id, customer, phone, total],
    function(err) {
      if(err) return res.status(500).json(err);

      const orderId = this.lastID;
      const stmt = db.prepare(
        `INSERT INTO order_items (order_id, product_name, quantity, price) VALUES (?, ?, ?, ?)`
      );
      items.forEach(i => stmt.run(orderId, i.name, i.qty, i.price));
      stmt.finalize();
      res.json({ success: true });
    }
  );
});

app.get("/orders/:shopId", (req, res) => {
  db.all(
    `SELECT * FROM orders WHERE shop_id = ? ORDER BY created_at DESC`,
    [req.params.shopId],
    (err, rows) => {
      if(err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

app.delete("/orders/:id", (req, res) => {
  db.run(`DELETE FROM order_items WHERE order_id = ?`, [req.params.id]);
  db.run(`DELETE FROM orders WHERE id = ?`, [req.params.id], () => {
    res.json({ success: true });
  });
});

// ---------------- SHOPS ----------------
app.get("/shops", (req, res) => {
  db.all(`SELECT id, shop_name, shop_address FROM admins`, [], (err, rows) => {
    if(err) return res.status(500).json(err);
    res.json(rows);
  });
});

app.listen(process.env.PORT || 3000, () => console.log("Server running"));
