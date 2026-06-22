import app from "./app.js";
import { createSchema, seedDemo } from "./db.js";

const PORT = process.env.PORT || 3001;

// Yerelde başlarken şemayı kur ve demo veriyi (boşsa) ekle
async function start() {
  try {
    await createSchema();
    await seedDemo();
    console.log("✅ Veritabanı hazır (şema + demo veri)");
  } catch (e) {
    console.error("Veritabanı hazırlanırken hata:", e.message);
  }
  app.listen(PORT, () => console.log(`✅ FinTrack API çalışıyor → http://localhost:${PORT}`));
}

start();
