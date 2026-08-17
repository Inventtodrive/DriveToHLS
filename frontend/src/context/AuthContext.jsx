import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api.js';
import { getSocket } from '../services/socket.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Sync WebSocket Login-Status
  useEffect(() => {
    const socket = getSocket();
    if (currentUser && token) {
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit('user-login', currentUser.id);
    } else {
      if (socket.connected) {
        socket.emit('user-logout');
        socket.disconnect();
      }
    }
  }, [currentUser, token]);

  // Auf Startup: Benutzerprofil aus DB abfragen, falls Token existiert
  useEffect(() => {
    const initializeAuth = async () => {
      const storedUser = localStorage.getItem('user');
      if (token && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          // Profil aktualisieren
          const res = await api.get(`/users/${parsedUser.id}`);
          setCurrentUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        } catch (err) {
          console.error('Fehler bei der Re-Authentifizierung:', err.message);
          // Bei 401 oder 403 ausloggen
          if (err.response?.status === 401 || err.response?.status === 403) {
            logout();
          }
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, [token]);

  const login = async (phone) => {
    try {
      const res = await api.post('/auth/login', { phone });
      const { id, name, phone: userPhone, token: userToken } = res.data;
      
      setToken(userToken);
      setCurrentUser({ id, name, phone: userPhone });
      localStorage.setItem('token', userToken);
      localStorage.setItem('user', JSON.stringify({ id, name, phone: userPhone }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Fehler beim Login.' };
    }
  };

  const register = async (phone, name) => {
    try {
      const res = await api.post('/auth/register', { phone, name });
      const { id, name: userName, phone: userPhone, token: userToken } = res.data;

      setToken(userToken);
      setCurrentUser({ id, name: userName, phone: userPhone });
      localStorage.setItem('token', userToken);
      localStorage.setItem('user', JSON.stringify({ id, name: userName, phone: userPhone }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Fehler bei der Registrierung.' };
    }
  };

  const logout = () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('user-logout');
      socket.disconnect();
    }
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateProfileName = async (newName) => {
    if (!currentUser) return { success: false, error: 'Kein Benutzer angemeldet.' };
    try {
      const res = await api.put(`/users/${currentUser.id}`, { name: newName });
      setCurrentUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Fehler beim Aktualisieren des Namens.' };
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, token, loading, login, register, logout, updateProfileName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden.');
  }
  return context;
};
