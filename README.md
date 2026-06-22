# 💼 FinTrack — Kurumsal Harcama Yönetimi (SaaS)

Şirketlerin gelir ve giderlerini departman/maliyet merkezi bazında takip etmesini
sağlayan **çok kiracılı (multi-tenant) full-stack** bir SaaS uygulaması. Her şirketin
verisi izoledir; kullanıcılar rollerine göre yetkilendirilir, raporlar Excel ve PDF
olarak dışa aktarılabilir.

> **Mimari:** React (Vite) + Express REST API + SQLite + JWT kimlik doğrulama.

## ✨ Özellikler

### 🔐 Kimlik Doğrulama & Çok Kiracılı Yapı
- **Şirket kaydı** — her kayıt yeni bir kiracı (tenant) + admin kullanıcı oluşturur
- **JWT tabanlı giriş**, bcrypt ile şifre hash'leme
- **Veri izolasyonu** — her şirket yalnızca kendi verisini görür (`company_id` ile)

### 👥 Rol Yönetimi
| Rol | Yetkiler |
|-----|----------|
| 👑 **Yönetici (admin)** | Tam yetki + kullanıcı yönetimi |
| 📒 **Muhasebe (accountant)** | İşlem, kategori ve departman yönetimi + raporlar |
| 👤 **Çalışan (employee)** | Yalnızca işlem ekleme ve görüntüleme |

Yetkiler hem **arayüzde** (menü/buton gizleme) hem de **backend'de** (middleware) zorlanır.

### 📊 Dashboard & Analiz
- KPI kartları: Toplam Gelir, Gider, Net Bakiye, **Kâr Marjı**
- Gider kategorisi dağılımı, aylık gelir/gider ve **departman bazlı gider** grafikleri

### 💳 İşlem Yönetimi
- Gelir/gider: tutar, kategori, **departman/maliyet merkezi**, **tedarikçi/cari**, açıklama, tarih
- Tür filtreleme + metin arama

### ⚙️ Özelleştirme
- **Özel kategori oluşturma** (ad, tür, ikon, renk)
- **Departman / maliyet merkezi** tanımlama

### 📤 Rapor Dışa Aktarımı
- **Excel (.xlsx)** — biçimlendirilmiş işlem tablosu (ExcelJS)
- **PDF** — özet + işlem dökümü, Türkçe karakter destekli (PDFKit)

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Ön yüz | React, Vite, Recharts |
| Arka uç | Node.js, Express |
| Veritabanı | SQLite (better-sqlite3) |
| Kimlik | JWT (jsonwebtoken), bcryptjs |
| Dışa aktarım | ExcelJS, PDFKit |

## 🚀 Çalıştırma

İki ayrı terminal gerekir:

**1) Backend (API):**
```bash
cd server
npm install
npm start          # http://localhost:3001
```

**2) Frontend (arayüz):**
```bash
npm install
npm run dev        # http://localhost:5173
```

### 🔑 Demo Hesaplar (şifre: `demo1234`)
| Rol | E-posta |
|-----|---------|
| Yönetici | `admin@demo.com` |
| Muhasebe | `muhasebe@demo.com` |
| Çalışan | `calisan@demo.com` |

## 📁 Proje Yapısı

```
butce-takip/
├── server/                  # Backend (Express + SQLite)
│   ├── index.js             # REST API + auth + export
│   ├── auth.js              # JWT imzalama & rol middleware
│   ├── db.js                # Şema, multi-tenant seed
│   └── fintrack.db          # SQLite (otomatik oluşur)
│
└── src/                     # Frontend (React)
    ├── api/client.js        # API katmanı + token yönetimi
    ├── components/
    │   ├── AuthScreen.jsx       # Giriş / kayıt
    │   ├── Sidebar.jsx          # Rol bazlı menü + oturum
    │   ├── Summary.jsx          # KPI kartları
    │   ├── Charts.jsx           # 3 grafik
    │   ├── TransactionForm.jsx
    │   ├── TransactionList.jsx
    │   ├── CategoryManager.jsx  # özel kategori CRUD
    │   ├── DepartmentManager.jsx
    │   └── UserManager.jsx      # kullanıcı yönetimi (admin)
    ├── utils/format.js
    └── App.jsx              # oturum + görünüm yönetimi
```

## 🔌 Başlıca API Uç Noktaları

| Metod | Yol | Yetki |
|-------|-----|-------|
| POST | `/api/auth/register`, `/api/auth/login` | herkese açık |
| GET | `/api/auth/me` | oturum |
| CRUD | `/api/users` | admin |
| CRUD | `/api/categories`, `/api/departments` | admin, muhasebe |
| GET/POST | `/api/transactions` | tüm roller |
| DELETE | `/api/transactions/:id` | admin, muhasebe |
| GET | `/api/stats` | oturum |
| GET | `/api/export/excel`, `/api/export/pdf` | oturum |

## 💡 Yol Haritası (Ticari Sürüm)

- [x] Kullanıcı girişi & rol yönetimi
- [x] Çok kiracılı (multi-tenant) yapı
- [x] Excel / PDF rapor dışa aktarımı
- [ ] Harcama onay akışı (approval workflow)
- [ ] Fatura görseli / belge ekleme
- [ ] Bütçe hedefi ve uyarılar
- [ ] PostgreSQL'e geçiş (yüksek hacim için)
- [ ] Ortam değişkeni ile JWT secret yönetimi & HTTPS dağıtım

## 🔒 Güvenlik Notları (Üretim Öncesi)
- `JWT_SECRET` ortam değişkeni olarak ayarlanmalı (şu an dev varsayılanı var).
- PDF dışa aktarımı Türkçe karakter için Windows Arial fontunu kullanır; dağıtımda
  fontu projeye gömün (örn. DejaVuSans).
