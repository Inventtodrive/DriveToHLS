import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Header from './components/Header.jsx';

// Pages Imports
import LoginPage from './pages/LoginPage.jsx';
import MapPage from './pages/MapPage.jsx';
import NewTripPage from './pages/NewTripPage.jsx';
import MyTripsPage from './pages/MyTripsPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

// 404 Seite
function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-iosGray-100">
      <span className="text-6xl mb-4">🔍</span>
      <h1 className="text-2xl font-bold text-iosGray-800 mb-2">Seite nicht gefunden</h1>
      <p className="text-iosGray-500 mb-6 text-center max-w-sm">
        Die von Ihnen gesuchte Seite existiert nicht oder Sie haben nicht die erforderlichen Rechte.
      </p>
      <a href="/" className="px-6 py-3 bg-iosBlue text-white rounded-xl font-medium shadow hover:opacity-90 transition-opacity">
        Zurück zur Karte
      </a>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex flex-col min-h-screen bg-iosGray-100">
          <Header />
          <main className="flex-grow flex flex-col">
            <Routes>
              {/* Öffentliche Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Geschützte Routen */}
              <Route path="/" element={
                <ProtectedRoute>
                  <MapPage />
                </ProtectedRoute>
              } />
              
              <Route path="/new-trip" element={
                <ProtectedRoute>
                  <NewTripPage />
                </ProtectedRoute>
              } />

              <Route path="/my-trips" element={
                <ProtectedRoute>
                  <MyTripsPage />
                </ProtectedRoute>
              } />

              <Route path="/chat/:recipientId" element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              } />

              <Route path="/profile" element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />

              {/* 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
