// Backend REST API ile iletişim katmanı (JWT kimlik doğrulamalı)
const BASE = "/api";
const TOKEN_KEY = "fintrack.token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(path, options = {}) {
  const token = tokenStore.get();
  const res = await fetch(BASE + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (res.status === 401) {
    tokenStore.clear();
    window.dispatchEvent(new Event("fintrack:unauthorized"));
    throw new Error("Oturum süresi doldu.");
  }
  if (!res.ok) {
    let message = "İstek başarısız oldu.";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      /* yanıt gövdesi yok */
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Dosya indirme (Excel/PDF) — token ile
async function download(path, filename) {
  const token = tokenStore.get();
  const res = await fetch(BASE + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Dışa aktarma başarısız oldu.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  // Kimlik doğrulama
  register: (data) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => request("/auth/me"),

  // Kullanıcılar (admin)
  getUsers: () => request("/users"),
  createUser: (data) => request("/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/users/${id}`, { method: "DELETE" }),

  // Kategoriler
  getCategories: () => request("/categories"),
  createCategory: (data) => request("/categories", { method: "POST", body: JSON.stringify(data) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE" }),

  // Departmanlar
  getDepartments: () => request("/departments"),
  createDepartment: (name) => request("/departments", { method: "POST", body: JSON.stringify({ name }) }),
  deleteDepartment: (id) => request(`/departments/${id}`, { method: "DELETE" }),

  // İşlemler
  getTransactions: () => request("/transactions"),
  createTransaction: (data) => request("/transactions", { method: "POST", body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),

  // İstatistik
  getStats: () => request("/stats"),

  // Dışa aktarım
  exportExcel: () => download("/export/excel", "fintrack-islemler.xlsx"),
  exportPdf: () => download("/export/pdf", "fintrack-rapor.pdf"),
};
