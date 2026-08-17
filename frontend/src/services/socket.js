import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    const apiURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    socket = io(apiURL, {
      autoConnect: false,
      reconnection: true, // Automatische Wiederverbindung bei Unterbruch
      reconnectionAttempts: 15,
      reconnectionDelay: 2000
    });

    socket.on('connect', () => {
      console.log('WebSocket-Verbindung erfolgreich hergestellt.');
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket-Verbindung getrennt:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket Verbindungsfehler:', error.message);
    });
  }
  return socket;
};
