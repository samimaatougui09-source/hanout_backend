const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Database
const db = new sqlite3.Database("./hanout.db", (err) => {
  if (err) console.error(err.message);
  else console.log("Connected to SQLite DB");
});

// Tables
db.serialize(() => {

  // Orders
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  // Admins
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT,
      password TEXT
    )
  `);

  // Menu
  db.run(`
    CREATE TABLE IF NOT EXISTS menu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      price REAL
    )
  `);
});

// Create default admin if none
db.get("SELECT COUNT(*) as count FROM admins", (err, row) => {
  if (row.count === 0) {
    db.run("INSERT INTO admins (fullname, password) VALUES (?, ?)", [
      "Admin Principal",
      "1234"
    ]);
  }
});

// ---------------- SAVE ORDER ----------------
app.post("/order", (req, res) => {
  const { customer, phone, total, items } = req.body;

  if (!customer || !phone || !items || items.length === 0)
    return res.status(400).json({ error: "Invalid data" });

  db.run(
    "INSERT INTO orders (customer, phone, total) VALUES (?, ?, ?)",
    [customer, phone, total],
    function (err) {
      if (err) return res.status(500).json(err);

      const orderId = this.lastID;
      const stmt = db.prepare(
        "INSERT INTO order_items (order_id, product_name, quantity, price) VALUES (?, ?, ?, ?)"
      );

      items.forEach(item => {
        stmt.run(orderId, item.name, item.qty, item.price);
      });

      stmt.finalize();
      res.json({ success: true });
    }
  );
});

// ---------------- GET ORDERS ----------------
app.get("/orders", (req, res) => {
  db.all("SELECT * FROM orders ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

// ---------------- GET ORDER ITEMS ----------------
app.get("/orders/:id/items", (req, res) => {
  db.all(
    "SELECT * FROM order_items WHERE order_id = ?",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

// ---------------- DELETE ORDER ----------------
app.delete("/orders/:id", (req, res) => {
  const id = req.params.id;

  db.run("DELETE FROM order_items WHERE order_id = ?", [id], function (err) {
    if (err) return res.status(500).json(err);

    db.run("DELETE FROM orders WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    });
  });
});

// ---------------- ADMIN LOGIN ----------------
app.post("/admin/login", (req, res) => {
  const { fullname, password } = req.body;

  db.get(
    "SELECT * FROM admins WHERE fullname = ? AND password = ?",
    [fullname, password],
    (err, admin) => {
      if (err || !admin) return res.status(401).json({ error: "Unauthorized" });
      res.json({ success: true });
    }
  );
});

// ---------------- MENU ----------------
app.get("/menu", (req, res) => {
  db.all("SELECT * FROM menu", [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

app.post("/menu", (req, res) => {
  const { name, price } = req.body;
  db.run("INSERT INTO menu (name, price) VALUES (?, ?)", [name, price], () => {
    res.json({ success: true });
  });
});

app.delete("/menu/:id", (req, res) => {
  db.run("DELETE FROM menu WHERE id = ?", [req.params.id], () => {
    res.json({ success: true });
  });
});

// ---------------- SERVER ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));