import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './db.js';
import { userSockets } from './socketMap.js';

// Route Imports
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import tripsRoutes from './routes/trips.js';
import recurringRoutes from './routes/recurring.js';
import messagesRoutes from './routes/messages.js';
import externalRoutes from './routes/external.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS Konfiguration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Socket.io Setup
const io = new SocketServer(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// io an express-app übergeben, damit Routen darauf zugreifen können
app.set('io', io);

// WebSocket-Verbindungshandling
io.on('connection', (socket) => {
  console.log(`Socket verbunden: ${socket.id}`);

  // Benutzer meldet sich an und wird gemappt
  socket.on('user-login', (userId) => {
    const uid = parseInt(userId);
    userSockets.set(uid, socket.id);
    console.log(`Benutzer ${uid} ist online mit Socket ${socket.id}`);
    io.emit('user-online', uid);
  });

  // Chat-Nachrichten über Socket empfangen und speichern
  socket.on('send-message', async (data) => {
    try {
      const { from_user_id, to_user_id, trip_id, content } = data;
      if (!from_user_id || !to_user_id || !content) return;

      // In Datenbank speichern
      const result = await query(`
        INSERT INTO messages (from_user_id, to_user_id, trip_id, content, is_read)
        VALUES ($1, $2, $3, $4, FALSE)
        RETURNING *
      `, [from_user_id, to_user_id, trip_id || null, content]);

      const newMessage = result.rows[0];

      // An Empfänger senden
      const recipientSocketId = userSockets.get(to_user_id);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('new-message', newMessage);
      }
      
      // Zur Bestätigung auch an den Absender senden
      socket.emit('message-sent', newMessage);
    } catch (err) {
      console.error('Fehler bei WS-Nachricht:', err.message);
    }
  });

  // Tipp-Indikator
  socket.on('typing', ({ from_user_id, to_user_id }) => {
    const recipientSocketId = userSockets.get(to_user_id);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user-typing', { from_user_id });
    }
  });

  socket.on('stop-typing', ({ from_user_id, to_user_id }) => {
    const recipientSocketId = userSockets.get(to_user_id);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user-stopped-typing', { from_user_id });
    }
  });

  // Nachricht als gelesen markieren
  socket.on('message-read', async ({ message_id }) => {
    try {
      await query('UPDATE messages SET is_read = TRUE WHERE id = $1', [message_id]);
    } catch (err) {
      console.error('Fehler beim Markieren der Nachricht als gelesen:', err.message);
    }
  });

  // Benutzer loggt sich aus
  socket.on('user-logout', () => {
    for (const [uid, sid] of userSockets.entries()) {
      if (sid === socket.id) {
        userSockets.delete(uid);
        console.log(`Benutzer ${uid} ausgeloggt.`);
        io.emit('user-offline', uid);
        break;
      }
    }
  });

  // Verbindung unterbrochen
  socket.on('disconnect', () => {
    console.log(`Socket getrennt: ${socket.id}`);
    for (const [uid, sid] of userSockets.entries()) {
      if (sid === socket.id) {
        userSockets.delete(uid);
        console.log(`Benutzer ${uid} ist offline (Verbindung getrennt).`);
        io.emit('user-offline', uid);
        break;
      }
    }
  });
});

// API-Routen registrieren
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/recurring-trips', recurringRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api', externalRoutes); // Mounts /api/geocode und /api/route

// Fallback Route
app.use((req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden' });
});

// Globaler Error Handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Interner Serverfehler',
    message: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT} (NODE_ENV: ${process.env.NODE_ENV})`);
});
