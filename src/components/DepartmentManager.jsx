import { useState } from "react";

// Departman / maliyet merkezi ekleme ve silme
export default function DepartmentManager({ departments, onAdd, onDelete }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Departman adı gerekli.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onAdd(name.trim());
      setName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="department-manager card">
      <h2>Departmanlar / Maliyet Merkezleri</h2>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Yeni departman adı"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />
        <button type="submit" className="submit-btn compact" disabled={saving}>
          {saving ? "…" : "Ekle"}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}

      <ul className="department-list">
        {departments.map((d) => (
          <li key={d.id} className="department-row">
            <span>🏬 {d.name}</span>
            <button className="delete-btn" onClick={() => onDelete(d.id)} title="Sil">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
