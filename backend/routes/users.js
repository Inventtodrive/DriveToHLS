import express from 'express';
import Joi from 'joi';
import { query } from '../db.js';
import { authenticateToken, activeSessions } from '../middleware/auth.js';

const router = express.Router();

const updateSchema = Joi.object({
  name: Joi.string().pattern(/^[a-zA-Z0-9äöüßÄÖÜ\s\-]{2,100}$/).required().messages({
    'string.pattern.base': 'Name muss zwischen 2 und 100 Zeichen lang sein und darf keine Sonderzeichen enthalten.'
  })
});

// Benutzer abrufen
router.get('/:id', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const result = await query('SELECT id, name, phone, created_at FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Benutzername aktualisieren (nur eigene ID)
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Sie dürfen nur Ihr eigenes Profil bearbeiten.' });
    }

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name } = value;
    const result = await query(
      'UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, phone, updated_at',
      [name, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }

    const updatedUser = result.rows[0];

    // In-memory Session aktualisieren
    for (const [token, session] of activeSessions.entries()) {
      if (session.id === userId) {
        activeSessions.set(token, { ...session, name: updatedUser.name });
      }
    }

    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
});

export default router;
