import { useCallback, useEffect, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import Summary from "./components/Summary";
import Charts from "./components/Charts";
import TransactionForm from "./components/TransactionForm";
import TransactionList from "./components/TransactionList";
import CategoryManager from "./components/CategoryManager";
import DepartmentManager from "./components/DepartmentManager";
import UserManager from "./components/UserManager";
import { api, tokenStore } from "./api/client";
import "./App.css";

const VIEW_TITLES = {
  dashboard: { title: "Genel Bakış", subtitle: "Şirket gelir-gider özeti ve analizler" },
  transactions: { title: "İşlemler", subtitle: "Gelir ve giderleri kaydedin, yönetin" },
  settings: { title: "Kategoriler & Departmanlar", subtitle: "Kendi kategorilerinizi ve maliyet merkezlerinizi tanımlayın" },
  users: { title: "Kullanıcılar", subtitle: "Şirket çalışanlarını ve yetkilerini yönetin" },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [view, setView] = useState("dashboard");
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ totals: { income: 0, expense: 0, count: 0 }, byCategory: [], byDepartment: [], byMonth: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const canManage = user && (user.role === "admin" || user.role === "accountant");
  const isAdmin = user && user.role === "admin";

  // ---- Oturum doğrulama (ilk yükleme) ----
  useEffect(() => {
    if (!tokenStore.get()) {
      setAuthChecked(true);
      return;
    }
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => tokenStore.clear())
      .finally(() => setAuthChecked(true));
  }, []);

  // 401 olayında oturumu kapat
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener("fintrack:unauthorized", handler);
    return () => window.removeEventListener("fintrack:unauthorized", handler);
  }, []);

  // ---- Verileri çek ----
  const refresh = useCallback(async () => {
    const tasks = [api.getCategories(), api.getDepartments(), api.getTransactions(), api.getStats()];
    const [cats, deps, txns, st] = await Promise.all(tasks);
    setCategories(cats);
    setDepartments(deps);
    setTransactions(txns);
    setStats(st);
    if (isAdmin) setUsers(await api.getUsers());
  }, [isAdmin]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    refresh()
      .catch((e) => setError(e.message || "Veriler yüklenemedi."))
      .finally(() => setLoading(false));
  }, [user, refresh]);

  function handleAuth(result) {
    tokenStore.set(result.token);
    setUser(result.user);
    setView("dashboard");
  }

  function handleLogout() {
    tokenStore.clear();
    setUser(null);
  }

  // ---- Mutasyonlar ----
  const wrap = (fn) => async (...args) => {
    await fn(...args);
    await refresh();
  };
  const handleAddTransaction = wrap(api.createTransaction);
  const handleDeleteTransaction = wrap(api.deleteTransaction);
  const handleAddCategory = wrap(api.createCategory);
  const handleDeleteCategory = wrap(api.deleteCategory);
  const handleAddDepartment = wrap(api.createDepartment);
  const handleDeleteDepartment = wrap(api.deleteDepartment);
  const handleAddUser = wrap(api.createUser);
  const handleDeleteUser = wrap(api.deleteUser);

  async function handleExport(type) {
    setExporting(true);
    try {
      if (type === "excel") await api.exportExcel();
      else await api.exportPdf();
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  // ---- Render ----
  if (!authChecked) return <div className="app-boot">Yükleniyor…</div>;
  if (!user) return <AuthScreen onAuth={handleAuth} />;

  const header = VIEW_TITLES[view];

  return (
    <div className="layout">
      <Sidebar active={view} onChange={setView} user={user} onLogout={handleLogout} />

      <main className="content">
        <header className="content-header">
          <div>
            <h1>{header.title}</h1>
            <p>{header.subtitle}</p>
          </div>
          {view === "dashboard" && (
            <div className="export-actions">
              <button className="export-btn" onClick={() => handleExport("excel")} disabled={exporting}>
                📊 Excel
              </button>
              <button className="export-btn" onClick={() => handleExport("pdf")} disabled={exporting}>
                📄 PDF
              </button>
            </div>
          )}
        </header>

        {error && <div className="banner-error">{error}</div>}

        {loading ? (
          <div className="loading">Yükleniyor…</div>
        ) : (
          <>
            {view === "dashboard" && (
              <>
                <Summary
                  income={stats.totals.income}
                  expense={stats.totals.expense}
                  count={stats.totals.count}
                />
                <Charts stats={stats} />
              </>
            )}

            {view === "transactions" && (
              <div className="main-grid">
                <TransactionForm
                  categories={categories}
                  departments={departments}
                  onAdd={handleAddTransaction}
                />
                <TransactionList
                  transactions={transactions}
                  onDelete={handleDeleteTransaction}
                  canDelete={canManage}
                />
              </div>
            )}

            {view === "settings" && canManage && (
              <div className="settings-grid">
                <CategoryManager
                  categories={categories}
                  onAdd={handleAddCategory}
                  onDelete={handleDeleteCategory}
                />
                <DepartmentManager
                  departments={departments}
                  onAdd={handleAddDepartment}
                  onDelete={handleDeleteDepartment}
                />
              </div>
            )}

            {view === "users" && isAdmin && (
              <UserManager
                users={users}
                currentUserId={user.id}
                onAdd={handleAddUser}
                onDelete={handleDeleteUser}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
