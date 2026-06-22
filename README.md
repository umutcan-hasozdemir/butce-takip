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

