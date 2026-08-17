import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!currentUser) return null;

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { name: '🗺️ Karte', path: '/' },
    { name: '➕ Neue Fahrt', path: '/new-trip' },
    { name: '🚗 Meine Fahrten', path: '/my-trips' },
    { name: '👤 Profil', path: '/profile' }
  ];

  return (
    <header className="bg-white border-b border-iosGray-200 sticky top-0 z-[1000] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo / Title */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-xl font-bold text-iosBlue flex items-center gap-2">
              <span className="text-2xl">🚗</span>
              <span className="hidden sm:inline font-bold">DriveToHLS</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-blue-50 text-iosBlue'
                    : 'text-iosGray-500 hover:text-iosBlue hover:bg-iosGray-100'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Profile & Logout */}
          <div className="hidden md:flex items-center gap-4">
            <span className="text-sm text-iosGray-800">
              Hallo, <span className="font-semibold">{currentUser.name}</span>
            </span>
            <button
              onClick={logout}
              className="px-3 py-1.5 border border-iosRed text-iosRed rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Abmelden
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-iosGray-500 p-2 rounded-md hover:bg-iosGray-100 focus:outline-none"
              aria-label="Hauptmenü öffnen"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-iosGray-200 px-2 pt-2 pb-4 space-y-1 shadow-inner animate-fade-in">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-50 text-iosBlue'
                  : 'text-iosGray-500 hover:text-iosBlue hover:bg-iosGray-100'
              }`}
            >
              {item.name}
            </Link>
          ))}
          <div className="border-t border-iosGray-200 mt-4 pt-4 px-4 flex items-center justify-between">
            <span className="text-sm font-medium text-iosGray-800">{currentUser.name}</span>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="px-4 py-2 border border-iosRed text-iosRed rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
