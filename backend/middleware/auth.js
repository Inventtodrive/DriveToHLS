import crypto from 'crypto';

// In-memory Speicher für aktive Sessions: token -> user { id, name, phone }
export const activeSessions = new Map();

// Erstellt eine neue Session und gibt das Token zurück
export const createSession = (user) => {
  const token = crypto.randomBytes(16).toString('hex'); // 32 Hex-Zeichen
  activeSessions.set(token, user);
  return token;
};

// Middleware zur Authentifizierung
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Zugriff verweigert: Kein Token bereitgestellt.' });
  }

  const user = activeSessions.get(token);
  if (!user) {
    return res.status(403).json({ error: 'Ungültiges oder abgelaufenes Token.' });
  }

  req.user = user;
  next();
};
