const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./hanout.db');

// البيانات الجديدة
const nouveauTitre = "besbes el tarf";
const shopId = 1; // هذا هو id المحل "شاي تيميمون"

db.run(
  "UPDATE admins SET shop_address = ? WHERE id = ?",
  [nouveauTitre, shopId],
  function(err) {
    if (err) {
      console.log("❌ خطأ: " + err.message);
    } else {
      console.log("✅ تم تغيير العنوان إلى: " + nouveauTitre);
    }
    db.close();
  }
);