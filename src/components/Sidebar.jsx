const ALL_NAV = [
  { id: "dashboard", label: "Genel Bakış", icon: "📊", roles: ["admin", "accountant", "employee"] },
  { id: "transactions", label: "İşlemler", icon: "💳", roles: ["admin", "accountant", "employee"] },
  { id: "settings", label: "Kategoriler & Departmanlar", icon: "⚙️", roles: ["admin", "accountant"] },
  { id: "users", label: "Kullanıcılar", icon: "👥", roles: ["admin"] },
];

const ROLE_LABELS = {
  admin: "Yönetici",
  accountant: "Muhasebe",
  employee: "Çalışan",
};

// Sol kenar navigasyon — kullanıcı rolüne göre menü ve oturum bilgisi
export default function Sidebar({ active, onChange, user, onLogout }) {
  const navItems = ALL_NAV.filter((item) => item.roles.includes(user.role));
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-logo">₣</span>
        <div>
          <h1>FinTrack</h1>
          <p>{user.companyName}</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={active === item.id ? "nav-item active" : "nav-item"}
            onClick={() => onChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <span className="user-avatar">{initials}</span>
          <div className="user-card-info">
            <p className="user-card-name">{user.name}</p>
            <p className="user-card-role">{ROLE_LABELS[user.role]}</p>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Çıkış yap">
            ⎋
          </button>
        </div>
      </div>
    </aside>
  );
}
