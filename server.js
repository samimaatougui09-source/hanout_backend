const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Ensure a data folder exists for Render
const dbPath = path.join(__dirname, "data", "hanout.db");
const fs = require("fs");
if (!fs.existsSync(path.join(__dirname, "data"))) fs.mkdirSync(path.join(__dirname, "data"));

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT,
      password TEXT,
      shop_name TEXT,
      shop_address TEXT
    )
  `);

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
      quantity REAL,
      price REAL
    )
  `);
});

// ---------------- ADMIN SIGNUP ----------------
app.post("/admin/signup", (req, res) => {
  const { fullname, password, shop_name, shop_address } = req.body;
  db.run(
    `INSERT INTO admins (fullname, password, shop_name, shop_address)
     VALUES (?, ?, ?, ?)`,
    [fullname, password, shop_name, shop_address],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ success: true, adminId: this.lastID });
    }
  );
});

// ---------------- ADMIN LOGIN ----------------
app.post("/admin/login", (req, res) => {
  const { fullname, password } = req.body;
  db.get(
    `SELECT * FROM admins WHERE fullname = ? AND password = ?`,
    [fullname, password],
    (err, admin) => {
      if (err || !admin) return res.status(401).json({ error: "Unauthorized" });
      res.json({
        success: true,
        adminId: admin.id,
        shop_name: admin.shop_name
      });
    }
  );
});

// ---------------- SAVE ORDER ----------------
app.post("/order", (req, res) => {
  const { shop_id, customer, phone, total, items } = req.body;
  db.run(
    `INSERT INTO orders (shop_id, customer, phone, total) VALUES (?, ?, ?, ?)`,
    [shop_id, customer, phone, total],
    function (err) {
      if (err) return res.status(500).json(err);
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

// ---------------- GET ORDERS ----------------
app.get("/orders/:shopId", (req, res) => {
  db.all(
    `SELECT * FROM orders WHERE shop_id = ? ORDER BY created_at DESC`,
    [req.params.shopId],
    (err, orders) => {
      if (err) return res.status(500).json(err);
      res.json(orders);
    }
  );
});

// ---------------- GET ORDER ITEMS ----------------
app.get("/items/:orderId", (req, res) => {
  db.all(
    `SELECT * FROM order_items WHERE order_id = ?`,
    [req.params.orderId],
    (err, items) => {
      if (err) return res.status(500).json(err);
      res.json(items);
    }
  );
});

// ---------------- DELETE ORDER ----------------
app.delete("/orders/:id", (req, res) => {
  db.run(`DELETE FROM order_items WHERE order_id = ?`, [req.params.id], err => {
    if (err) return res.status(500).json(err);
    db.run(`DELETE FROM orders WHERE id = ?`, [req.params.id], err2 => {
      if (err2) return res.status(500).json(err2);
      res.json({ success: true });
    });
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on port", process.env.PORT || 3000);
});

