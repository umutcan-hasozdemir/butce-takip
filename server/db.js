import pg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

// NUMERIC (OID 1700) değerlerini JS sayısı olarak döndür (varsayılan string gelir)
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("⚠️  DATABASE_URL tanımlı değil. server/.env dosyasına ekleyin.");
}

// Yerel Postgres SSL istemez; Neon/bulut Postgres ister.
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString || "");
export const pool = new pg.Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// Kısa sorgu yardımcıları
export async function q(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}
export async function one(text, params) {
  const res = await pool.query(text, params);
  return res.rows[0] || null;
}

// ---------- Şema oluşturma (idempotent) ----------
export async function createSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('admin','accountant','employee')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id         SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL CHECK (type IN ('income','expense')),
      color      TEXT NOT NULL DEFAULT '#64748b',
      icon       TEXT NOT NULL DEFAULT '📦',
      is_default BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS departments (
      id         SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      UNIQUE (company_id, name)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id            SERIAL PRIMARY KEY,
      company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      type          TEXT NOT NULL CHECK (type IN ('income','expense')),
      amount        NUMERIC NOT NULL CHECK (amount > 0),
      category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      vendor        TEXT DEFAULT '',
      description   TEXT DEFAULT '',
      date          TEXT NOT NULL,
      created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// ---------- Yeni şirket için varsayılan kategori/departmanlar ----------
export async function seedDefaultsForCompany(companyId) {
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
  for (const [name, type, color, icon] of defaults) {
    await pool.query(
      "INSERT INTO categories (company_id, name, type, color, icon, is_default) VALUES ($1,$2,$3,$4,$5,true)",
      [companyId, name, type, color, icon]
    );
  }
  for (const name of ["Genel Yönetim", "Satış & Pazarlama", "Yazılım & Ar-Ge", "İnsan Kaynakları", "Operasyon"]) {
    await pool.query("INSERT INTO departments (company_id, name) VALUES ($1,$2)", [companyId, name]);
  }
}

// ---------- Demo şirket + kullanıcılar + örnek işlemler (yalnızca boşsa) ----------
export async function seedDemo() {
  const existing = await one("SELECT COUNT(*)::int AS c FROM companies");
  if (existing.c > 0) return;

  const company = await one("INSERT INTO companies (name) VALUES ($1) RETURNING id", ["Demo Şirket A.Ş."]);
  const companyId = company.id;
  const hash = (pw) => bcrypt.hashSync(pw, 10);
  const admin = await one(
    "INSERT INTO users (company_id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,'admin') RETURNING id",
    [companyId, "Demo Yönetici", "admin@demo.com", hash("demo1234")]
  );
  await pool.query("INSERT INTO users (company_id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,'accountant')",
    [companyId, "Demo Muhasebe", "muhasebe@demo.com", hash("demo1234")]);
  await pool.query("INSERT INTO users (company_id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,'employee')",
    [companyId, "Demo Çalışan", "calisan@demo.com", hash("demo1234")]);

  await seedDefaultsForCompany(companyId);

  const catId = async (name) =>
    (await one("SELECT id FROM categories WHERE company_id=$1 AND name=$2", [companyId, name]))?.id;
  const depId = async (name) =>
    (await one("SELECT id FROM departments WHERE company_id=$1 AND name=$2", [companyId, name]))?.id;

  const now = new Date();
  const d = (m, day) => new Date(now.getFullYear(), now.getMonth() - m, day).toISOString().slice(0, 10);

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
  for (const [type, amount, cat, dep, vendor, desc, m, day] of samples) {
    await pool.query(
      `INSERT INTO transactions (company_id, type, amount, category_id, department_id, vendor, description, date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [companyId, type, amount, await catId(cat), await depId(dep), vendor, desc, d(m, day), admin.id]
    );
  }
}
