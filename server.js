const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./database.db");

// ---------------- CREATE TABLES ----------------
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT,
        password TEXT,
        address TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS menu (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hanout TEXT,
        name TEXT,
        price REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hanout TEXT,
        customer TEXT,
        phone TEXT,
        total REAL,
        created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_name TEXT,
        quantity REAL,
        price REAL
    )`);
});

// ---------------- ADMIN REGISTER ----------------
app.post("/admin/register", (req, res) => {
    const { fullname, password, address } = req.body;

    db.run(
        `INSERT INTO admins (fullname, password, address) VALUES (?, ?, ?)`,
        [fullname, password, address],
        err => {
            if (err) return res.status(500).send("Erreur admin");
            res.json({ success: true });
        }
    );
});

// ---------------- ADMIN LOGIN ----------------
app.post("/admin/login", (req, res) => {
    const { fullname, password } = req.body;

    db.get(
        `SELECT * FROM admins WHERE fullname=? AND password=?`,
        [fullname, password],
        (err, admin) => {
            if (err) return res.status(500).send("Erreur serveur");
if (!admin) return res.status(401).send("Accès refusé");
        }
    );
});

// ---------------- GET MENU ----------------
app.get("/menu/:hanout", (req, res) => {
    db.all(`SELECT * FROM menu WHERE hanout=?`, [req.params.hanout], (err, rows) => {
        res.json(rows);
    });
});

// ---------------- ADD MENU ITEM ----------------
app.post("/menu", (req, res) => {
    const { hanout, name, price } = req.body;

    db.run(`INSERT INTO menu (hanout, name, price) VALUES (?, ?, ?)`,
        [hanout, name, price],
        () => res.json({ success: true })
    );
});

// ---------------- DELETE MENU ITEM ----------------
app.delete("/menu/:id", (req, res) => {
    db.run(`DELETE FROM menu WHERE id=?`, [req.params.id], () => {
        res.json({ success: true });
    });
});

// ---------------- SAVE ORDER ----------------
app.post("/order", (req, res) => {
    const { hanout, customer, phone, total, items } = req.body;

    const date = new Date().toLocaleString();

    db.run(
        `INSERT INTO orders (hanout, customer, phone, total, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [hanout, customer, phone, total, date],
        function () {
            const orderId = this.lastID;

            items.forEach(item => {
                db.run(
                    `INSERT INTO order_items (order_id, product_name, quantity, price)
                     VALUES (?, ?, ?, ?)`,
                    [orderId, item.name, item.qty, item.price]
                );
            });

            res.json({ success: true });
        }
    );
});

// ---------------- LOAD ORDERS ----------------
app.get("/orders/:hanout", (req, res) => {
    db.all(`SELECT * FROM orders WHERE hanout=? ORDER BY id DESC`,
        [req.params.hanout],
        (err, rows) => res.json(rows)
    );
});

// ---------------- ORDER ITEMS ----------------
app.get("/orders/items/:orderId", (req, res) => {
    db.all(`SELECT * FROM order_items WHERE order_id=?`,
        [req.params.orderId],
        (err, rows) => res.json(rows)
    );
});

// ---------------- DELETE ORDER ----------------
app.delete("/orders/:id", (req, res) => {
    db.run(`DELETE FROM orders WHERE id=?`, [req.params.id], () => {
        res.json({ success: true });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Backend running on port " + PORT));