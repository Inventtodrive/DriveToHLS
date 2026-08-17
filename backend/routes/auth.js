import express from 'express';
import Joi from 'joi';
import { query } from '../db.js';
import { createSession } from '../middleware/auth.js';

const router = express.Router();

// Validierungsschemata
const loginSchema = Joi.object({
  phone: Joi.string().pattern(/^\+?[0-9]{7,20}$/).required().messages({
    'string.pattern.base': 'Telefonnummer muss zwischen 7 und 20 Ziffern enthalten und darf mit + beginnen.'
  })
});

const registerSchema = Joi.object({
  phone: Joi.string().pattern(/^\+?[0-9]{7,20}$/).required().messages({
    'string.pattern.base': 'Telefonnummer muss zwischen 7 und 20 Ziffern enthalten und darf mit + beginnen.'
  }),
  name: Joi.string().pattern(/^[a-zA-Z0-9äöüßÄÖÜ\s\-]{2,100}$/).required().messages({
    'string.pattern.base': 'Name muss zwischen 2 und 100 Zeichen lang sein und darf keine Sonderzeichen enthalten.'
  })
});

// Login-Endpoint
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { phone } = value;
    const result = await query('SELECT * FROM users WHERE phone = $1', [phone]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden. Bitte registrieren Sie sich.' });
    }

    const user = result.rows[0];
    const token = createSession({ id: user.id, name: user.name, phone: user.phone });

    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      token
    });
  } catch (err) {
    next(err);
  }
});

// Registrierungs-Endpoint
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { phone, name } = value;

    // Überprüfen, ob Telefon bereits registriert ist
    const checkUser = await query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'Diese Telefonnummer ist bereits registriert.' });
    }

    const result = await query(
      'INSERT INTO users (phone, name) VALUES ($1, $2) RETURNING *',
      [phone, name]
    );

    const user = result.rows[0];
    const token = createSession({ id: user.id, name: user.name, phone: user.phone });

    res.status(201).json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      token
    });
  } catch (err) {
    next(err);
  }
});

export default router;
