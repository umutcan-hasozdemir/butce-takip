import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { existsSync } from "fs";
import { pool, q, one, seedDefaultsForCompany } from "./db.js";
import { signToken, authRequired, requireRole } from "./auth.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user, companyName) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.company_id,
    companyName,
  };
}

// Async route hatalarını yakalayan sarmalayıcı
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(500).json({ error: "Sunucu hatası." });
});

// ======================= AUTH =======================
app.post("/api/auth/register", wrap(async (req, res) => {
  const { companyName, name, email, password } = req.body;
  if (!companyName?.trim() || !name?.trim() || !EMAIL_RE.test(email || "") || (password || "").length < 6) {
    return res.status(400).json({ error: "Tüm alanları doldurun (şifre en az 6 karakter)." });
  }
  if (await one("SELECT id FROM users WHERE email=$1", [email.toLowerCase()])) {
    return res.status(409).json({ error: "Bu e-posta zaten kayıtlı." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const company = (await client.query("INSERT INTO companies (name) VALUES ($1) RETURNING id", [companyName.trim()])).rows[0];
    const user = (await client.query(
      "INSERT INTO users (company_id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,'admin') RETURNING *",
      [company.id, name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10)]
    )).rows[0];
    await client.query("COMMIT");
    // Varsayılan kategori/departmanlar (transaction dışında da olur)
    await seedDefaultsForCompany(company.id);
    res.status(201).json({ token: signToken(user), user: publicUser(user, companyName.trim()) });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}));

app.post("/api/auth/login", wrap(async (req, res) => {
  const { email, password } = req.body;
  const user = await one("SELECT * FROM users WHERE email=$1", [(email || "").toLowerCase()]);
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "E-posta veya şifre hatalı." });
  }
  const company = await one("SELECT name FROM companies WHERE id=$1", [user.company_id]);
  res.json({ token: signToken(user), user: publicUser(user, company.name) });
}));

app.get("/api/auth/me", authRequired, wrap(async (req, res) => {
  const user = await one("SELECT * FROM users WHERE id=$1", [req.user.userId]);
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
  const company = await one("SELECT name FROM companies WHERE id=$1", [user.company_id]);
  res.json({ user: publicUser(user, company.name) });
}));

// Bundan sonraki tüm rotalar oturum gerektirir
app.use("/api", authRequired);

// ======================= USERS (admin) =======================
app.get("/api/users", requireRole("admin"), wrap(async (req, res) => {
  res.json(await q("SELECT id, name, email, role, created_at FROM users WHERE company_id=$1 ORDER BY id", [req.user.companyId]));
}));

app.post("/api/users", requireRole("admin"), wrap(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name?.trim() || !EMAIL_RE.test(email || "") || (password || "").length < 6 || !["admin", "accountant", "employee"].includes(role)) {
    return res.status(400).json({ error: "Geçersiz kullanıcı verisi (şifre en az 6 karakter)." });
  }
  if (await one("SELECT id FROM users WHERE email=$1", [email.toLowerCase()])) {
    return res.status(409).json({ error: "Bu e-posta zaten kayıtlı." });
  }
  const u = await one(
    "INSERT INTO users (company_id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, created_at",
    [req.user.companyId, name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10), role]
  );
  res.status(201).json(u);
}));

app.delete("/api/users/:id", requireRole("admin"), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.userId) return res.status(400).json({ error: "Kendi hesabınızı silemezsiniz." });
  const user = await one("SELECT id FROM users WHERE id=$1 AND company_id=$2", [id, req.user.companyId]);
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
  await pool.query("DELETE FROM users WHERE id=$1", [id]);
  res.status(204).end();
}));

// ======================= CATEGORIES =======================
app.get("/api/categories", wrap(async (req, res) => {
  res.json(await q("SELECT * FROM categories WHERE company_id=$1 ORDER BY type, name", [req.user.companyId]));
}));

app.post("/api/categories", requireRole("admin", "accountant"), wrap(async (req, res) => {
  const { name, type, color, icon } = req.body;
  if (!name?.trim() || !["income", "expense"].includes(type)) {
    return res.status(400).json({ error: "Geçersiz kategori verisi." });
  }
  const cat = await one(
    "INSERT INTO categories (company_id, name, type, color, icon, is_default) VALUES ($1,$2,$3,$4,$5,false) RETURNING *",
    [req.user.companyId, name.trim(), type, color || "#64748b", icon || "📦"]
  );
  res.status(201).json(cat);
}));

app.delete("/api/categories/:id", requireRole("admin", "accountant"), wrap(async (req, res) => {
  const cat = await one("SELECT * FROM categories WHERE id=$1 AND company_id=$2", [req.params.id, req.user.companyId]);
  if (!cat) return res.status(404).json({ error: "Kategori bulunamadı." });
  if (cat.is_default) return res.status(400).json({ error: "Varsayılan kategoriler silinemez." });
  await pool.query("DELETE FROM categories WHERE id=$1", [cat.id]);
  res.status(204).end();
}));

// ======================= DEPARTMENTS =======================
app.get("/api/departments", wrap(async (req, res) => {
  res.json(await q("SELECT * FROM departments WHERE company_id=$1 ORDER BY name", [req.user.companyId]));
}));

app.post("/api/departments", requireRole("admin", "accountant"), wrap(async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Departman adı gerekli." });
  try {
    const dep = await one("INSERT INTO departments (company_id, name) VALUES ($1,$2) RETURNING *", [req.user.companyId, name.trim()]);
    res.status(201).json(dep);
  } catch {
    res.status(409).json({ error: "Bu departman zaten mevcut." });
  }
}));

app.delete("/api/departments/:id", requireRole("admin", "accountant"), wrap(async (req, res) => {
  const dep = await one("SELECT id FROM departments WHERE id=$1 AND company_id=$2", [req.params.id, req.user.companyId]);
  if (!dep) return res.status(404).json({ error: "Departman bulunamadı." });
  await pool.query("DELETE FROM departments WHERE id=$1", [dep.id]);
  res.status(204).end();
}));

// ======================= TRANSACTIONS =======================
const TXN_SELECT = `
  SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
         d.name AS department_name, u.name AS created_by_name
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN departments d ON d.id = t.department_id
  LEFT JOIN users u ON u.id = t.created_by
`;

app.get("/api/transactions", wrap(async (req, res) => {
  res.json(await q(`${TXN_SELECT} WHERE t.company_id=$1 ORDER BY t.date DESC, t.id DESC`, [req.user.companyId]));
}));

app.post("/api/transactions", wrap(async (req, res) => {
  const { type, amount, category_id, department_id, vendor, description, date } = req.body;
  const numericAmount = Number(amount);
  if (!["income", "expense"].includes(type) || !numericAmount || numericAmount <= 0 || !date) {
    return res.status(400).json({ error: "Geçersiz işlem verisi." });
  }
  const inserted = await one(
    `INSERT INTO transactions (company_id, type, amount, category_id, department_id, vendor, description, date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [req.user.companyId, type, numericAmount, category_id || null, department_id || null,
     vendor?.trim() || "", description?.trim() || "", date, req.user.userId]
  );
  res.status(201).json(await one(`${TXN_SELECT} WHERE t.id=$1`, [inserted.id]));
}));

app.delete("/api/transactions/:id", requireRole("admin", "accountant"), wrap(async (req, res) => {
  const txn = await one("SELECT id FROM transactions WHERE id=$1 AND company_id=$2", [req.params.id, req.user.companyId]);
  if (!txn) return res.status(404).json({ error: "İşlem bulunamadı." });
  await pool.query("DELETE FROM transactions WHERE id=$1", [txn.id]);
  res.status(204).end();
}));

// ======================= STATS =======================
app.get("/api/stats", wrap(async (req, res) => {
  const cid = req.user.companyId;
  const totals = await one(
    `SELECT
       COALESCE(SUM(CASE WHEN type='income'  THEN amount END), 0)::float8 AS income,
       COALESCE(SUM(CASE WHEN type='expense' THEN amount END), 0)::float8 AS expense,
       COUNT(*)::int AS count
     FROM transactions WHERE company_id=$1`, [cid]);

  const byCategory = await q(
    `SELECT c.name, c.color, SUM(t.amount)::float8 AS value
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.type='expense' AND t.company_id=$1
     GROUP BY c.id, c.name, c.color ORDER BY value DESC`, [cid]);

  const byDepartment = await q(
    `SELECT d.name, SUM(t.amount)::float8 AS value
     FROM transactions t JOIN departments d ON d.id = t.department_id
     WHERE t.type='expense' AND t.company_id=$1
     GROUP BY d.id, d.name ORDER BY value DESC`, [cid]);

  const byMonth = await q(
    `SELECT substr(date,1,7) AS month,
            COALESCE(SUM(CASE WHEN type='income'  THEN amount END),0)::float8 AS gelir,
            COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0)::float8 AS gider
     FROM transactions WHERE company_id=$1
     GROUP BY month ORDER BY month`, [cid]);

  res.json({ totals, byCategory, byDepartment, byMonth });
}));

// ======================= EXPORT =======================
async function getCompanyTransactions(companyId) {
  return q(`${TXN_SELECT} WHERE t.company_id=$1 ORDER BY t.date DESC, t.id DESC`, [companyId]);
}
async function companyName(companyId) {
  return (await one("SELECT name FROM companies WHERE id=$1", [companyId]))?.name || "Şirket";
}
const tl = (n) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2 }).format(n || 0) + " ₺";

app.get("/api/export/excel", wrap(async (req, res) => {
  const rows = await getCompanyTransactions(req.user.companyId);
  const wb = new ExcelJS.Workbook();
  wb.creator = "FinTrack";
  const ws = wb.addWorksheet("İşlemler");
  ws.columns = [
    { header: "Tarih", key: "date", width: 14 },
    { header: "Tür", key: "type", width: 10 },
    { header: "Kategori", key: "category_name", width: 28 },
    { header: "Departman", key: "department_name", width: 22 },
    { header: "Tedarikçi", key: "vendor", width: 22 },
    { header: "Açıklama", key: "description", width: 30 },
    { header: "Tutar (₺)", key: "amount", width: 16 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6366F1" } };
  for (const r of rows) {
    ws.addRow({
      date: r.date,
      type: r.type === "income" ? "Gelir" : "Gider",
      category_name: r.category_name || "-",
      department_name: r.department_name || "-",
      vendor: r.vendor || "-",
      description: r.description || "-",
      amount: Number(r.amount),
    });
  }
  ws.getColumn("amount").numFmt = "#,##0.00";
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="fintrack-islemler.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));

app.get("/api/export/pdf", wrap(async (req, res) => {
  const cid = req.user.companyId;
  const rows = await getCompanyTransactions(cid);
  const cName = await companyName(cid);
  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const arial = "C:/Windows/Fonts/arial.ttf";
  const arialBold = "C:/Windows/Fonts/arialbd.ttf";
  const FONT = existsSync(arial) ? "TR" : "Helvetica";
  const FONT_B = existsSync(arialBold) ? "TRB" : "Helvetica-Bold";
  if (existsSync(arial)) doc.registerFont("TR", arial);
  if (existsSync(arialBold)) doc.registerFont("TRB", arialBold);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="fintrack-rapor.pdf"`);
  doc.pipe(res);

  doc.font(FONT_B).fontSize(20).fillColor("#6366f1").text("FinTrack", { continued: true })
    .fillColor("#0f172a").text("  Harcama Raporu");
  doc.moveDown(0.2);
  doc.font(FONT).fontSize(11).fillColor("#475569").text(`${cName}  •  ${new Date().toLocaleDateString("tr-TR")}`);
  doc.moveDown(1);
  doc.font(FONT_B).fontSize(12).fillColor("#0f172a").text("Özet");
  doc.font(FONT).fontSize(11).fillColor("#334155");
  doc.text(`Toplam Gelir:   ${tl(income)}`);
  doc.text(`Toplam Gider:   ${tl(expense)}`);
  doc.font(FONT_B).text(`Net Bakiye:     ${tl(income - expense)}`);
  doc.moveDown(1);

  const cols = [
    { label: "Tarih", x: 40, w: 60 }, { label: "Tür", x: 100, w: 45 },
    { label: "Kategori", x: 145, w: 120 }, { label: "Departman", x: 265, w: 110 },
    { label: "Tutar", x: 460, w: 95 },
  ];
  const drawHeader = (y) => { doc.font(FONT_B).fontSize(9).fillColor("#475569"); for (const c of cols) doc.text(c.label, c.x, y, { width: c.w }); };
  let y = doc.y;
  drawHeader(y); y += 16;
  doc.moveTo(40, y - 4).lineTo(555, y - 4).strokeColor("#cbd5e1").stroke();
  doc.font(FONT).fontSize(9);
  for (const r of rows) {
    if (y > 780) { doc.addPage(); y = 40; drawHeader(y); y += 16; }
    doc.fillColor("#0f172a").text(r.date, cols[0].x, y, { width: cols[0].w });
    doc.fillColor(r.type === "income" ? "#16a34a" : "#dc2626").text(r.type === "income" ? "Gelir" : "Gider", cols[1].x, y, { width: cols[1].w });
    doc.fillColor("#334155").text(r.category_name || "-", cols[2].x, y, { width: cols[2].w });
    doc.text(r.department_name || "-", cols[3].x, y, { width: cols[3].w });
    doc.fillColor(r.type === "income" ? "#16a34a" : "#dc2626").text((r.type === "income" ? "+" : "-") + tl(Number(r.amount)), cols[4].x, y, { width: cols[4].w });
    y += 16;
  }
  doc.end();
}));

export default app;
