import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login, register, currentUser } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Falls der Benutzer bereits eingeloggt ist, direkt weiterleiten
  React.useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const validatePhone = (p) => {
    return /^\+?[0-9]{7,20}$/.test(p);
  };

  const validateName = (n) => {
    return /^[a-zA-Z0-9äöüßÄÖÜ\s\-]{2,100}$/.test(n);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!validatePhone(phone)) {
      setError('Bitte geben Sie eine gültige Telefonnummer ein (7-20 Ziffern, optional + am Anfang).');
      setLoading(false);
      return;
    }

    if (isRegisterMode) {
      if (!validateName(name)) {
        setError('Bitte geben Sie einen gültigen Namen ein (2-100 Zeichen, keine Sonderzeichen).');
        setLoading(false);
        return;
      }

      const res = await register(phone, name);
      if (res.success) {
        navigate('/');
      } else {
        setError(res.error);
      }
    } else {
      const res = await login(phone);
      if (res.success) {
        navigate('/');
      } else {
        // Falls Benutzer nicht gefunden wurde, in den Registrierungsmodus wechseln
        if (res.error.includes('nicht gefunden')) {
          setIsRegisterMode(true);
          setError('Diese Telefonnummer ist noch nicht registriert. Bitte geben Sie Ihren Namen ein, um sich anzumelden.');
        } else {
          setError(res.error);
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="w-full max-w-md bg-white border border-iosGray-200 rounded-2xl shadow-xl p-8 relative overflow-hidden">
        
        {/* Dekorative Elemente */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-iosBlue"></div>

        <div className="text-center mb-8">
          <span className="text-5xl inline-block mb-3 animate-bounce">🚗</span>
          <h2 className="text-2xl font-bold text-iosGray-800">DriveToHLS</h2>
          <p className="text-iosGray-500 text-sm mt-1">Fahrten teilen, Geld sparen, CO2 reduzieren</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-iosRed rounded-r-xl text-iosRed text-sm flex gap-2">
            <span className="font-bold">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="phone" className="block text-sm font-semibold text-iosGray-800 mb-1">
              Telefonnummer
            </label>
            <input
              id="phone"
              type="tel"
              disabled={isRegisterMode}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
              placeholder="+491761234567"
              className={`w-full min-h-[44px] px-4 py-2 border rounded-xl text-base outline-none transition-all ${
                isRegisterMode 
                  ? 'bg-iosGray-100 text-iosGray-500 border-iosGray-200' 
                  : 'border-iosGray-300 focus:border-iosBlue focus:ring-2 focus:ring-blue-100'
              }`}
              required
            />
          </div>

          {isRegisterMode && (
            <div className="animate-fade-in">
              <label htmlFor="name" className="block text-sm font-semibold text-iosGray-800 mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Max Mustermann"
                className="w-full min-h-[44px] px-4 py-2 border border-iosGray-300 rounded-xl text-base outline-none focus:border-iosBlue focus:ring-2 focus:ring-blue-100 transition-all"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] bg-iosBlue text-white font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center shadow-md shadow-blue-200"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : isRegisterMode ? (
              'Registrieren & Einloggen'
            ) : (
              'Anmelden'
            )}
          </button>
        </form>

        {isRegisterMode && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegisterMode(false);
                setError('');
                setName('');
              }}
              className="text-sm text-iosBlue hover:underline font-medium"
            >
              Mit einer anderen Nummer anmelden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
