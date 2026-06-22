import { useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);

// Yeni gelir/gider ekleme formu — kategoriler ve departmanlar API'den gelir
export default function TransactionForm({ categories, departments, onAdd }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredCategories = categories.filter((c) => c.type === type);

  async function handleSubmit(e) {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError("Lütfen geçerli bir tutar girin.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onAdd({
        type,
        amount: numericAmount,
        category_id: categoryId ? Number(categoryId) : null,
        department_id: departmentId ? Number(departmentId) : null,
        vendor: vendor.trim(),
        description: description.trim(),
        date,
      });
      // Formu sıfırla (tür, departman ve tarihi koru)
      setAmount("");
      setVendor("");
      setDescription("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="transaction-form card" onSubmit={handleSubmit}>
      <h2>Yeni İşlem</h2>

      <div className="type-toggle">
        <button
          type="button"
          className={type === "expense" ? "active expense" : ""}
          onClick={() => {
            setType("expense");
            setCategoryId("");
          }}
        >
          Gider
        </button>
        <button
          type="button"
          className={type === "income" ? "active income" : ""}
          onClick={() => {
            setType("income");
            setCategoryId("");
          }}
        >
          Gelir
        </button>
      </div>

      <label>
        Tutar (₺)
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0,00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      <label>
        Kategori
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">— Seçiniz —</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Departman / Maliyet Merkezi
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">— Seçiniz —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Tedarikçi / Cari
        <input
          type="text"
          placeholder="Örn. Microsoft, A101..."
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          maxLength={60}
        />
      </label>

      <label>
        Açıklama
        <input
          type="text"
          placeholder="Örn. Yıllık lisans yenileme"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={80}
        />
      </label>

      <label>
        Tarih
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="submit-btn" disabled={saving}>
        {saving ? "Kaydediliyor…" : "+ İşlem Ekle"}
      </button>
    </form>
  );
}
