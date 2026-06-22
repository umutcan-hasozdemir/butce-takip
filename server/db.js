import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, "fintrack.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------- Şema (multi-tenant) ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin','accountant','employee')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL CHECK (type IN ('income','expense')),
    color      TEXT NOT NULL DEFAULT '#64748b',
    icon       TEXT NOT NULL DEFAULT '📦',
    is_default INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS departments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    UNIQUE (company_id, name)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type          TEXT NOT NULL CHECK (type IN ('income','expense')),
    amount        REAL NOT NULL CHECK (amount > 0),
    category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    vendor        TEXT DEFAULT '',
    description   TEXT DEFAULT '',
    date          TEXT NOT NULL,
    created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------- Yeni bir şirket için varsayılan kategori/departmanları oluşturur ----------
export function seedDefaultsForCompany(companyId) {
  const insertCat = db.prepare(
    "INSERT INTO categories (company_id, name, type, color, icon, is_default) VALUES (?, ?, ?, ?, ?, 1)"
  );
  const defaults = [
    ["Personel / Maaş", "expense", "#ef4444", "👥"],
    ["Kira & Aidat", "expense", "#8b5cf6", "🏢"],
    ["Yazılım & Abonelik", "expense", "#06b6d4", "💻"],
    ["Pazarlama & Reklam", "expense", "#ec4899", "📣"],
    ["Ofis & Ekipman", "expense", "#f97316", "🖥️"],
    ["Seyahat & Konaklama", "expense", "#eab308", "✈️"],
    ["Faturalar (elektrik, internet)", "expense", "#22c55e", "🧾"],
    ["Vergi & Resmi Ödemeler", "expense", "#64748b", "🏛️"],
    ["Satış Geliri", "income", "#22c55e", "💰"],
    ["Hizmet Geliri", "income", "#14b8a6", "🤝"],
    ["Yatırım / Faiz", "income", "#3b82f6", "📈"],
    ["Diğer Gelir", "income", "#a855f7", "✨"],
  ];
  for (const d of defaults) insertCat.run(companyId, ...d);

  const insertDep = db.prepare(
    "INSERT INTO departments (company_id, name) VALUES (?, ?)"
  );
  for (const name of [
    "Genel Yönetim",
    "Satış & Pazarlama",
    "Yazılım & Ar-Ge",
    "İnsan Kaynakları",
    "Operasyon",
  ]) {
    insertDep.run(companyId, name);
  }
}

// ---------- Demo şirket + kullanıcılar + örnek işlemler (yalnızca ilk kurulumda) ----------
const seedDemo = db.transaction(() => {
  const companyCount = db.prepare("SELECT COUNT(*) AS c FROM companies").get().c;
  if (companyCount > 0) return;

  const companyId = db
    .prepare("INSERT INTO companies (name) VALUES (?)")
    .run("Demo Şirket A.Ş.").lastInsertRowid;

  const hash = (pw) => bcrypt.hashSync(pw, 10);
  const insertUser = db.prepare(
    "INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
  );
  const adminId = insertUser.run(companyId, "Demo Yönetici", "admin@demo.com", hash("demo1234"), "admin").lastInsertRowid;
  insertUser.run(companyId, "Demo Muhasebe", "muhasebe@demo.com", hash("demo1234"), "accountant");
  insertUser.run(companyId, "Demo Çalışan", "calisan@demo.com", hash("demo1234"), "employee");

  seedDefaultsForCompany(companyId);

  // Örnek işlemler
  const catId = (name) =>
    db.prepare("SELECT id FROM categories WHERE company_id = ? AND name = ?").get(companyId, name)?.id;
  const depId = (name) =>
    db.prepare("SELECT id FROM departments WHERE company_id = ? AND name = ?").get(companyId, name)?.id;

  const now = new Date();
  const d = (monthsAgo, day) =>
    new Date(now.getFullYear(), now.getMonth() - monthsAgo, day).toISOString().slice(0, 10);

  const samples = [
    ["income", 480000, "Satış Geliri", "Satış & Pazarlama", "Acme A.Ş.", "Q dönemi satış", 0, 2],
    ["income", 120000, "Hizmet Geliri", "Operasyon", "Beta Ltd.", "Danışmanlık hizmeti", 0, 5],
    ["expense", 185000, "Personel / Maaş", "Genel Yönetim", "", "Aylık bordro", 0, 1],
    ["expense", 45000, "Kira & Aidat", "Genel Yönetim", "Plaza Yönetim", "Ofis kirası", 0, 3],
    ["expense", 18500, "Yazılım & Abonelik", "Yazılım & Ar-Ge", "Microsoft", "Azure + 365", 0, 7],
    ["expense", 32000, "Pazarlama & Reklam", "Satış & Pazarlama", "Google Ads", "Reklam bütçesi", 0, 9],
    ["expense", 9800, "Faturalar (elektrik, internet)", "Operasyon", "Türk Telekom", "İnternet + elektrik", 0, 12],
    ["income", 450000, "Satış Geliri", "Satış & Pazarlama", "Acme A.Ş.", "Önceki dönem satış", 1, 2],
    ["expense", 180000, "Personel / Maaş", "Genel Yönetim", "", "Aylık bordro", 1, 1],
    ["expense", 45000, "Kira & Aidat", "Genel Yönetim", "Plaza Yönetim", "Ofis kirası", 1, 3],
    ["expense", 26000, "Seyahat & Konaklama", "Satış & Pazarlama", "THY", "Müşteri ziyareti", 1, 8],
    ["income", 410000, "Satış Geliri", "Satış & Pazarlama", "Acme A.Ş.", "Satış", 2, 2],
    ["expense", 175000, "Personel / Maaş", "Genel Yönetim", "", "Aylık bordro", 2, 1],
    ["expense", 15000, "Ofis & Ekipman", "Yazılım & Ar-Ge", "Teknosa", "Laptop alımı", 2, 6],
  ];
  const insert = db.prepare(
    `INSERT INTO transactions (company_id, type, amount, category_id, department_id, vendor, description, date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const [type, amount, cat, dep, vendor, desc, mAgo, day] of samples) {
    insert.run(companyId, type, amount, catId(cat), depId(dep), vendor, desc, d(mAgo, day), adminId);
  }
});

seedDemo();

export default db;
