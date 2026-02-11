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
      price REAL,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    )
  `);
});

// Save order
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

      items.forEach((item) => {
        stmt.run(orderId, item.name, item.qty, item.price);
      });

      stmt.finalize();
      res.json({ message: "Commande enregistrée avec succès!" });
    }
  );
});

// Get all orders
app.get("/orders", (req, res) => {
  db.all("SELECT * FROM orders ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

// Get items for a specific order
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

// ✅ ONLINE DEPLOYMENT PORT FIX
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));