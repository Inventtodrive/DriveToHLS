import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const NOMINATIM_API_URL = process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org';
const OSRM_API_URL = process.env.OSRM_API_URL || 'https://router.project-osrm.org';

// Einfacher Drosselungs-Mechanismus (Rate Limiting: max. 1 Request/Sekunde)
let lastNominatimRequest = 0;
let lastOsrmRequest = 0;

const throttleNominatim = async () => {
  const now = Date.now();
  const timeSinceLast = now - lastNominatimRequest;
  if (timeSinceLast < 1000) {
    const delay = 1000 - timeSinceLast;
    lastNominatimRequest = now + delay;
    await new Promise(resolve => setTimeout(resolve, delay));
  } else {
    lastNominatimRequest = now;
  }
};

const throttleOsrm = async () => {
  const now = Date.now();
  const timeSinceLast = now - lastOsrmRequest;
  if (timeSinceLast < 1000) {
    const delay = 1000 - timeSinceLast;
    lastOsrmRequest = now + delay;
    await new Promise(resolve => setTimeout(resolve, delay));
  } else {
    lastOsrmRequest = now;
  }
};

// Geocoding Endpoint
router.get('/geocode', async (req, res, next) => {
  try {
    const { address } = req.query;
    if (!address || address.trim().length < 3) {
      return res.status(400).json({ error: 'Adresse muss mindestens 3 Zeichen lang sein.' });
    }

    await throttleNominatim();

    const response = await axios.get(`${NOMINATIM_API_URL}/search`, {
      params: {
        q: address,
        format: 'json',
        limit: 5,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'CarpoolApp/1.0 (benedikt.hls@example.com)'
      }
    });

    if (response.data && response.data.length > 0) {
      const bestMatch = response.data[0];
      res.json({
        lat: parseFloat(bestMatch.lat),
        lng: parseFloat(bestMatch.lon),
        address: bestMatch.display_name,
        suggestions: response.data.map(item => ({
          label: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }))
      });
    } else {
      res.status(404).json({ error: 'Adresse nicht gefunden' });
    }
  } catch (err) {
    console.error('Geocoding-Fehler:', err.message);
    next(err);
  }
});

// Routing Endpoint
router.get('/route', async (req, res, next) => {
  try {
    const { start_lat, start_lng, end_lat, end_lng } = req.query;

    if (!start_lat || !start_lng || !end_lat || !end_lng) {
      return res.status(400).json({ error: 'Start- und Zielkoordinaten sind erforderlich.' });
    }

    await throttleOsrm();

    const url = `${OSRM_API_URL}/route/v1/driving/${start_lng},${start_lat};${end_lng},${end_lat}`;
    const response = await axios.get(url, {
      params: {
        geometries: 'geojson',
        overview: 'full',
        steps: false
      }
    });

    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      res.json({
        distance_meters: route.distance,
        duration_seconds: route.duration,
        geometry: route.geometry
      });
    } else {
      res.status(404).json({ error: 'Keine Route gefunden.' });
    }
  } catch (err) {
    console.error('Routing-Fehler:', err.message);
    next(err);
  }
});

export default router;
