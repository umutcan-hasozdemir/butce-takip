import { useState } from "react";
import { api } from "../api/client";

// Giriş ve kayıt ekranı (oturum yokken gösterilir)
export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | register
  const [form, setForm] = useState({
    companyName: "",
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result =
        mode === "login"
          ? await api.login({ email: form.email, password: form.password })
          : await api.register(form);
      onAuth(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(role) {
    setMode("login");
    setForm((f) => ({ ...f, email: `${role}@demo.com`, password: "demo1234" }));
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-logo">₣</span>
          <div>
            <h1>FinTrack</h1>
            <p>Kurumsal Harcama Yönetimi</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Giriş Yap
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Şirket Kaydı
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <>
              <label>
                Şirket Adı
                <input value={form.companyName} onChange={update("companyName")} placeholder="Örn. Acme A.Ş." />
              </label>
              <label>
                Ad Soyad
                <input value={form.name} onChange={update("name")} placeholder="Adınız" />
              </label>
            </>
          )}

          <label>
            E-posta
            <input type="email" value={form.email} onChange={update("email")} placeholder="ornek@sirket.com" />
          </label>
          <label>
            Şifre
            <input type="password" value={form.password} onChange={update("password")} placeholder="••••••••" />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Lütfen bekleyin…" : mode === "login" ? "Giriş Yap" : "Şirketi Oluştur"}
          </button>
        </form>

        {mode === "login" && (
          <div className="demo-box">
            <p>Demo hesaplarla hızlı giriş:</p>
            <div className="demo-buttons">
              <button onClick={() => fillDemo("admin")}>👑 Yönetici</button>
              <button onClick={() => fillDemo("muhasebe")}>📒 Muhasebe</button>
              <button onClick={() => fillDemo("calisan")}>👤 Çalışan</button>
            </div>
            <span className="demo-hint">Şifre: demo1234</span>
          </div>
        )}
      </div>
    </div>
  );
}
