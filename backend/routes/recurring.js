import express from 'express';
import Joi from 'joi';
import axios from 'axios';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const NOMINATIM_API_URL = process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org';
let lastNominatimRequest = 0;

const recurringSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  start_address: Joi.string().min(3).max(255).required(),
  start_lat: Joi.number().min(-90).max(90).allow(null).optional(),
  start_lng: Joi.number().min(-180).max(180).allow(null).optional(),
  end_address: Joi.string().min(3).max(255).required(),
  end_lat: Joi.number().min(-90).max(90).allow(null).optional(),
  end_lng: Joi.number().min(-180).max(180).allow(null).optional(),
  departure_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
    'string.pattern.base': 'Uhrzeit muss im Format HH:MM sein.'
  }),
  trip_type: Joi.number().valid(0, 1).required(),
  seats_available: Joi.when('trip_type', {
    is: 1,
    then: Joi.number().integer().min(1).max(7).required(),
    otherwise: Joi.allow(null).optional()
  }),
  frequency: Joi.string().valid('daily', 'weekly').required(),
  day_of_week: Joi.when('frequency', {
    is: 'weekly',
    then: Joi.number().integer().min(0).max(6).required(), // 0=Montag, 6=Sonntag
    otherwise: Joi.forbidden()
  }),
  end_date: Joi.date().iso().greater('now').required()
});

const updateRecurringSchema = Joi.object({
  departure_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  seats_available: Joi.number().integer().min(1).max(7).optional(),
  frequency: Joi.string().valid('daily', 'weekly').optional(),
  day_of_week: Joi.number().integer().min(0).max(6).optional(),
  end_date: Joi.date().iso().greater('now').optional()
});

// Helper zum Generieren von zukünftigen Terminen
const generateInstances = (master, startDate = new Date()) => {
  const instances = [];
  const [hours, minutes] = master.departure_time.split(':').map(Number);
  
  const limitDays = master.frequency === 'daily' ? 30 : 84; // 30 Tage oder 12 Wochen (84 Tage)
  const maxEndDate = new Date(startDate.getTime() + limitDays * 24 * 60 * 60 * 1000);
  const finalEndDate = master.end_date ? new Date(Math.min(new Date(master.end_date).getTime(), maxEndDate.getTime())) : maxEndDate;
  finalEndDate.setHours(23, 59, 59, 999);

  let currentDate = new Date(startDate);
  currentDate.setHours(hours, minutes, 0, 0);

  if (master.frequency === 'daily') {
    for (let i = 0; i < 30; i++) {
      if (currentDate > finalEndDate) break;
      if (currentDate > startDate) {
        instances.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else if (master.frequency === 'weekly') {
    const jsDayToOurDay = (jsDay) => (jsDay === 0 ? 6 : jsDay - 1);
    let daysToAdd = (master.day_of_week - jsDayToOurDay(currentDate.getDay()) + 7) % 7;
    if (daysToAdd === 0 && currentDate <= startDate) {
      daysToAdd = 7;
    }
    currentDate.setDate(currentDate.getDate() + daysToAdd);

    for (let i = 0; i < 12; i++) {
      if (currentDate > finalEndDate) break;
      if (currentDate > startDate) {
        instances.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }

  return instances;
};

// Alle wiederkehrenden Master-Fahrten eines Benutzers abrufen
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM recurring_trips WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Wiederkehrende Fahrt erstellen + Instanzen generieren
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { error, value } = recurringSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    if (req.user.id !== value.user_id) {
      return res.status(403).json({ error: 'Sie dürfen keine Fahrten für andere Benutzer erstellen.' });
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
      seats_available,
      frequency,
      day_of_week,
      end_date
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
          return { lat: parseFloat(response.data[0].lat), lng: parseFloat(response.data[0].lon) };
        }
      } catch (geocodeErr) {
        console.warn('Geocoding-Fallback fehlgeschlagen für:', address, geocodeErr.message);
      }
      return { lat: null, lng: null };
    };

    if (start_lat === null || start_lng === null) {
      const coords = await geocodeAddress(start_address);
      start_lat = coords.lat;
      start_lng = coords.lng;
    }
    if (end_lat === null || end_lng === null) {
      const coords = await geocodeAddress(end_address);
      end_lat = coords.lat;
      end_lng = coords.lng;
    }

    // Verwende Transaktion
    await query('BEGIN');

    const masterResult = await query(`
      INSERT INTO recurring_trips 
        (user_id, start_address, start_lat, start_lng, end_address, end_lat, end_lng, departure_time, trip_type, seats_available, frequency, day_of_week, end_date)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [user_id, start_address, start_lat, start_lng, end_address, end_lat, end_lng, departure_time, trip_type, seats_available, frequency, day_of_week, end_date]);

    const master = masterResult.rows[0];
    const dates = generateInstances(master);

    const generatedInstances = [];
    const io = req.app.get('io');

    for (const departureTimestamp of dates) {
      const tripResult = await query(`
        INSERT INTO trips 
          (user_id, start_address, start_lat, start_lng, end_address, end_lat, end_lng, departure_time, trip_type, seats_available, is_recurring, recurring_id)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11)
        RETURNING *
      `, [user_id, start_address, start_lat, start_lng, end_address, end_lat, end_lng, departureTimestamp, trip_type, seats_available, master.id]);
      
      const newTrip = tripResult.rows[0];
      newTrip.start_lat = parseFloat(newTrip.start_lat);
      newTrip.start_lng = parseFloat(newTrip.start_lng);
      newTrip.end_lat = parseFloat(newTrip.end_lat);
      newTrip.end_lng = parseFloat(newTrip.end_lng);
      newTrip.creator = {
        id: req.user.id,
        name: req.user.name,
        phone: req.user.phone
      };

      generatedInstances.push({
        id: newTrip.id,
        departure_time: newTrip.departure_time
      });

      // WebSocket Event für jede Instanz senden
      if (io) {
        io.emit('trip-created', newTrip);
      }
    }

    await query('COMMIT');

    res.status(201).json({
      id: master.id,
      frequency: master.frequency,
      auto_generated_instances: generatedInstances
    });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});

// Master-Fahrt und deren zukünftige Instanzen abrufen
router.get('/:id', async (req, res, next) => {
  try {
    const masterId = parseInt(req.params.id);
    const masterResult = await query('SELECT * FROM recurring_trips WHERE id = $1', [masterId]);

    if (masterResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wiederkehrende Fahrt nicht gefunden.' });
    }

    const master = masterResult.rows[0];

    // Zukünftige Instanzen abrufen
    const instancesResult = await query(
      'SELECT id, departure_time FROM trips WHERE recurring_id = $1 AND departure_time > NOW() ORDER BY departure_time ASC',
      [masterId]
    );

    res.json({
      id: master.id,
      user_id: master.user_id,
      frequency: master.frequency,
      day_of_week: master.day_of_week,
      end_date: master.end_date,
      next_instances: instancesResult.rows
    });
  } catch (err) {
    next(err);
  }
});

// Wiederkehrende Fahrt aktualisieren
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const masterId = parseInt(req.params.id);
    const { error, value } = updateRecurringSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const masterCheck = await query('SELECT * FROM recurring_trips WHERE id = $1', [masterId]);
    if (masterCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Wiederkehrende Fahrt nicht gefunden.' });
    }

    if (masterCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Sie dürfen nur Ihre eigenen wiederkehrenden Fahrten bearbeiten.' });
    }

    const currentMaster = masterCheck.rows[0];

    await query('BEGIN');

    // Master aktualisieren
    const updatedMasterResult = await query(`
      UPDATE recurring_trips
      SET 
        departure_time = COALESCE($1, departure_time),
        seats_available = COALESCE($2, seats_available),
        frequency = COALESCE($3, frequency),
        day_of_week = COALESCE($4, day_of_week),
        end_date = COALESCE($5, end_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND user_id = $7
      RETURNING *
    `, [
      value.departure_time || null,
      value.seats_available || null,
      value.frequency || null,
      value.day_of_week !== undefined ? value.day_of_week : null,
      value.end_date || null,
      masterId,
      req.user.id
    ]);

    const updatedMaster = updatedMasterResult.rows[0];

    // WebSocket-Zwecke: Erst ID der zu löschenden zukünftigen Fahrten abrufen
    const futureTripsResult = await query(
      'SELECT id FROM trips WHERE recurring_id = $1 AND departure_time > NOW()',
      [masterId]
    );
    const futureTripIds = futureTripsResult.rows.map(r => r.id);

    // Alle zukünftigen Termine löschen (wir regenerieren sie mit den neuen Regeln)
    await query('DELETE FROM trips WHERE recurring_id = $1 AND departure_time > NOW()', [masterId]);

    const io = req.app.get('io');
    if (io) {
      // Alte zukünftige Instanzen bei Clients löschen
      futureTripIds.forEach(id => {
        io.emit('trip-deleted', { id });
      });
    }

    // Neue Termine ab JETZT generieren
    const dates = generateInstances(updatedMaster);
    const newInstances = [];

    for (const departureTimestamp of dates) {
      const tripResult = await query(`
        INSERT INTO trips 
          (user_id, start_address, start_lat, start_lng, end_address, end_lat, end_lng, departure_time, trip_type, seats_available, is_recurring, recurring_id)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11)
        RETURNING *
      `, [
        updatedMaster.user_id,
        updatedMaster.start_address,
        updatedMaster.start_lat,
        updatedMaster.start_lng,
        updatedMaster.end_address,
        updatedMaster.end_lat,
        updatedMaster.end_lng,
        departureTimestamp,
        updatedMaster.trip_type,
        updatedMaster.seats_available,
        masterId
      ]);

      const newTrip = tripResult.rows[0];
      newTrip.start_lat = parseFloat(newTrip.start_lat);
      newTrip.start_lng = parseFloat(newTrip.start_lng);
      newTrip.end_lat = parseFloat(newTrip.end_lat);
      newTrip.end_lng = parseFloat(newTrip.end_lng);
      newTrip.creator = {
        id: req.user.id,
        name: req.user.name,
        phone: req.user.phone
      };

      newInstances.push({
        id: newTrip.id,
        departure_time: newTrip.departure_time
      });

      if (io) {
        io.emit('trip-created', newTrip);
      }
    }

    await query('COMMIT');

    res.json({
      success: true,
      master: updatedMaster,
      auto_generated_instances: newInstances
    });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});

// Wiederkehrende Fahrt löschen (löscht Master + alle zugehörigen Trips via ON DELETE CASCADE)
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const masterId = parseInt(req.params.id);

    const masterCheck = await query('SELECT * FROM recurring_trips WHERE id = $1', [masterId]);
    if (masterCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Wiederkehrende Fahrt nicht gefunden.' });
    }

    if (masterCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Sie dürfen nur Ihre eigenen wiederkehrenden Fahrten löschen.' });
    }

    // Hole alle verknüpften Trip-IDs ab für den WebSocket-Broadcast
    const tripsResult = await query('SELECT id FROM trips WHERE recurring_id = $1', [masterId]);
    const tripIds = tripsResult.rows.map(r => r.id);

    // Löscht dank FOREIGN KEY CONSTRAINT cascade auch alle trips-Zeilen!
    await query('DELETE FROM recurring_trips WHERE id = $1 AND user_id = $2', [masterId, req.user.id]);

    const io = req.app.get('io');
    if (io) {
      tripIds.forEach(id => {
        io.emit('trip-deleted', { id });
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
