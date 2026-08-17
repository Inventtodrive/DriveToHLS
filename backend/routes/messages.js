import express from 'express';
import Joi from 'joi';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { userSockets } from '../socketMap.js';

const router = express.Router();

const messageSchema = Joi.object({
  from_user_id: Joi.number().integer().positive().required(),
  to_user_id: Joi.number().integer().positive().required(),
  trip_id: Joi.number().integer().positive().allow(null).optional(),
  content: Joi.string().min(1).required()
});

// Chat-Verlauf abrufen zwischen zwei Benutzern
router.get('/:userId', authenticateToken, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    const otherUserId = parseInt(req.query.otherUserId);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Sie dürfen nur Ihren eigenen Chatverlauf abrufen.' });
    }

    if (!otherUserId) {
      return res.status(400).json({ error: 'Parameter otherUserId ist erforderlich.' });
    }

    // Chronologisch abrufen (älteste zuerst, neueste zuletzt)
    const result = await query(`
      SELECT * FROM messages
      WHERE (from_user_id = $1 AND to_user_id = $2)
         OR (from_user_id = $2 AND to_user_id = $1)
      ORDER BY created_at ASC
      LIMIT $3 OFFSET $4
    `, [userId, otherUserId, limit, offset]);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Neue Nachricht senden
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { error, value } = messageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { from_user_id, to_user_id, trip_id, content } = value;

    if (req.user.id !== from_user_id) {
      return res.status(403).json({ error: 'Absender-ID stimmt nicht mit Ihrer Identität überein.' });
    }

    // Prüfen, ob Empfänger existiert
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [to_user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Empfänger existiert nicht.' });
    }

    const result = await query(`
      INSERT INTO messages 
        (from_user_id, to_user_id, trip_id, content, is_read)
      VALUES 
        ($1, $2, $3, $4, FALSE)
      RETURNING *
    `, [from_user_id, to_user_id, trip_id || null, content]);

    const newMessage = result.rows[0];

    // WebSocket-Zustellung falls Empfänger online ist
    const recipientSocketId = userSockets.get(to_user_id);
    if (recipientSocketId) {
      const io = req.app.get('io');
      if (io) {
        io.to(recipientSocketId).emit('new-message', newMessage);
      }
    }

    res.status(201).json(newMessage);
  } catch (err) {
    next(err);
  }
});

// Nachricht als gelesen markieren (nur Empfänger)
router.put('/:id/read', authenticateToken, async (req, res, next) => {
  try {
    const messageId = parseInt(req.params.id);

    const messageResult = await query('SELECT * FROM messages WHERE id = $1', [messageId]);
    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden.' });
    }

    const message = messageResult.rows[0];
    if (message.to_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Nur der Empfänger kann diese Nachricht als gelesen markieren.' });
    }

    await query('UPDATE messages SET is_read = TRUE WHERE id = $1', [messageId]);

    res.json({ is_read: true });
  } catch (err) {
    next(err);
  }
});

export default router;
