// Vercel Serverless Function girişi.
// Tüm /api/* istekleri (vercel.json rewrite ile) buraya gelir ve
// server/app.js içindeki Express uygulaması tarafından işlenir.
import app from "../server/app.js";

export default app;
