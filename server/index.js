import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { existsSync } from "fs";
import db, { seedDefaultsForCompany } from "./db.js";
import { signToken, authRequired, requireRole } from "./auth.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ======================= AUTH =======================
// Kayıt: yeni bir şirket + admin kullanıcı oluşturur
app.post("/api/auth/register", (req, res) => {
  const { companyName, name, email, password } = req.body;
  if (!companyName?.trim() || !name?.trim() || !EMAIL_RE.test(email || "") || (password || "").length < 6) {
    return res.status(400).json({ error: "Tüm alanları doldurun (şifre en az 6 karakter)." });
  }
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: "Bu e-posta zaten kayıtlı." });

  const result = db.transaction(() => {
    const companyId = db
      .prepare("INSERT INTO companies (name) VALUES (?)")
      .run(companyName.trim()).lastInsertRowid;
    const userId = db
      .prepare(
        "INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')"
      )
      .run(companyId, name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10)).lastInsertRowid;
    seedDefaultsForCompany(companyId);
    return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  })();

  const company = db.prepare("SELECT name FROM companies WHERE id = ?").get(result.company_id);
  res.status(201).json({ token: signToken(result), user: publicUser(result, company.name) });
});

// Giriş
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get((email || "").toLowerCase());
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "E-posta veya şifre hatalı." });
  }
  const company = db.prepare("SELECT name FROM companies WHERE id = ?").get(user.company_id);
  res.json({ token: signToken(user), user: publicUser(user, company.name) });
});

// Mevcut oturum bilgisi
app.get("/api/auth/me", authRequired, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.userId);
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
  const company = db.prepare("SELECT name FROM companies WHERE id = ?").get(user.company_id);
  res.json({ user: publicUser(user, company.name) });
});

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

// Bundan sonraki tüm rotalar oturum gerektirir
app.use("/api", authRequired);

// ======================= USERS (admin) =======================
app.get("/api/users", requireRole("admin"), (req, res) => {
  res.json(
    db
      .prepare("SELECT id, name, email, role, created_at FROM users WHERE company_id = ? ORDER BY id")
      .all(req.user.companyId)
  );
});

app.post("/api/users", requireRole("admin"), (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name?.trim() || !EMAIL_RE.test(email || "") || (password || "").length < 6 || !["admin", "accountant", "employee"].includes(role)) {
    return res.status(400).json({ error: "Geçersiz kullanıcı verisi (şifre en az 6 karakter)." });
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase())) {
    return res.status(409).json({ error: "Bu e-posta zaten kayıtlı." });
  }
  const id = db
    .prepare("INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)")
    .run(req.user.companyId, name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10), role).lastInsertRowid;
  res.status(201).json(db.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(id));
});

app.delete("/api/users/:id", requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.userId) {
    return res.status(400).json({ error: "Kendi hesabınızı silemezsiniz." });
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND company_id = ?").get(id, req.user.companyId);
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.status(204).end();
});

// ======================= CATEGORIES =======================
app.get("/api/categories", (req, res) => {
  res.json(
    db.prepare("SELECT * FROM categories WHERE company_id = ? ORDER BY type, name").all(req.user.companyId)
  );
});

app.post("/api/categories", requireRole("admin", "accountant"), (req, res) => {
  const { name, type, color, icon } = req.body;
  if (!name?.trim() || !["income", "expense"].includes(type)) {
    return res.status(400).json({ error: "Geçersiz kategori verisi." });
  }
  const id = db
    .prepare("INSERT INTO categories (company_id, name, type, color, icon, is_default) VALUES (?, ?, ?, ?, ?, 0)")
    .run(req.user.companyId, name.trim(), type, color || "#64748b", icon || "📦").lastInsertRowid;
  res.status(201).json(db.prepare("SELECT * FROM categories WHERE id = ?").get(id));
});

app.delete("/api/categories/:id", requireRole("admin", "accountant"), (req, res) => {
  const cat = db.prepare("SELECT * FROM categories WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!cat) return res.status(404).json({ error: "Kategori bulunamadı." });
  if (cat.is_default) return res.status(400).json({ error: "Varsayılan kategoriler silinemez." });
  db.prepare("DELETE FROM categories WHERE id = ?").run(cat.id);
  res.status(204).end();
});

// ======================= DEPARTMENTS =======================
app.get("/api/departments", (req, res) => {
  res.json(db.prepare("SELECT * FROM departments WHERE company_id = ? ORDER BY name").all(req.user.companyId));
});

app.post("/api/departments", requireRole("admin", "accountant"), (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Departman adı gerekli." });
  try {
    const id = db
      .prepare("INSERT INTO departments (company_id, name) VALUES (?, ?)")
      .run(req.user.companyId, name.trim()).lastInsertRowid;
    res.status(201).json(db.prepare("SELECT * FROM departments WHERE id = ?").get(id));
  } catch {
    res.status(409).json({ error: "Bu departman zaten mevcut." });
  }
});

app.delete("/api/departments/:id", requireRole("admin", "accountant"), (req, res) => {
  const dep = db.prepare("SELECT id FROM departments WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!dep) return res.status(404).json({ error: "Departman bulunamadı." });
  db.prepare("DELETE FROM departments WHERE id = ?").run(dep.id);
  res.status(204).end();
});

// ======================= TRANSACTIONS =======================
const TXN_SELECT = `
  SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
         d.name AS department_name, u.name AS created_by_name
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN departments d ON d.id = t.department_id
  LEFT JOIN users u ON u.id = t.created_by
`;

app.get("/api/transactions", (req, res) => {
  res.json(
    db.prepare(`${TXN_SELECT} WHERE t.company_id = ? ORDER BY t.date DESC, t.id DESC`).all(req.user.companyId)
  );
});

app.post("/api/transactions", (req, res) => {
  const { type, amount, category_id, department_id, vendor, description, date } = req.body;
  const numericAmount = Number(amount);
  if (!["income", "expense"].includes(type) || !numericAmount || numericAmount <= 0 || !date) {
    return res.status(400).json({ error: "Geçersiz işlem verisi." });
  }
  const id = db
    .prepare(
      `INSERT INTO transactions (company_id, type, amount, category_id, department_id, vendor, description, date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.companyId, type, numericAmount,
      category_id || null, department_id || null,
      vendor?.trim() || "", description?.trim() || "", date, req.user.userId
    ).lastInsertRowid;
  res.status(201).json(db.prepare(`${TXN_SELECT} WHERE t.id = ?`).get(id));
});

app.delete("/api/transactions/:id", requireRole("admin", "accountant"), (req, res) => {
  const txn = db.prepare("SELECT id FROM transactions WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!txn) return res.status(404).json({ error: "İşlem bulunamadı." });
  db.prepare("DELETE FROM transactions WHERE id = ?").run(txn.id);
  res.status(204).end();
});

// ======================= STATS =======================
app.get("/api/stats", (req, res) => {
  const cid = req.user.companyId;
  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type='income'  THEN amount END), 0) AS income,
         COALESCE(SUM(CASE WHEN type='expense' THEN amount END), 0) AS expense,
         COUNT(*) AS count
       FROM transactions WHERE company_id = ?`
    )
    .get(cid);

  const byCategory = db
    .prepare(
      `SELECT c.name, c.color, SUM(t.amount) AS value
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.type = 'expense' AND t.company_id = ?
       GROUP BY c.id ORDER BY value DESC`
    )
    .all(cid);

  const byDepartment = db
    .prepare(
      `SELECT d.name, SUM(t.amount) AS value
       FROM transactions t JOIN departments d ON d.id = t.department_id
       WHERE t.type = 'expense' AND t.company_id = ?
       GROUP BY d.id ORDER BY value DESC`
    )
    .all(cid);

  const byMonth = db
    .prepare(
      `SELECT substr(date, 1, 7) AS month,
              COALESCE(SUM(CASE WHEN type='income'  THEN amount END), 0) AS gelir,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount END), 0) AS gider
       FROM transactions WHERE company_id = ?
       GROUP BY month ORDER BY month`
    )
    .all(cid);

  res.json({ totals, byCategory, byDepartment, byMonth });
});

// ======================= EXPORT =======================
function getCompanyTransactions(companyId) {
  return db
    .prepare(`${TXN_SELECT} WHERE t.company_id = ? ORDER BY t.date DESC, t.id DESC`)
    .all(companyId);
}
function companyName(companyId) {
  return db.prepare("SELECT name FROM companies WHERE id = ?").get(companyId)?.name || "Şirket";
}
const tl = (n) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2 }).format(n || 0) + " ₺";

// Excel (.xlsx)
app.get("/api/export/excel", async (req, res) => {
  const rows = getCompanyTransactions(req.user.companyId);
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
      amount: r.amount,
    });
  }
  ws.getColumn("amount").numFmt = "#,##0.00";

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="fintrack-islemler.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// PDF
app.get("/api/export/pdf", (req, res) => {
  const cid = req.user.companyId;
  const rows = getCompanyTransactions(cid);
  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  // Türkçe karakter desteği için sistem fontunu kullan (varsa)
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
  doc.font(FONT).fontSize(11).fillColor("#475569")
    .text(`${companyName(cid)}  •  ${new Date().toLocaleDateString("tr-TR")}`);
  doc.moveDown(1);

  // Özet
  doc.font(FONT_B).fontSize(12).fillColor("#0f172a").text("Özet");
  doc.font(FONT).fontSize(11).fillColor("#334155");
  doc.text(`Toplam Gelir:   ${tl(income)}`);
  doc.text(`Toplam Gider:   ${tl(expense)}`);
  doc.font(FONT_B).text(`Net Bakiye:     ${tl(income - expense)}`);
  doc.moveDown(1);

  // Tablo başlığı
  const cols = [
    { label: "Tarih", x: 40, w: 60 },
    { label: "Tür", x: 100, w: 45 },
    { label: "Kategori", x: 145, w: 120 },
    { label: "Departman", x: 265, w: 110 },
    { label: "Tutar", x: 460, w: 95 },
  ];
  const drawHeader = (y) => {
    doc.font(FONT_B).fontSize(9).fillColor("#475569");
    for (const c of cols) doc.text(c.label, c.x, y, { width: c.w });
  };
  let y = doc.y;
  drawHeader(y);
  y += 16;
  doc.moveTo(40, y - 4).lineTo(555, y - 4).strokeColor("#cbd5e1").stroke();

  doc.font(FONT).fontSize(9);
  for (const r of rows) {
    if (y > 780) {
      doc.addPage();
      y = 40;
      drawHeader(y);
      y += 16;
    }
    doc.fillColor("#0f172a").text(r.date, cols[0].x, y, { width: cols[0].w });
    doc.fillColor(r.type === "income" ? "#16a34a" : "#dc2626")
      .text(r.type === "income" ? "Gelir" : "Gider", cols[1].x, y, { width: cols[1].w });
    doc.fillColor("#334155").text(r.category_name || "-", cols[2].x, y, { width: cols[2].w });
    doc.text(r.department_name || "-", cols[3].x, y, { width: cols[3].w });
    doc.fillColor(r.type === "income" ? "#16a34a" : "#dc2626")
      .text((r.type === "income" ? "+" : "-") + tl(r.amount), cols[4].x, y, { width: cols[4].w });
    y += 16;
  }

  doc.end();
});

app.listen(PORT, () => {
  console.log(`✅ FinTrack API çalışıyor → http://localhost:${PORT}`);
});
