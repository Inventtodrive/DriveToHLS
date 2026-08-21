import express from 'express';
import Joi from 'joi';
import axios from 'axios';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const NOMINATIM_API_URL = process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org';
let lastNominatimRequest = 0;

// Joi-Validierung für neue Fahrten
// Koordinaten können null sein (freie Texteingabe – Backend geocodet dann selbst)
const tripSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  start_address: Joi.string().min(3).max(255).required(),
  start_lat: Joi.number().min(-90).max(90).allow(null).optional(),
  start_lng: Joi.number().min(-180).max(180).allow(null).optional(),
  end_address: Joi.string().min(3).max(255).required(),
  end_lat: Joi.number().min(-90).max(90).allow(null).optional(),
  end_lng: Joi.number().min(-180).max(180).allow(null).optional(),
  departure_time: Joi.date().iso().greater('now').required().messages({
    'date.greater': 'Die Abfahrtszeit muss in der Zukunft liegen.'
  }),
  trip_type: Joi.number().valid(0, 1).required(),
  seats_available: Joi.when('trip_type', {
    is: 1,
    then: Joi.number().integer().min(1).max(7).required(),
    otherwise: Joi.allow(null).optional() // Sucht Fahrer benötigt keine Sitze
  })
});

const updateTripSchema = Joi.object({
  departure_time: Joi.date().iso().greater('now').optional(),
  seats_available: Joi.number().integer().min(1).max(7).optional()
});

// Alle Fahrten abrufen (mit optionalen Filtern)
router.get('/', async (req, res, next) => {
  try {
    const { from_time, to_time, trip_type } = req.query;

    let sql = `
      SELECT t.*, u.name as user_name, u.phone as user_phone
      FROM trips t
      JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (trip_type !== undefined && trip_type !== '') {
      sql += ` AND t.trip_type = $${paramIndex++}`;
      params.push(parseInt(trip_type));
    }

    if (from_time) {
      sql += ` AND t.departure_time >= $${paramIndex++}`;
      params.push(new Date(from_time).toISOString());
    } else {
      // Standardmäßig nur zukünftige Fahrten anzeigen
      sql += ` AND t.departure_time >= NOW()`;
    }

    if (to_time) {
      sql += ` AND t.departure_time <= $${paramIndex++}`;
      params.push(new Date(to_time).toISOString());
    }

    sql += ` ORDER BY t.departure_time ASC`;

    const result = await query(sql, params);
    
    // Formatierung für das Frontend
    const formattedTrips = result.rows.map(trip => ({
      id: trip.id,
      user_id: trip.user_id,
      start_address: trip.start_address,
      start_lat: parseFloat(trip.start_lat),
      start_lng: parseFloat(trip.start_lng),
      end_address: trip.end_address,
      end_lat: parseFloat(trip.end_lat),
      end_lng: parseFloat(trip.end_lng),
      departure_time: trip.departure_time,
      trip_type: trip.trip_type,
      seats_available: trip.seats_available,
      is_recurring: trip.is_recurring,
      created_at: trip.created_at,
      creator: {
        id: trip.user_id,
        name: trip.user_name,
        phone: trip.user_phone
      }
    }));

    res.json(formattedTrips);
  } catch (err) {
    next(err);
  }
});

// Einzelne Fahrt abrufen
router.get('/:id', async (req, res, next) => {
  try {
    const tripId = parseInt(req.params.id);
    const result = await query(`
      SELECT t.*, u.name as user_name, u.phone as user_phone
      FROM trips t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = $1
    `, [tripId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fahrt nicht gefunden.' });
    }

    const trip = result.rows[0];
    res.json({
      id: trip.id,
      user_id: trip.user_id,
      start_address: trip.start_address,
      start_lat: parseFloat(trip.start_lat),
      start_lng: parseFloat(trip.start_lng),
      end_address: trip.end_address,
      end_lat: parseFloat(trip.end_lat),
      end_lng: parseFloat(trip.end_lng),
      departure_time: trip.departure_time,
      trip_type: trip.trip_type,
      seats_available: trip.seats_available,
      is_recurring: trip.is_recurring,
      created_at: trip.created_at,
      creator: {
        id: trip.user_id,
        name: trip.user_name,
        phone: trip.user_phone
      }
    });
  } catch (err) {
    next(err);
  }
});

// Neue Fahrt erstellen
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { error, value } = tripSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    if (req.user.id !== value.user_id) {
      return res.status(403).json({ error: 'Sie können keine Fahrten für andere Benutzer erstellen.' });
    }

    let {
      user_id,
      start_address,
      start_lat,
      start_lng,
      end_address,
      end_lat,
      end_lng,
      departure_time,
      trip_type,
      seats_available
    } = value;

    // Geocoding-Fallback: Koordinaten automatisch ermitteln wenn null
    const geocodeAddress = async (address) => {
      try {
        const now = Date.now();
        const timeSinceLast = now - lastNominatimRequest;
        if (timeSinceLast < 1000) {
          await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLast));
        }
        lastNominatimRequest = Date.now();

        const response = await axios.get(`${NOMINATIM_API_URL}/search`, {
          params: { q: address, format: 'json', limit: 1 },
          headers: { 'User-Agent': 'CarpoolApp/1.0' }
        });

        if (response.data && response.data.length > 0) {
          return {
            lat: parseFloat(response.data[0].lat),
            lng: parseFloat(response.data[0].lon)
          };
        }
      } catch (geocodeErr) {
        console.warn('Geocoding-Fallback fehlgeschlagen für:', address, geocodeErr.message);
      }
      return { lat: null, lng: null };
    };

    if (start_lat === null || start_lng === null) {
      console.log('Geocode Startadresse (Fallback):', start_address);
      const coords = await geocodeAddress(start_address);
      start_lat = coords.lat;
      start_lng = coords.lng;
    }

    if (end_lat === null || end_lng === null) {
      console.log('Geocode Zieladresse (Fallback):', end_address);
      const coords = await geocodeAddress(end_address);
      end_lat = coords.lat;
      end_lng = coords.lng;
    }

    const result = await query(`
      INSERT INTO trips 
        (user_id, start_address, start_lat, start_lng, end_address, end_lat, end_lng, departure_time, trip_type, seats_available)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [user_id, start_address, start_lat, start_lng, end_address, end_lat, end_lng, departure_time, trip_type, seats_available]);

    const newTrip = result.rows[0];
    
    // Creator-Details hinzufügen für Websocket-Broadcast
    newTrip.creator = {
      id: req.user.id,
      name: req.user.name,
      phone: req.user.phone
    };
    newTrip.start_lat = newTrip.start_lat ? parseFloat(newTrip.start_lat) : null;
    newTrip.start_lng = newTrip.start_lng ? parseFloat(newTrip.start_lng) : null;
    newTrip.end_lat = newTrip.end_lat ? parseFloat(newTrip.end_lat) : null;
    newTrip.end_lng = newTrip.end_lng ? parseFloat(newTrip.end_lng) : null;

    // WebSocket Broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('trip-created', newTrip);
    }

    res.status(201).json(newTrip);
  } catch (err) {
    next(err);
  }
});

// Fahrt bearbeiten (nur Ersteller)
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const tripId = parseInt(req.params.id);
    const { error, value } = updateTripSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Prüfen, ob die Fahrt dem User gehört
    const tripCheck = await query('SELECT * FROM trips WHERE id = $1', [tripId]);
    if (tripCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Fahrt nicht gefunden.' });
    }

    if (tripCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Sie dürfen nur Ihre eigenen Fahrten bearbeiten.' });
    }

    const { departure_time, seats_available } = value;

    // Nur gegebene Werte aktualisieren
    const result = await query(`
      UPDATE trips
      SET 
        departure_time = COALESCE($1, departure_time),
        seats_available = COALESCE($2, seats_available),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `, [departure_time || null, seats_available || null, tripId, req.user.id]);

    const updatedTrip = result.rows[0];
    updatedTrip.start_lat = parseFloat(updatedTrip.start_lat);
    updatedTrip.start_lng = parseFloat(updatedTrip.start_lng);
    updatedTrip.end_lat = parseFloat(updatedTrip.end_lat);
    updatedTrip.end_lng = parseFloat(updatedTrip.end_lng);

    // WebSocket Broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('trip-updated', updatedTrip);
    }

    res.json(updatedTrip);
  } catch (err) {
    next(err);
  }
});

// Fahrt löschen (nur Ersteller)
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const tripId = parseInt(req.params.id);

    // Prüfen, ob die Fahrt dem User gehört
    const tripCheck = await query('SELECT * FROM trips WHERE id = $1', [tripId]);
    if (tripCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Fahrt nicht gefunden.' });
    }

    if (tripCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Sie dürfen nur Ihre eigenen Fahrten löschen.' });
    }

    await query('DELETE FROM trips WHERE id = $1 AND user_id = $2', [tripId, req.user.id]);

    // WebSocket Broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('trip-deleted', { id: tripId });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
