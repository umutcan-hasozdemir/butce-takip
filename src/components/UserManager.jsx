import { useState } from "react";

const ROLE_LABELS = {
  admin: { label: "Yönetici", icon: "👑", className: "role-admin" },
  accountant: { label: "Muhasebe", icon: "📒", className: "role-accountant" },
  employee: { label: "Çalışan", icon: "👤", className: "role-employee" },
};

// Şirket kullanıcılarını yönetir (yalnızca admin görür)
export default function UserManager({ users, currentUserId, onAdd, onDelete }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "employee" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onAdd(form);
      setForm({ name: "", email: "", password: "", role: "employee" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-grid">
      <div className="card user-list">
        <h2>Kullanıcılar</h2>
        <ul>
          {users.map((u) => {
            const r = ROLE_LABELS[u.role];
            return (
              <li key={u.id} className="user-row">
                <div className="user-info">
                  <p className="user-name">{u.name}</p>
                  <p className="user-email">{u.email}</p>
                </div>
                <span className={`role-tag ${r.className}`}>
                  {r.icon} {r.label}
                </span>
                {u.id === currentUserId ? (
                  <span className="default-tag">Siz</span>
                ) : (
                  <button className="delete-btn" onClick={() => onDelete(u.id)} title="Sil">
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <form className="card user-form" onSubmit={handleSubmit}>
        <h2>Yeni Kullanıcı</h2>
        <label>
          Ad Soyad
          <input value={form.name} onChange={update("name")} placeholder="Adı Soyadı" />
        </label>
        <label>
          E-posta
          <input type="email" value={form.email} onChange={update("email")} placeholder="ornek@sirket.com" />
        </label>
        <label>
          Şifre
          <input type="password" value={form.password} onChange={update("password")} placeholder="En az 6 karakter" />
        </label>
        <label>
          Rol
          <select value={form.role} onChange={update("role")}>
            <option value="employee">👤 Çalışan — sadece işlem ekler/görür</option>
            <option value="accountant">📒 Muhasebe — işlem & kategori yönetir</option>
            <option value="admin">👑 Yönetici — tam yetki</option>
          </select>
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="submit-btn" disabled={saving}>
          {saving ? "Ekleniyor…" : "+ Kullanıcı Ekle"}
        </button>
      </form>
    </div>
  );
}
