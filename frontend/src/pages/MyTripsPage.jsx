import React, { useState, useEffect } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function MyTripsPage() {
  const { currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'recurring' | 'past'
  const [singleTrips, setSingleTrips] = useState([]);
  const [recurringMasters, setRecurringMasters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Edit-Modal-States
  const [editingItem, setEditingItem] = useState(null); // Trip- oder Recurring-Objekt
  const [isEditingRecurring, setIsEditingRecurring] = useState(false);
  const [editSeats, setEditSeats] = useState(1);
  const [editDepartureTime, setEditDepartureTime] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Alle Fahrten abrufen
      const tripsRes = await api.get('/trips');
      // Filtere die eigenen Fahrten des Nutzers
      const ownTrips = tripsRes.data.filter(t => t.user_id === currentUser.id);
      setSingleTrips(ownTrips);

      // 2. Wiederkehrende Master-Fahrten abrufen
      const recurringRes = await api.get('/recurring-trips');
      setRecurringMasters(recurringRes.data);
    } catch (err) {
      console.error('Fehler beim Abrufen der Fahrten:', err.message);
      setError('Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  // Aufteilung der Einzelfahrten in Aktiv und Vergangen
  const now = new Date();
  const activeSingleTrips = singleTrips.filter(t => new Date(t.departure_time) >= now);
  const pastSingleTrips = singleTrips.filter(t => new Date(t.departure_time) < now);

  const handleDeleteSingle = async (tripId) => {
    if (!window.confirm('Möchten Sie diese Fahrt wirklich absagen?')) return;
    try {
      await api.delete(`/trips/${tripId}`);
      setSingleTrips(prev => prev.filter(t => t.id !== tripId));
    } catch (err) {
      alert('Fehler beim Absagen der Fahrt: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteRecurring = async (masterId) => {
    if (!window.confirm('Möchten Sie diese wiederkehrende Serie und alle zukünftigen Termine wirklich löschen?')) return;
    try {
      await api.delete(`/recurring-trips/${masterId}`);
      setRecurringMasters(prev => prev.filter(r => r.id !== masterId));
      setSingleTrips(prev => prev.filter(t => t.recurring_id !== masterId));
    } catch (err) {
      alert('Fehler beim Löschen der Serie: ' + (err.response?.data?.error || err.message));
    }
  };

  const openEditModal = (item, isRec) => {
    setEditingItem(item);
    setIsEditingRecurring(isRec);
    setEditSeats(item.seats_available || 1);
    
    if (isRec) {
      setEditDepartureTime(item.departure_time.slice(0, 5)); // Nur HH:MM
      setEditEndDate(item.end_date ? item.end_date.split('T')[0] : '');
    } else {
      // Formatierung für datetime-local: YYYY-MM-DDTHH:MM
      const date = new Date(item.departure_time);
      const tzOffset = date.getTimezoneOffset() * 60000; // in ms
      const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 16);
      setEditDepartureTime(localISOTime);
      setEditEndDate('');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');

    try {
      if (isEditingRecurring) {
        // Master-Termin aktualisieren
        await api.put(`/recurring-trips/${editingItem.id}`, {
          departure_time: editDepartureTime,
          seats_available: editingItem.trip_type === 1 ? editSeats : null,
          end_date: editEndDate
        });
      } else {
        // Einzelfahrt aktualisieren
        await api.put(`/trips/${editingItem.id}`, {
          departure_time: new Date(editDepartureTime).toISOString(),
          seats_available: editingItem.trip_type === 1 ? editSeats : null
        });
      }

      setEditingItem(null);
      await fetchData(); // Daten neu laden
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const formatWeekday = (num) => {
    const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    return days[num] || '';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex-grow w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-iosGray-800">Meine Fahrten</h1>
          <p className="text-sm text-iosGray-500">Verwalten Sie Ihre eingetragenen Gesuche und Angebote</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-iosGray-200 mb-6 bg-white rounded-xl p-1 shadow-sm">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'active' 
              ? 'bg-blue-50 text-iosBlue' 
              : 'text-iosGray-500 hover:text-iosBlue hover:bg-iosGray-50'
          }`}
        >
          ⏰ Aktive Termine ({activeSingleTrips.length})
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'recurring' 
              ? 'bg-blue-50 text-iosBlue' 
              : 'text-iosGray-500 hover:text-iosBlue hover:bg-iosGray-50'
          }`}
        >
          🔄 Serien ({recurringMasters.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex-1 py-3 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'past' 
              ? 'bg-blue-50 text-iosBlue' 
              : 'text-iosGray-500 hover:text-iosBlue hover:bg-iosGray-50'
          }`}
        >
          📜 Vergangene ({pastSingleTrips.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-iosBlue"></div>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* TAB 1: AKTIVE EINZELFAHRTEN */}
          {activeTab === 'active' && (
            activeSingleTrips.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-iosGray-200 text-iosGray-500 text-sm">
                Keine aktiven Termine eingetragen.
              </div>
            ) : (
              activeSingleTrips.map(trip => (
                <div key={trip.id} className="bg-white border border-iosGray-200 rounded-2xl p-5 shadow-sm hover:shadow transition-shadow relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      trip.trip_type === 1 ? 'bg-green-50 text-iosGreen' : 'bg-red-50 text-iosRed'
                    }`}>
                      {trip.trip_type === 1 ? '🟢 Bietet Plätze' : '🔴 Sucht Fahrer'}
                    </span>
                    {trip.is_recurring && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-iosBlue rounded-full font-medium">🔄 Aus Serie</span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm text-iosGray-700">
                    <div><b>VON:</b> {trip.start_address}</div>
                    <div><b>NACH:</b> {trip.end_address}</div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 text-xs text-iosGray-500">
                      <span>⏰ <b>Abfahrt:</b> {new Date(trip.departure_time).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      {trip.trip_type === 1 && <span>🪑 <b>Freie Sitze:</b> {trip.seats_available}</span>}
                    </div>
                  </div>

                  <div className="border-t border-iosGray-100 mt-4 pt-3 flex justify-end gap-2">
                    <button
                      onClick={() => openEditModal(trip, false)}
                      className="px-3 py-1.5 border border-iosBlue text-iosBlue rounded-lg text-xs font-semibold hover:bg-blue-50 transition-colors"
                    >
                      ✏️ Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDeleteSingle(trip.id)}
                      className="px-3 py-1.5 border border-iosRed text-iosRed rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors"
                    >
                      🔴 Absagen
                    </button>
                  </div>
                </div>
              ))
            )
          )}

          {/* TAB 2: WIEDERKEHRENDE MASTER-FAHRTEN */}
          {activeTab === 'recurring' && (
            recurringMasters.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-iosGray-200 text-iosGray-500 text-sm">
                Keine wiederkehrenden Serien eingetragen.
              </div>
            ) : (
              recurringMasters.map(master => (
                <div key={master.id} className="bg-white border border-iosGray-200 rounded-2xl p-5 shadow-sm hover:shadow transition-shadow relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      master.trip_type === 1 ? 'bg-green-50 text-iosGreen' : 'bg-red-50 text-iosRed'
                    }`}>
                      {master.trip_type === 1 ? '🟢 Bietet Plätze (Serie)' : '🔴 Sucht Fahrer (Serie)'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-blue-50 text-iosBlue font-bold uppercase">
                      {master.frequency === 'daily' ? '🔄 Täglich' : `🔄 Wöchentlich (${formatWeekday(master.day_of_week)})`}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm text-iosGray-700">
                    <div><b>VON:</b> {master.start_address}</div>
                    <div><b>NACH:</b> {master.end_address}</div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 text-xs text-iosGray-500">
                      <span>⏰ <b>Uhrzeit:</b> {master.departure_time.slice(0, 5)} Uhr</span>
                      {master.trip_type === 1 && <span>🪑 <b>Freie Sitze:</b> {master.seats_available}</span>}
                      <span>📅 <b>Bis:</b> {new Date(master.end_date).toLocaleDateString('de-DE')}</span>
                    </div>
                  </div>

                  <div className="border-t border-iosGray-100 mt-4 pt-3 flex justify-end gap-2">
                    <button
                      onClick={() => openEditModal(master, true)}
                      className="px-3 py-1.5 border border-iosBlue text-iosBlue rounded-lg text-xs font-semibold hover:bg-blue-50 transition-colors"
                    >
                      ✏️ Serie bearbeiten
                    </button>
                    <button
                      onClick={() => handleDeleteRecurring(master.id)}
                      className="px-3 py-1.5 border border-iosRed text-iosRed rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors"
                    >
                      🔴 Serie löschen
                    </button>
                  </div>
                </div>
              ))
            )
          )}

          {/* TAB 3: VERGANGENE EINZELFAHRTEN */}
          {activeTab === 'past' && (
            pastSingleTrips.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-iosGray-200 text-iosGray-500 text-sm">
                Keine vergangenen Fahrten vorhanden.
              </div>
            ) : (
              pastSingleTrips.map(trip => (
                <div key={trip.id} className="bg-white border border-iosGray-100 rounded-2xl p-5 shadow-sm opacity-60">
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-iosGray-200 text-iosGray-500 font-bold uppercase">
                      {trip.trip_type === 1 ? 'Bietet Fahrt' : 'Sucht Fahrt'}
                    </span>
                    <span className="text-[10px] text-iosGray-500 font-medium">Abgeschlossen</span>
                  </div>

                  <div className="space-y-1 text-sm text-iosGray-600">
                    <div><b>VON:</b> {trip.start_address}</div>
                    <div><b>NACH:</b> {trip.end_address}</div>
                    <div className="text-xs text-iosGray-500 mt-2">
                      ⏰ <b>Datum:</b> {new Date(trip.departure_time).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}

      {/* BEARBEITEN MODAL */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-iosGray-200 shadow-2xl p-6 relative overflow-hidden animate-scale-up">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-iosBlue"></div>

            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-iosGray-800">
                {isEditingRecurring ? 'Serie bearbeiten' : 'Fahrt bearbeiten'}
              </h2>
              <button 
                onClick={() => setEditingItem(null)} 
                className="text-iosGray-400 hover:text-iosGray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-iosRed text-iosRed text-xs rounded-r-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              
              {/* Sitze (nur bei Bietet) */}
              {editingItem.trip_type === 1 && (
                <div>
                  <label htmlFor="modal-seats" className="block text-xs font-bold text-iosGray-500 uppercase mb-1">Sitze</label>
                  <select
                    id="modal-seats"
                    value={editSeats}
                    onChange={(e) => setEditSeats(parseInt(e.target.value))}
                    className="w-full min-h-[38px] px-3 py-1.5 border border-iosGray-300 rounded-xl outline-none focus:border-iosBlue text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map(num => (
                      <option key={num} value={num}>{num} Plätze</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Startzeit / Uhrzeit */}
              <div>
                <label htmlFor="modal-time" className="block text-xs font-bold text-iosGray-500 uppercase mb-1">
                  {isEditingRecurring ? 'Abfahrtszeit (HH:MM)' : 'Startzeitpunkt'}
                </label>
                <input
                  id="modal-time"
                  type={isEditingRecurring ? 'time' : 'datetime-local'}
                  value={editDepartureTime}
                  onChange={(e) => setEditDepartureTime(e.target.value)}
                  className="w-full min-h-[38px] px-3 py-1.5 border border-iosGray-300 rounded-xl outline-none focus:border-iosBlue text-sm"
                  required
                />
              </div>

              {/* End-Datum (nur bei Recurring) */}
              {isEditingRecurring && (
                <div>
                  <label htmlFor="modal-enddate" className="block text-xs font-bold text-iosGray-500 uppercase mb-1">Letzter Termin</label>
                  <input
                    id="modal-enddate"
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full min-h-[38px] px-3 py-1.5 border border-iosGray-300 rounded-xl outline-none focus:border-iosBlue text-sm"
                    required
                  />
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2 px-3 border border-iosGray-300 text-iosGray-600 rounded-xl text-sm font-semibold hover:bg-iosGray-100 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 py-2 px-3 bg-iosBlue text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center"
                >
                  {submitLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    'Speichern'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
