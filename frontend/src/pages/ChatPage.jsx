import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { getSocket } from '../services/socket.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ChatPage() {
  const { currentUser } = useAuth();
  const { recipientId } = useParams();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('tripId');
  const navigate = useNavigate();

  const [recipient, setRecipient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputContent, setInputContent] = useState('');
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const parsedRecipientId = parseInt(recipientId);

  // 1. Empfänger-Informationen abrufen
  useEffect(() => {
    const fetchRecipient = async () => {
      try {
        const res = await api.get(`/users/${parsedRecipientId}`);
        setRecipient(res.data);
      } catch (err) {
        console.error('Fehler beim Abrufen des Empfängers:', err.message);
      }
    };
    fetchRecipient();
  }, [parsedRecipientId]);

  // 2. Chat-Verlauf abrufen
  useEffect(() => {
    const fetchChatHistory = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/messages/${currentUser.id}`, {
          params: { otherUserId: parsedRecipientId }
        });
        setMessages(res.data);

        // Gelesen-Status für alle ungelesenen empfangenen Nachrichten anpassen
        res.data.forEach(msg => {
          if (msg.to_user_id === currentUser.id && !msg.is_read) {
            api.put(`/messages/${msg.id}/read`);
          }
        });
      } catch (err) {
        console.error('Fehler beim Laden des Chat-Verlaufs:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChatHistory();
  }, [currentUser.id, parsedRecipientId]);

  // 3. Socket-Verbindung & Events
  useEffect(() => {
    const socket = getSocket();

    if (!socket.connected) {
      socket.connect();
    }

    // Socket-Login erneut auslösen zur Sicherheit
    socket.emit('user-login', currentUser.id);

    // Neue Nachricht empfangen
    const handleNewMessage = (msg) => {
      if (
        (msg.from_user_id === parsedRecipientId && msg.to_user_id === currentUser.id) ||
        (msg.from_user_id === currentUser.id && msg.to_user_id === parsedRecipientId)
      ) {
        setMessages(prev => [...prev, msg]);

        // Als gelesen markieren
        if (msg.to_user_id === currentUser.id) {
          api.put(`/messages/${msg.id}/read`);
          socket.emit('message-read', { message_id: msg.id });
        }
      }
    };

    // Nachricht erfolgreich gesendet (Bestätigung vom Server)
    const handleMessageSent = (msg) => {
      setMessages(prev => {
        // Dublettenvermeidung falls REST oder Socket sich überschneiden
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    // Tipp-Indikatoren empfangen
    const handleUserTyping = ({ from_user_id }) => {
      if (from_user_id === parsedRecipientId) {
        setIsRecipientTyping(true);
      }
    };

    const handleUserStoppedTyping = ({ from_user_id }) => {
      if (from_user_id === parsedRecipientId) {
        setIsRecipientTyping(false);
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-sent', handleMessageSent);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stopped-typing', handleUserStoppedTyping);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('message-sent', handleMessageSent);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stopped-typing', handleUserStoppedTyping);
    };
  }, [currentUser.id, parsedRecipientId]);

  // 4. Scrollen zum Ende bei neuen Nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecipientTyping]);

  // 5. Tipp-Status an Server melden (mit Debounce)
  const handleInputChange = (e) => {
    setInputContent(e.target.value);
    
    const socket = getSocket();
    socket.emit('typing', { from_user_id: currentUser.id, to_user_id: parsedRecipientId });

    // Vorherigen Timeout zurücksetzen
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Nach 2 Sekunden Inaktivität das Tippen beenden
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { from_user_id: currentUser.id, to_user_id: parsedRecipientId });
    }, 2000);
  };

  // 6. Nachricht absenden
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputContent.trim()) return;

    const socket = getSocket();
    
    // Tippen sofort beenden
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('stop-typing', { from_user_id: currentUser.id, to_user_id: parsedRecipientId });

    // Nachricht über WebSocket absenden
    socket.emit('send-message', {
      from_user_id: currentUser.id,
      to_user_id: parsedRecipientId,
      trip_id: tripId ? parseInt(tripId) : null,
      content: inputContent.trim()
    });

    setInputContent('');
  };

  return (
    <div className="flex-grow flex flex-col h-[calc(100vh-4rem)] bg-iosGray-100">
      
      {/* Header */}
      <div className="bg-white border-b border-iosGray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-iosBlue hover:bg-iosGray-100 p-2 rounded-xl text-base transition-colors"
          >
            ← Zurück
          </button>
          <div>
            <h2 className="text-sm font-bold text-iosGray-800">
              Chat mit {recipient ? recipient.name : 'Lädt...'}
            </h2>
            {recipient && (
              <a href={`tel:${recipient.phone}`} className="text-xs text-iosBlue hover:underline">
                📞 {recipient.phone}
              </a>
            )}
          </div>
        </div>
        {tripId && (
          <span className="text-[10px] font-bold bg-blue-50 text-iosBlue px-2.5 py-1 rounded-full uppercase">
            Fahrt-ID: {tripId}
          </span>
        )}
      </div>

      {/* Chat Messages Area */}
      <div className="flex-grow overflow-y-auto p-6 space-y-4 shadow-inner">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-iosBlue"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-iosGray-500 text-sm py-12">
            Keine Nachrichten vorhanden. Schreiben Sie eine Nachricht, um das Gespräch zu beginnen!
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.from_user_id === currentUser.id;
            return (
              <div 
                key={msg.id || index} 
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm relative ${
                  isMe 
                    ? 'bg-iosBlue text-white rounded-tr-none' 
                    : 'bg-white text-iosGray-800 border border-iosGray-200 rounded-tl-none'
                }`}>
                  <p>{msg.content}</p>
                  <span className={`block text-[9px] mt-1 text-right ${
                    isMe ? 'text-blue-100' : 'text-iosGray-500'
                  }`}>
                    {new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    {isMe && (msg.is_read ? ' ✓✓' : ' ✓')}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Tipp-Indikator */}
        {isRecipientTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-white border border-iosGray-200 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5 shadow-sm">
              <span className="text-xs text-iosGray-500 font-medium">Schreibt</span>
              <span className="w-1.5 h-1.5 bg-iosGray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-iosGray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-iosGray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="bg-white border-t border-iosGray-200 p-4 sticky bottom-0 z-10 shadow-lg">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            placeholder="Nachricht schreiben..."
            value={inputContent}
            onChange={handleInputChange}
            className="flex-grow min-h-[44px] px-4 py-2 border border-iosGray-300 rounded-2xl text-base outline-none focus:border-iosBlue focus:ring-2 focus:ring-blue-100 transition-all"
            required
            autoComplete="off"
          />
          <button
            type="submit"
            className="px-5 bg-iosBlue text-white font-bold rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center shadow-md shadow-blue-100"
          >
            Senden
          </button>
        </form>
      </div>
    </div>
  );
}
