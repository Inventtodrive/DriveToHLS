import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProfilePage() {
  const { currentUser, updateProfileName } = useAuth();
  
  const [name, setName] = useState(currentUser ? currentUser.name : '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' }); // type: 'success' | 'error'

  const validateName = (n) => {
    return /^[a-zA-Z0-9äöüßÄÖÜ\s\-]{2,100}$/.test(n);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    setLoading(true);

    if (!validateName(name)) {
      setMessage({
        text: 'Bitte geben Sie einen gültigen Namen ein (2-100 Zeichen, keine Sonderzeichen).',
        type: 'error'
      });
      setLoading(false);
      return;
    }

    if (name.trim() === currentUser.name) {
      setMessage({ text: 'Name ist bereits auf dem aktuellen Stand.', type: 'success' });
      setLoading(false);
      return;
    }

    const res = await updateProfileName(name.trim());
    if (res.success) {
      setMessage({ text: 'Name erfolgreich aktualisiert!', type: 'success' });
    } else {
      setMessage({ text: res.error, type: 'error' });
    }
    setLoading(false);
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-md mx-auto px-4 py-12 flex-grow flex items-center justify-center">
      <div className="w-full bg-white border border-iosGray-200 rounded-2xl shadow-xl p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-iosBlue"></div>

        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-blue-50 text-iosBlue rounded-full flex items-center justify-center text-3xl mx-auto mb-3 border border-blue-100 font-bold">
            {currentUser.name.slice(0, 2).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-iosGray-800">{currentUser.name}</h2>
          <p className="text-xs text-iosGray-500 mt-1">Mitglied seit: {new Date(currentUser.created_at || Date.now()).toLocaleDateString('de-DE')}</p>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-xl text-xs flex gap-2 border-l-4 ${
            message.type === 'success'
              ? 'bg-green-50 border-iosGreen text-iosGreen'
              : 'bg-red-50 border-iosRed text-iosRed'
          }`}>
            <span>{message.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-xs font-bold text-iosGray-500 uppercase mb-1">
              Telefonnummer (nicht änderbar)
            </label>
            <input
              id="phone"
              type="text"
              value={currentUser.phone}
              disabled
              className="w-full min-h-[40px] px-3 py-2 bg-iosGray-100 border border-iosGray-200 text-iosGray-500 rounded-xl outline-none text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-xs font-bold text-iosGray-500 uppercase mb-1">
              Name bearbeiten
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Max Mustermann"
              className="w-full min-h-[44px] px-4 py-2 border border-iosGray-300 rounded-xl text-base outline-none focus:border-iosBlue focus:ring-2 focus:ring-blue-100 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] bg-iosBlue text-white font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center shadow-lg shadow-blue-100"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              'Name aktualisieren'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
