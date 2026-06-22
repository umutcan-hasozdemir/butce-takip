import { useMemo, useState } from "react";
import { formatCurrency, formatDate } from "../utils/format";

// İşlem geçmişi — tür filtreleme, metin arama ve silme
export default function TransactionList({ transactions, onDelete, canDelete = true }) {
  const [filter, setFilter] = useState("all"); // all | income | expense
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (!q) return true;
      return (
        (t.description || "").toLowerCase().includes(q) ||
        (t.vendor || "").toLowerCase().includes(q) ||
        (t.category_name || "").toLowerCase().includes(q) ||
        (t.department_name || "").toLowerCase().includes(q)
      );
    });
  }, [transactions, filter, query]);

  return (
    <section className="transaction-list card">
      <div className="list-header">
        <h2>İşlemler</h2>
        <div className="filter-tabs">
          {[
            { id: "all", label: "Tümü" },
            { id: "income", label: "Gelir" },
            { id: "expense", label: "Gider" },
          ].map((f) => (
            <button
              key={f.id}
              className={filter === f.id ? "active" : ""}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <input
        className="search-input"
        type="search"
        placeholder="🔍 Tedarikçi, kategori veya departmanda ara…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="empty-state">Eşleşen işlem bulunamadı.</p>
      ) : (
        <ul>
          {filtered.map((t) => (
            <li key={t.id} className="transaction-item">
              <span
                className="item-icon"
                style={{ backgroundColor: (t.category_color || "#64748b") + "22" }}
              >
                {t.category_icon || "📦"}
              </span>
              <div className="item-info">
                <p className="item-title">
                  {t.vendor || t.description || t.category_name || "İşlem"}
                </p>
                <p className="item-meta">
                  {t.category_name || "Kategorisiz"}
                  {t.department_name ? ` · ${t.department_name}` : ""} ·{" "}
                  {formatDate(t.date)}
                </p>
              </div>
              <span
                className={`item-amount ${
                  t.type === "income" ? "positive" : "negative"
                }`}
              >
                {t.type === "income" ? "+" : "-"}
                {formatCurrency(t.amount)}
              </span>
              {canDelete && (
                <button
                  className="delete-btn"
                  onClick={() => onDelete(t.id)}
                  aria-label="Sil"
                  title="Sil"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
