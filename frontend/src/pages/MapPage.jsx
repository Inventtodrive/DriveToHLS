import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { getSocket } from '../services/socket.js';
import Map from '../components/Map.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function MapPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Filter-States
  const [tripTypeFilter, setTripTypeFilter] = useState(''); // '' = Alle, '0' = Sucht, '1' = Bietet
  const [fromTimeFilter, setFromTimeFilter] = useState('');
  const [onlyRecurring, setOnlyRecurring] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');

  // 1. Fahrten vom Server laden
  const fetchTrips = async () => {
    setLoading(true);
    try {
      const params = {};
      if (tripTypeFilter !== '') {
        params.trip_type = parseInt(tripTypeFilter);
      }
      if (fromTimeFilter) {
        params.from_time = new Date(fromTimeFilter).toISOString();
      }
      
      const res = await api.get('/trips', { params });
      
      // Client-seitiger Filter für "Nur Wiederkehrend"
      let filtered = res.data;
      if (onlyRecurring) {
        filtered = filtered.filter(t => t.is_recurring);
      }

      // Client-seitiger Filter für Adresse
      if (addressSearch.trim().length >= 3) {
        const query = addressSearch.toLowerCase();
        filtered = filtered.filter(t => 
          t.start_address.toLowerCase().includes(query) || 
          t.end_address.toLowerCase().includes(query)
        );
      }

      setTrips(filtered);
    } catch (err) {
      console.error('Fehler beim Laden der Fahrten:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trips neu laden, wenn sich Filter ändern
  useEffect(() => {
    fetchTrips();
    // Route und Auswahl zurücksetzen, wenn Filter geändert werden
    setRouteGeometry(null);
  }, [tripTypeFilter, fromTimeFilter, onlyRecurring, addressSearch]);

  // 2. Real-time WebSocket Updates
  useEffect(() => {
    const socket = getSocket();
    
    if (!socket.connected) {
      socket.connect();
    }

    const handleTripCreated = (newTrip) => {
      setTrips(prev => {
        // Überprüfen, ob Trip bereits existiert (Dublettenvermeidung)
        if (prev.some(t => t.id === newTrip.id)) return prev;
        
        // Filter-Bedingungen prüfen
        if (tripTypeFilter !== '' && newTrip.trip_type !== parseInt(tripTypeFilter)) return prev;
        if (onlyRecurring && !newTrip.is_recurring) return prev;
        
        return [newTrip, ...prev];
      });
    };

    const handleTripUpdated = (updatedTrip) => {
      setTrips(prev => prev.map(t => t.id === updatedTrip.id ? { ...t, ...updatedTrip } : t));
      setSelectedTrip(prev => {
        if (prev && prev.id === updatedTrip.id) {
          return { ...prev, ...updatedTrip };
        }
        return prev;
      });
    };

    const handleTripDeleted = ({ id }) => {
      setTrips(prev => prev.filter(t => t.id !== id));
      setSelectedTrip(prev => {
        if (prev && prev.id === id) {
          setRouteGeometry(null);
          return null;
        }
        return prev;
      });
    };

    socket.on('trip-created', handleTripCreated);
    socket.on('trip-updated', handleTripUpdated);
    socket.on('trip-deleted', handleTripDeleted);

    return () => {
      socket.off('trip-created', handleTripCreated);
      socket.off('trip-updated', handleTripUpdated);
      socket.off('trip-deleted', handleTripDeleted);
    };
  }, [tripTypeFilter, onlyRecurring]);

  // 3. OSRM-Route laden
  const handleShowRoute = async (trip) => {
    setRouteLoading(true);
    setRouteGeometry(null);
    try {
      const res = await api.get('/route', {
        params: {
          start_lat: trip.start_lat,
          start_lng: trip.start_lng,
          end_lat: trip.end_lat,
          end_lng: trip.end_lng
        }
      });
      setRouteGeometry(res.data.geometry);
    } catch (err) {
      alert('Fehler beim Berechnen der Route: ' + (err.response?.data?.error || err.message));
    } finally {
      setRouteLoading(false);
    }
  };

  const selectTrip = (trip) => {
    setSelectedTrip(trip);
    setRouteGeometry(null); // Vorherige Route löschen
  };

  return (
    <div className="flex-grow flex flex-col md:flex-row h-[calc(100vh-4rem)] relative overflow-hidden">
      
      {/* Linke Sidebar: Filter und Liste */}
      <div className="w-full md:w-96 bg-white border-r border-iosGray-200 flex flex-col h-1/2 md:h-full z-10 shadow-lg">
        
        {/* Filter-Bar */}
        <div className="p-4 border-b border-iosGray-200 space-y-3 bg-white">
          <h2 className="text-lg font-bold text-iosGray-800 flex justify-between items-center">
            <span>🔍 Fahrten filtern</span>
            {loading && <span className="text-xs text-iosBlue animate-pulse font-normal">Aktualisiere...</span>}
          </h2>

          {/* Adresssuche */}
          <input
            type="text"
            placeholder="Nach Ort/Adresse suchen..."
            value={addressSearch}
            onChange={(e) => setAddressSearch(e.target.value)}
            className="w-full min-h-[40px] px-3 py-1.5 border border-iosGray-300 rounded-xl text-sm focus:border-iosBlue focus:ring-1 focus:ring-blue-100 outline-none transition-all"
          />

          {/* Typ-Auswahl */}
          <div className="flex rounded-lg bg-iosGray-100 p-1">
            <button
              onClick={() => setTripTypeFilter('')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tripTypeFilter === '' ? 'bg-white shadow text-iosGray-800' : 'text-iosGray-500 hover:text-iosGray-800'
              }`}
            >
              Alle
            </button>
            <button
              onClick={() => setTripTypeFilter('0')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tripTypeFilter === '0' ? 'bg-white shadow text-iosRed' : 'text-iosGray-500 hover:text-iosRed'
              }`}
            >
              🔴 Sucher
            </button>
            <button
              onClick={() => setTripTypeFilter('1')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tripTypeFilter === '1' ? 'bg-white shadow text-iosGreen' : 'text-iosGray-500 hover:text-iosGreen'
              }`}
            >
              🟢 Anbieter
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 items-center">
            {/* Zeit ab */}
            <div>
              <label className="block text-[10px] font-bold text-iosGray-500 uppercase mb-0.5">Abfahrtszeit ab</label>
              <input
                type="datetime-local"
                value={fromTimeFilter}
                onChange={(e) => setFromTimeFilter(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-iosGray-300 rounded-lg outline-none"
              />
            </div>
            
            {/* Nur wiederkehrend */}
            <div className="flex items-center gap-2 pt-4 justify-end">
              <input
                id="only-recurring"
                type="checkbox"
                checked={onlyRecurring}
                onChange={(e) => setOnlyRecurring(e.target.checked)}
                className="h-4 w-4 text-iosBlue border-iosGray-300 rounded focus:ring-iosBlue"
              />
              <label htmlFor="only-recurring" className="text-xs font-semibold text-iosGray-600 cursor-pointer select-none">
                🔄 Nur Wiederkehrend
              </label>
            </div>
          </div>
        </div>

        {/* Trips-Liste */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-iosGray-100 shadow-inner">
          {trips.length === 0 ? (
            <div className="text-center py-8 text-iosGray-500 text-sm">
              Keine passenden Fahrten gefunden.
            </div>
          ) : (
            trips.map(trip => (
              <div
                key={trip.id}
                onClick={() => selectTrip(trip)}
                className={`p-4 bg-white border rounded-2xl cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] ${
                  selectedTrip?.id === trip.id 
                    ? 'border-iosBlue ring-2 ring-blue-50' 
                    : 'border-iosGray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    trip.trip_type === 1 ? 'bg-green-50 text-iosGreen' : 'bg-red-50 text-iosRed'
                  }`}>
                    {trip.trip_type === 1 ? '🟢 Bietet Plätze' : '🔴 Sucht Fahrer'}
                  </span>
                  {trip.is_recurring && (
                    <span className="text-xs" title="Wiederkehrend">🔄</span>
                  )}
                </div>
                <div className="text-sm font-semibold text-iosGray-800 line-clamp-1">
                  📍 {trip.start_address.split(',')[0]}
                </div>
                <div className="text-sm font-semibold text-iosGray-800 line-clamp-1 mt-0.5">
                  🎯 {trip.end_address.split(',')[0]}
                </div>
                <div className="text-xs text-iosGray-500 mt-2 flex justify-between">
                  <span>⏰ {new Date(trip.departure_time).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  {trip.trip_type === 1 && (
                    <span className="font-medium text-iosBlue">🪑 {trip.seats_available} Sitze</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Rechter Teil: Karte */}
      <div className="flex-grow h-1/2 md:h-full z-0 relative">
        <Map
          trips={trips}
          selectedTrip={selectedTrip}
          onSelectTrip={selectTrip}
          routeGeometry={routeGeometry}
        />

        {/* Fahrt-Details Overlay Panel */}
        {selectedTrip && (
          <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white/95 backdrop-blur-md border border-iosGray-200 rounded-2xl shadow-2xl p-5 z-[500] animate-fade-in space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-iosGray-800">Fahrtdetails</h3>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mt-1 ${
                  selectedTrip.trip_type === 1 ? 'bg-green-50 text-iosGreen' : 'bg-red-50 text-iosRed'
                }`}>
                  {selectedTrip.trip_type === 1 ? '🟢 Bietet Mitfahrgelegenheit' : '🔴 Sucht Mitfahrgelegenheit'}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedTrip(null);
                  setRouteGeometry(null);
                }}
                className="text-iosGray-500 hover:text-iosGray-800 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-sm text-iosGray-700">
              <div>
                <b className="text-iosGray-500 text-xs block">VON:</b>
                <span className="font-medium">{selectedTrip.start_address}</span>
              </div>
              <div>
                <b className="text-iosGray-500 text-xs block">NACH:</b>
                <span className="font-medium">{selectedTrip.end_address}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <b className="text-iosGray-500 text-xs block">ABFAHRT:</b>
                  <span className="font-medium">
                    {new Date(selectedTrip.departure_time).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                {selectedTrip.trip_type === 1 && (
                  <div>
                    <b className="text-iosGray-500 text-xs block">FREIE SITZE:</b>
                    <span className="font-medium">{selectedTrip.seats_available} Plätze</span>
                  </div>
                )}
              </div>
              
              <div className="border-t border-iosGray-200 pt-3 flex items-center justify-between mt-2">
                <div>
                  <b className="text-iosGray-500 text-xs block">ERSTELLER:</b>
                  <span className="font-semibold text-iosGray-800">{selectedTrip.creator?.name}</span>
                </div>
                <div className="text-right">
                  <b className="text-iosGray-500 text-xs block">TELEFON:</b>
                  <a href={`tel:${selectedTrip.creator?.phone}`} className="text-iosBlue hover:underline font-medium">
                    {selectedTrip.creator?.phone}
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => handleShowRoute(selectedTrip)}
                disabled={routeLoading}
                className="py-2.5 px-3 border border-iosBlue text-iosBlue text-xs font-bold rounded-xl hover:bg-blue-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1"
              >
                {routeLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-iosBlue border-t-transparent"></div>
                ) : (
                  '📍 Route anzeigen'
                )}
              </button>

              {/* Chat Button (Nur wenn nicht eigene Fahrt) */}
              {selectedTrip.user_id !== currentUser?.id ? (
                <button
                  onClick={() => navigate(`/chat/${selectedTrip.user_id}?tripId=${selectedTrip.id}`)}
                  className="py-2.5 px-3 bg-iosBlue text-white text-xs font-bold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1 shadow-md shadow-blue-100"
                >
                  💬 Chat starten
                </button>
              ) : (
                <button
                  onClick={() => navigate('/my-trips')}
                  className="py-2.5 px-3 bg-iosGray-200 text-iosGray-800 text-xs font-bold rounded-xl hover:bg-iosGray-300 transition-colors"
                >
                  ⚙️ Fahrt verwalten
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
