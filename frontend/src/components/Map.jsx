import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function Map({ trips, selectedTrip, onSelectTrip, routeGeometry }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeLayerRef = useRef(null);

  // 1. Karte initialisieren (einmalig)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Erstelle Leaflet-Karte, Standardansicht: Deutschland Mitte
    const map = L.map(mapContainerRef.current).setView([51.1657, 10.4515], 6);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Marker aktualisieren, wenn sich trips ändern
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Bestehende Marker entfernen
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    // Neue Marker hinzufügen
    trips.forEach(trip => {
      if (!trip.start_lat || !trip.start_lng) return;

      const color = trip.trip_type === 1 ? '#34C759' : '#FF3B30'; // Grün für Bietet, Rot für Sucht
      
      const marker = L.circleMarker([trip.start_lat, trip.start_lng], {
        radius: 9,
        fillColor: color,
        color: '#FFFFFF',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95
      });

      const popupContent = `
        <div class="p-1 text-sm font-sans">
          <div class="font-bold text-iosGray-800">${trip.trip_type === 1 ? '🟢 Bietet Fahrt' : '🔴 Sucht Fahrt'}</div>
          <div class="text-xs text-iosGray-500 mt-1"><b>Von:</b> ${trip.start_address.split(',')[0]}</div>
          <div class="text-xs text-iosGray-500"><b>Nach:</b> ${trip.end_address.split(',')[0]}</div>
          <div class="text-xs text-iosGray-500"><b>Wann:</b> ${new Date(trip.departure_time).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</div>
          <button 
            id="marker-btn-${trip.id}"
            class="mt-2 w-full px-2 py-1 bg-iosBlue text-white text-xs font-semibold rounded hover:opacity-90 transition-opacity"
          >
            Details anzeigen
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(map);

      // Listener beim Öffnen des Popups registrieren
      marker.on('popupopen', () => {
        const btn = document.getElementById(`marker-btn-${trip.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectTrip(trip);
            map.closePopup();
          };
        }
      });

      markersRef.current.push(marker);
    });

  }, [trips, onSelectTrip]);

  // 3. Auf Karten-Fokus-Änderungen reagieren (ausgewählter Trip)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedTrip) return;

    // Zentriere Karte auf den Startpunkt des ausgewählten Trips
    map.setView([selectedTrip.start_lat, selectedTrip.start_lng], 10, {
      animate: true,
      duration: 0.8
    });
  }, [selectedTrip]);

  // 4. Route zeichnen
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Alte Route löschen
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    // Neue Route einzeichnen
    if (routeGeometry) {
      const geoJsonLayer = L.geoJSON(routeGeometry, {
        style: {
          color: '#007AFF', // iOS Blau
          weight: 5,
          opacity: 0.75,
          lineCap: 'round',
          lineJoin: 'round'
        }
      }).addTo(map);

      routeLayerRef.current = geoJsonLayer;

      // Karte an die Route anpassen
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [routeGeometry]);

  return (
    <div className="relative w-full h-full min-h-[350px] md:min-h-0 rounded-2xl overflow-hidden shadow-inner border border-iosGray-200">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  );
}
