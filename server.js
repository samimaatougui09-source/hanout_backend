
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const OWNER_KEY = process.env.OWNER_KEY || "sami-site";
const db = new sqlite3.Database("./hanout.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname TEXT,
    password TEXT,
    shop_name TEXT,
    shop_address TEXT,
    active INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER,
    name TEXT,
    price REAL,
    unit TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER,
    customer TEXT,
    phone TEXT,
    description TEXT,
    total REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_name TEXT,
    quantity TEXT,
    price REAL
  )`);
});

app.post("/admin/signup", (req, res) => {
  const { fullname, password, shop_name, shop_address, secret_key } = req.body;
  if (secret_key !== OWNER_KEY) return res.status(403).json({ error: "Invalid Key" });

  db.run(
    `INSERT INTO admins (fullname, password, shop_name, shop_address)
     VALUES (?, ?, ?, ?)`,
    [fullname, password, shop_name, shop_address],
    function () {
      res.json({ success: true, adminId: this.lastID });
    }
  );
});

app.post("/admin/login", (req, res) => {
  const { fullname, password } = req.body;

  db.get(
    `SELECT * FROM admins WHERE fullname=? AND password=? AND active=1`,
    [fullname, password],
    (err, admin) => {
      if (!admin) return res.status(401).json({ error: "Unauthorized" });
      res.json({ success: true, adminId: admin.id, shop_name: admin.shop_name });
    }
  );
});

app.get("/shops", (req, res) => {
  db.all(`SELECT id, shop_name, shop_address FROM admins WHERE active=1`, [], (e, r) => res.json(r));
});

app.post("/menu", (req, res) => {
  const { shop_id, name, price, unit } = req.body;
  db.run(`INSERT INTO menu_items VALUES (NULL, ?, ?, ?, ?)`,
    [shop_id, name, price, unit],
    () => res.json({ success: true }));
});

app.get("/menu/:shopId", (req, res) => {
  db.all(`SELECT * FROM menu_items WHERE shop_id=?`, [req.params.shopId], (e, r) => res.json(r));
});

app.delete("/menu/:id", (req, res) => {
  db.run(`DELETE FROM menu_items WHERE id=?`, [req.params.id], () => res.json({ success: true }));
});

app.post("/order", (req, res) => {
  const { shop_id, customer, phone, description, total, items } = req.body;

  db.run(
    `INSERT INTO orders (shop_id, customer, phone, description, total)
     VALUES (?, ?, ?, ?, ?)`,
    [shop_id, customer, phone, description, total],
    function () {
      const orderId = this.lastID;
      const stmt = db.prepare(`INSERT INTO order_items VALUES (NULL, ?, ?, ?, ?)`);
      items.forEach(i => stmt.run(orderId, i.name, i.qty, i.price));
      stmt.finalize();
      res.json({ success: true });
    }
  );
});

app.get("/orders/:shopId", (req, res) => {
  db.all(`SELECT * FROM orders WHERE shop_id=? ORDER BY created_at DESC`, [req.params.shopId], (e, r) => res.json(r));
});

app.get("/order_items/:orderId", (req, res) => {
  db.all(`SELECT * FROM order_items WHERE order_id=?`, [req.params.orderId], (e, r) => res.json(r));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
