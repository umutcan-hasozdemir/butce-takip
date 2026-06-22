import { useState } from "react";

const ICON_CHOICES = [
  "📦", "💼", "🛒", "🧾", "🏢", "💻", "📣", "🖥️", "✈️", "🚗",
  "🍔", "📱", "⚡", "🔧", "📚", "🎯", "💡", "🏦", "📈", "🤝",
];
const COLOR_CHOICES = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#64748b",
];

// Kullanıcının kendi kategorilerini eklemesini/silmesini sağlar
export default function CategoryManager({ categories, onAdd, onDelete }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Kategori adı gerekli.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onAdd({ name: name.trim(), type, icon, color });
      setName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const expense = categories.filter((c) => c.type === "expense");
  const income = categories.filter((c) => c.type === "income");

  return (
    <div className="manager">
      <form className="category-form card" onSubmit={handleSubmit}>
        <h2>Yeni Kategori Ekle</h2>

        <div className="type-toggle">
          <button
            type="button"
            className={type === "expense" ? "active expense" : ""}
            onClick={() => setType("expense")}
          >
            Gider
          </button>
          <button
            type="button"
            className={type === "income" ? "active income" : ""}
            onClick={() => setType("income")}
          >
            Gelir
          </button>
        </div>

        <label>
          Kategori Adı
          <input
            type="text"
            placeholder="Örn. Danışmanlık Gideri"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
        </label>

        <div className="picker-group">
          <span className="picker-label">İkon</span>
          <div className="icon-grid">
            {ICON_CHOICES.map((ic) => (
              <button
                type="button"
                key={ic}
                className={`icon-choice ${icon === ic ? "selected" : ""}`}
                onClick={() => setIcon(ic)}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div className="picker-group">
          <span className="picker-label">Renk</span>
          <div className="color-grid">
            {COLOR_CHOICES.map((co) => (
              <button
                type="button"
                key={co}
                className={`color-choice ${color === co ? "selected" : ""}`}
                style={{ backgroundColor: co }}
                onClick={() => setColor(co)}
                aria-label={co}
              />
            ))}
          </div>
        </div>

        <div className="category-preview">
          <span className="item-icon" style={{ backgroundColor: color + "22" }}>
            {icon}
          </span>
          <span>{name || "Önizleme"}</span>
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="submit-btn" disabled={saving}>
          {saving ? "Ekleniyor…" : "+ Kategori Ekle"}
        </button>
      </form>

      <div className="category-lists">
        <CategoryColumn title="Gider Kategorileri" items={expense} onDelete={onDelete} />
        <CategoryColumn title="Gelir Kategorileri" items={income} onDelete={onDelete} />
      </div>
    </div>
  );
}

function CategoryColumn({ title, items, onDelete }) {
  return (
    <div className="category-column card">
      <h3>{title}</h3>
      <ul>
        {items.map((c) => (
          <li key={c.id} className="category-row">
            <span className="item-icon" style={{ backgroundColor: c.color + "22" }}>
              {c.icon}
            </span>
            <span className="category-name">{c.name}</span>
            {c.is_default ? (
              <span className="default-tag">Varsayılan</span>
            ) : (
              <button
                className="delete-btn"
                onClick={() => onDelete(c.id)}
                title="Sil"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
