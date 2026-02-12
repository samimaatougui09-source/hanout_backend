const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const SHOP_CREATION_KEY = "SHOP-SECRET-123";
const OWNER_MASTER_KEY = "OWNER-MASTER-999";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const db = new sqlite3.Database("./hanout.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT,
      password TEXT,
      shop_name TEXT,
      shop_address TEXT,
      active INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      customer TEXT,
      phone TEXT,
      description TEXT,
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

  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      name TEXT,
      price REAL,
      unit TEXT,
      sizes TEXT
    )
  `);
});


// ---------------- OWNER PANEL ----------------
app.post("/owner/shops", (req,res)=>{
  if(req.body.masterKey !== OWNER_MASTER_KEY)
    return res.status(403).json({error:"Forbidden"});

  db.all(`SELECT * FROM admins`,[],(err,rows)=>res.json(rows));
});

app.post("/owner/disable/:id", (req,res)=>{
  if(req.body.masterKey !== OWNER_MASTER_KEY)
    return res.status(403).json({error:"Forbidden"});

  db.run(`UPDATE admins SET active = 0 WHERE id=?`,[req.params.id]);
  res.json({success:true});
});

app.delete("/owner/shop/:id", (req,res)=>{
  if(req.body.masterKey !== OWNER_MASTER_KEY)
    return res.status(403).json({error:"Forbidden"});

  db.run(`DELETE FROM admins WHERE id=?`,[req.params.id]);
  db.run(`DELETE FROM menu_items WHERE shop_id=?`,[req.params.id]);
  db.run(`DELETE FROM orders WHERE shop_id=?`,[req.params.id]);
  res.json({success:true});
});


// ---------------- ADMIN ----------------
app.post("/admin/signup", (req,res)=>{
  const {fullname,password,shop_name,shop_address,creationKey} = req.body;

  if(creationKey !== SHOP_CREATION_KEY)
    return res.status(403).json({error:"Invalid Shop Key"});

  db.run(
    `INSERT INTO admins(fullname,password,shop_name,shop_address) VALUES(?,?,?,?)`,
    [fullname,password,shop_name,shop_address],
    function(err){
      if(err) return res.status(500).json(err);
      res.json({success:true,adminId:this.lastID});
    }
  );
});

app.post("/admin/login",(req,res)=>{
  const {fullname,password} = req.body;

  db.get(
    `SELECT * FROM admins WHERE fullname=? AND password=? AND active=1`,
    [fullname,password],
    (err,admin)=>{
      if(!admin) return res.status(401).json({error:"Unauthorized"});
      res.json({success:true,adminId:admin.id,shop_name:admin.shop_name});
    }
  );
});


// ---------------- MENU ----------------
app.post("/menu",(req,res)=>{
  const {shop_id,name,price,unit,sizes} = req.body;

  db.run(
    `INSERT INTO menu_items(shop_id,name,price,unit,sizes) VALUES(?,?,?,?,?)`,
    [shop_id,name,price,unit,sizes],
    ()=>res.json({success:true})
  );
});

app.get("/menu/:shopId",(req,res)=>{
  db.all(`SELECT * FROM menu_items WHERE shop_id=?`,[req.params.shopId],(err,rows)=>res.json(rows));
});

app.delete("/menu/:id",(req,res)=>{
  db.run(`DELETE FROM menu_items WHERE id=?`,[req.params.id],()=>res.json({success:true}));
});


// ---------------- ORDERS ----------------
app.post("/order",(req,res)=>{
  const {shop_id,customer,phone,description,total,items} = req.body;

  db.run(
    `INSERT INTO orders(shop_id,customer,phone,description,total) VALUES(?,?,?,?,?)`,
    [shop_id,customer,phone,description,total],
    function(err){
      const orderId = this.lastID;

      const stmt = db.prepare(
        `INSERT INTO order_items(order_id,product_name,quantity,price) VALUES(?,?,?,?)`
      );

      items.forEach(i=>stmt.run(orderId,i.name,i.qty,i.price));
      stmt.finalize();

      res.json({success:true});
    }
  );
});

app.get("/orders/:shopId",(req,res)=>{
  db.all(`SELECT * FROM orders WHERE shop_id=? ORDER BY created_at DESC`,
  [req.params.shopId],(err,orders)=>{

    const tasks = orders.map(order=>{
      return new Promise(resolve=>{
        db.all(`SELECT * FROM order_items WHERE order_id=?`,[order.id],(e,items)=>{
          order.items = items;
          resolve(order);
        });
      });
    });

    Promise.all(tasks).then(full=>res.json(full));
  });
});

app.delete("/orders/:id",(req,res)=>{
  db.run(`DELETE FROM order_items WHERE order_id=?`,[req.params.id]);
  db.run(`DELETE FROM orders WHERE id=?`,[req.params.id],()=>res.json({success:true}));
});


// ---------------- SHOPS ----------------
app.get("/shops",(req,res)=>{
  db.all(`SELECT id,shop_name,shop_address FROM admins WHERE active=1`,[],(err,rows)=>res.json(rows));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));