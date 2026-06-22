import jwt from "jsonwebtoken";

// Üretimde bu değer ortam değişkeninden (process.env.JWT_SECRET) gelmelidir.
const JWT_SECRET = process.env.JWT_SECRET || "fintrack-dev-secret-degistir";
const TOKEN_TTL = "7d";

export function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

// Geçerli JWT olmadan erişimi engeller; req.user'ı doldurur
export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Oturum açmanız gerekiyor." });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Oturum süresi doldu, tekrar giriş yapın." });
  }
}

// Belirli rollere sahip olmayan kullanıcıları engeller
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Bu işlem için yetkiniz yok." });
    }
    next();
  };
}
