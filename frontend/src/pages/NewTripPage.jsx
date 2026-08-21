import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function NewTripPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    startQuery: '',
    endQuery: '',
    departureTime: '',
    tripType: 1, // 1 = Bietet, 0 = Sucht
    seats: 3,
    isRecurring: false,
    frequency: 'daily',
    dayOfWeek: 0, // 0 = Montag
    endDate: ''
  });

  // Koordinaten-States
  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);

  // Auto-complete Vorschläge
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [startLoading, setStartLoading] = useState(false);
  const [endLoading, setEndLoading] = useState(false);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Debounce für Start-Adresse
  useEffect(() => {
    if (formData.startQuery.length < 3) {
      setStartSuggestions([]);
      return;
    }
    // Wenn die aktuelle Suche mit einer ausgewählten Koordinate übereinstimmt, keine Suche starten
    if (startCoords && startCoords.label === formData.startQuery) return;

    setStartLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/geocode', { params: { address: formData.startQuery } });
        if (res.data.suggestions) {
          setStartSuggestions(res.data.suggestions);
        }
      } catch (err) {
        console.error('Fehler bei Start-Geocoding:', err.message);
      } finally {
        setStartLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [formData.startQuery, startCoords]);

  // Debounce für End-Adresse
  useEffect(() => {
    if (formData.endQuery.length < 3) {
      setEndSuggestions([]);
      return;
    }
    if (endCoords && endCoords.label === formData.endQuery) return;

    setEndLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/geocode', { params: { address: formData.endQuery } });
        if (res.data.suggestions) {
          setEndSuggestions(res.data.suggestions);
        }
      } catch (err) {
        console.error('Fehler bei End-Geocoding:', err.message);
      } finally {
        setEndLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [formData.endQuery, endCoords]);

  const createManualCoords = (address) => ({
    label: address,
    lat: null, // Backend kann später geocoden
    lng: null
  });

  const validateForm = () => {
    const newErrors = {};

    if (!startCoords && formData.startQuery.trim().length < 3) {
      newErrors.start = 'Bitte geben Sie mindestens 3 Zeichen ein oder wählen Sie aus den Vorschlägen aus.';
    }
    if (!endCoords && formData.endQuery.trim().length < 3) {
      newErrors.end = 'Bitte geben Sie mindestens 3 Zeichen ein oder wählen Sie aus den Vorschlägen aus.';
    }
    if (!formData.departureTime) {
      newErrors.departureTime = 'Abfahrtszeit ist erforderlich.';
    } else {
      const depDate = new Date(formData.departureTime);
      if (depDate <= new Date()) {
        newErrors.departureTime = 'Die Abfahrtszeit muss in der Zukunft liegen.';
      }
    }

    if (formData.isRecurring) {
      if (!formData.endDate) {
        newErrors.endDate = 'Enddatum für die Wiederholung ist erforderlich.';
      } else {
        const start = new Date(formData.departureTime);
        const end = new Date(formData.endDate);
        if (end <= start) {
          newErrors.endDate = 'Das Enddatum muss nach dem Abfahrtsdatum liegen.';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    // Wenn Coords nicht gesetzt sind, verwende freie Texteingabe als Fallback
    const finalStartCoords = startCoords || createManualCoords(formData.startQuery);
    const finalEndCoords = endCoords || createManualCoords(formData.endQuery);
    try {
      if (formData.isRecurring) {
        // Wiederkehrende Fahrt anlegen
        await api.post('/recurring-trips', {
          user_id: currentUser.id,
          start_address: finalStartCoords.label,
          start_lat: finalStartCoords.lat,
          start_lng: finalStartCoords.lng,
          end_address: finalEndCoords.label,
          end_lat: finalEndCoords.lat,
          end_lng: finalEndCoords.lng,
          departure_time: formData.departureTime.split('T')[1], // Nur HH:MM für Master
          trip_type: formData.tripType,
          seats_available: formData.tripType === 1 ? formData.seats : null,
          frequency: formData.frequency,
          day_of_week: formData.frequency === 'weekly' ? formData.dayOfWeek : null,
          end_date: formData.endDate
        });
      } else {
        // Einzelfahrt anlegen
        await api.post('/trips', {
          user_id: currentUser.id,
          start_address: finalStartCoords.label,
          start_lat: finalStartCoords.lat,
          start_lng: finalStartCoords.lng,
          end_address: finalEndCoords.label,
          end_lat: finalEndCoords.lat,
          end_lng: finalEndCoords.lng,
          departure_time: new Date(formData.departureTime).toISOString(),
          trip_type: formData.tripType,
          seats_available: formData.tripType === 1 ? formData.seats : null
        });
      }

      navigate('/');
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  const weekdays = [
    { label: 'Montag', value: 0 },
    { label: 'Dienstag', value: 1 },
    { label: 'Mittwoch', value: 2 },
    { label: 'Donnerstag', value: 3 },
    { label: 'Freitag', value: 4 },
    { label: 'Samstag', value: 5 },
    { label: 'Sonntag', value: 6 }
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex-grow flex items-center justify-center">
      <div className="w-full bg-white border border-iosGray-200 rounded-2xl shadow-xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-iosBlue"></div>

        <h2 className="text-2xl font-bold text-iosGray-800 mb-6 flex items-center gap-2">
          <span>➕ Fahrt eintragen</span>
        </h2>

        {errors.submit && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-iosRed rounded-r-xl text-iosRed text-sm">
            <b>Fehler:</b> {errors.submit}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* START-ADRESSE */}
          <div className="relative">
            <label className="block text-sm font-semibold text-iosGray-800 mb-1">Von (Startadresse)</label>
            <div className="relative">
              <input
                type="text"
                placeholder="z.B. Stuttgart Hauptbahnhof"
                value={formData.startQuery}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, startQuery: e.target.value }));
                  if (startCoords) setStartCoords(null);
                }}
                className={`w-full min-h-[44px] pl-10 pr-4 py-2 border rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-100 ${
                  startCoords ? 'border-iosGreen focus:border-iosGreen' : 'border-iosGray-300 focus:border-iosBlue'
                }`}
                required
              />
              <span className="absolute left-3 top-2.5 text-base">📍</span>
              {startCoords && <span className="absolute right-3 top-2.5 text-iosGreen text-sm">✓</span>}
            </div>

            {startLoading && (
              <div className="absolute right-10 top-9">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-iosBlue border-t-transparent"></div>
              </div>
            )}

            {startSuggestions.length > 0 && (
              <div className="absolute z-[2000] left-0 right-0 mt-1 bg-white border border-iosGray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {startSuggestions.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setStartCoords(s);
                      setFormData(prev => ({ ...prev, startQuery: s.label }));
                      setStartSuggestions([]);
                    }}
                    className="p-3 text-sm text-iosGray-700 hover:bg-iosGray-100 cursor-pointer border-b border-iosGray-100 last:border-0"
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            )}

            {/* Fallback-Button: Freie Texteingabe verwenden */}
            {!startCoords &&
             formData.startQuery.trim().length >= 3 &&
             startSuggestions.length === 0 &&
             !startLoading && (
              <div className="absolute z-[2000] left-0 right-0 mt-1 bg-white border border-iosGray-200 rounded-xl shadow-lg p-2">
                <button
                  type="button"
                  onClick={() => {
                    setStartCoords(createManualCoords(formData.startQuery));
                    setStartSuggestions([]);
                  }}
                  className="w-full p-3 text-sm text-iosBlue hover:bg-blue-50 cursor-pointer rounded-lg font-medium text-left"
                >
                  💡 &quot;{formData.startQuery}&quot; verwenden
                </button>
              </div>
            )}
            {errors.start && <p className="text-xs text-iosRed mt-1 font-medium">{errors.start}</p>}
          </div>

          {/* ZIEL-ADRESSE */}
          <div className="relative">
            <label className="block text-sm font-semibold text-iosGray-800 mb-1">Nach (Zieladresse)</label>
            <div className="relative">
              <input
                type="text"
                placeholder="z.B. Stuttgart Flughafen"
                value={formData.endQuery}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, endQuery: e.target.value }));
                  if (endCoords) setEndCoords(null);
                }}
                className={`w-full min-h-[44px] pl-10 pr-4 py-2 border rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-100 ${
                  endCoords ? 'border-iosGreen focus:border-iosGreen' : 'border-iosGray-300 focus:border-iosBlue'
                }`}
                required
              />
              <span className="absolute left-3 top-2.5 text-base">🎯</span>
              {endCoords && <span className="absolute right-3 top-2.5 text-iosGreen text-sm">✓</span>}
            </div>

            {endLoading && (
              <div className="absolute right-10 top-9">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-iosBlue border-t-transparent"></div>
              </div>
            )}

            {endSuggestions.length > 0 && (
              <div className="absolute z-[2000] left-0 right-0 mt-1 bg-white border border-iosGray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {endSuggestions.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setEndCoords(s);
                      setFormData(prev => ({ ...prev, endQuery: s.label }));
                      setEndSuggestions([]);
                    }}
                    className="p-3 text-sm text-iosGray-700 hover:bg-iosGray-100 cursor-pointer border-b border-iosGray-100 last:border-0"
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            )}

            {/* Fallback-Button: Freie Texteingabe verwenden */}
            {!endCoords &&
             formData.endQuery.trim().length >= 3 &&
             endSuggestions.length === 0 &&
             !endLoading && (
              <div className="absolute z-[2000] left-0 right-0 mt-1 bg-white border border-iosGray-200 rounded-xl shadow-lg p-2">
                <button
                  type="button"
                  onClick={() => {
                    setEndCoords(createManualCoords(formData.endQuery));
                    setEndSuggestions([]);
                  }}
                  className="w-full p-3 text-sm text-iosBlue hover:bg-blue-50 cursor-pointer rounded-lg font-medium text-left"
                >
                  💡 &quot;{formData.endQuery}&quot; verwenden
                </button>
              </div>
            )}
            {errors.end && <p className="text-xs text-iosRed mt-1 font-medium">{errors.end}</p>}
          </div>

          {/* FAHRTTYP & SITZE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-iosGray-800 mb-2">Fahrttyp</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tripType: 1 }))}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all border ${
                    formData.tripType === 1
                      ? 'border-iosGreen bg-green-50 text-iosGreen shadow-sm shadow-green-100'
                      : 'border-iosGray-300 text-iosGray-500 hover:bg-iosGray-100'
                  }`}
                >
                  🟢 Biete Fahrt an
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tripType: 0 }))}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all border ${
                    formData.tripType === 0
                      ? 'border-iosRed bg-red-50 text-iosRed shadow-sm shadow-red-100'
                      : 'border-iosGray-300 text-iosGray-500 hover:bg-iosGray-100'
                  }`}
                >
                  🔴 Suche Fahrer
                </button>
              </div>
            </div>

            {formData.tripType === 1 && (
              <div className="animate-fade-in">
                <label htmlFor="seats" className="block text-sm font-semibold text-iosGray-800 mb-2">
                  Freie Sitzplätze
                </label>
                <select
                  id="seats"
                  value={formData.seats}
                  onChange={(e) => setFormData(prev => ({ ...prev, seats: parseInt(e.target.value) }))}
                  className="w-full min-h-[44px] px-3 py-2 border border-iosGray-300 rounded-xl text-base outline-none focus:border-iosBlue"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(num => (
                    <option key={num} value={num}>{num} {num === 1 ? 'Sitzplatz' : 'Sitzplätze'}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ABFAHRTSZEIT */}
          <div>
            <label htmlFor="departureTime" className="block text-sm font-semibold text-iosGray-800 mb-1">
              Startzeitpunkt
            </label>
            <input
              id="departureTime"
              type="datetime-local"
              value={formData.departureTime}
              onChange={(e) => setFormData(prev => ({ ...prev, departureTime: e.target.value }))}
              className="w-full min-h-[44px] px-4 py-2 border border-iosGray-300 rounded-xl text-base outline-none focus:border-iosBlue transition-all"
              required
            />
            {errors.departureTime && <p className="text-xs text-iosRed mt-1 font-medium">{errors.departureTime}</p>}
          </div>

          {/* WIEDERKEHRENDE FAHRTEN */}
          <div className="border-t border-iosGray-200 pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <input
                id="isRecurring"
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                className="h-5 w-5 text-iosBlue border-iosGray-300 rounded focus:ring-iosBlue"
              />
              <label htmlFor="isRecurring" className="text-sm font-bold text-iosGray-800 cursor-pointer select-none">
                🔄 Wiederkehrende Fahrt erstellen
              </label>
            </div>

            {formData.isRecurring && (
              <div className="space-y-4 p-4 bg-iosGray-100 rounded-2xl border border-iosGray-200 animate-fade-in">
                
                {/* Häufigkeit */}
                <div>
                  <label className="block text-xs font-bold text-iosGray-500 uppercase mb-2">Häufigkeit</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, frequency: 'daily' }))}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                        formData.frequency === 'daily' ? 'bg-white shadow text-iosBlue' : 'text-iosGray-500 hover:bg-iosGray-200'
                      }`}
                    >
                      Täglich
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, frequency: 'weekly' }))}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                        formData.frequency === 'weekly' ? 'bg-white shadow text-iosBlue' : 'text-iosGray-500 hover:bg-iosGray-200'
                      }`}
                    >
                      Wöchentlich
                    </button>
                  </div>
                </div>

                {/* Wöchentlich - Wochentag auswählen */}
                {formData.frequency === 'weekly' && (
                  <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-iosGray-500 uppercase mb-2">Wochentag</label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                      {weekdays.map(d => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, dayOfWeek: d.value }))}
                          className={`py-1.5 text-xs font-semibold rounded ${
                            formData.dayOfWeek === d.value ? 'bg-iosBlue text-white shadow' : 'bg-white text-iosGray-600 hover:bg-iosGray-200 border border-iosGray-200'
                          }`}
                        >
                          {d.label.slice(0, 2)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Enddatum */}
                <div>
                  <label htmlFor="endDate" className="block text-xs font-bold text-iosGray-500 uppercase mb-1">
                    Letzter Termin am
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full min-h-[38px] px-3 py-1.5 border border-iosGray-300 rounded-xl text-sm outline-none focus:border-iosBlue bg-white"
                    required={formData.isRecurring}
                  />
                  {errors.endDate && <p className="text-xs text-iosRed mt-1 font-medium">{errors.endDate}</p>}
                </div>
              </div>
            )}
          </div>

          {/* SPEICHERN */}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] bg-iosBlue text-white font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center shadow-lg shadow-blue-100"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              'Fahrt veröffentlichen'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
