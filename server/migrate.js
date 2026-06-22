// Bulut veritabanını (Neon) ilk kez hazırlamak için bir kez çalıştırın:
//   DATABASE_URL ayarlı .env ile:  node migrate.js
import { createSchema, seedDemo, pool } from "./db.js";

try {
  await createSchema();
  console.log("✅ Şema oluşturuldu.");
  await seedDemo();
  console.log("✅ Demo veri eklendi (şirket + kullanıcılar + örnek işlemler).");
} catch (e) {
  console.error("❌ Migrasyon hatası:", e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
