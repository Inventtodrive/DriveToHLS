-- Database schema for Carpool App

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_phone ON users(phone);

CREATE TABLE recurring_trips (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_address VARCHAR(255) NOT NULL,
  start_lat DECIMAL(10, 8) NOT NULL,
  start_lng DECIMAL(11, 8) NOT NULL,
  end_address VARCHAR(255) NOT NULL,
  end_lat DECIMAL(10, 8) NOT NULL,
  end_lng DECIMAL(11, 8) NOT NULL,
  departure_time TIME NOT NULL, -- z.B. 08:00
  trip_type SMALLINT NOT NULL, -- 0=sucht Fahrer, 1=bietet Plätze
  seats_available INTEGER,
  frequency VARCHAR(20) NOT NULL, -- 'daily' oder 'weekly'
  day_of_week SMALLINT, -- 0=Montag, 6=Sonntag (nur für weekly)
  end_date DATE, -- Wann endet die Wiederholung
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_recurring_user ON recurring_trips(user_id);

CREATE TABLE trips (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_address VARCHAR(255) NOT NULL,
  start_lat DECIMAL(10, 8) NOT NULL,
  start_lng DECIMAL(11, 8) NOT NULL,
  end_address VARCHAR(255) NOT NULL,
  end_lat DECIMAL(10, 8) NOT NULL,
  end_lng DECIMAL(11, 8) NOT NULL,
  departure_time TIMESTAMP NOT NULL,
  trip_type SMALLINT NOT NULL, -- 0=sucht Fahrer (🔴), 1=bietet Plätze (🟢)
  seats_available INTEGER, -- NULL wenn trip_type=0
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_id INTEGER REFERENCES recurring_trips(id) ON DELETE CASCADE, -- Verweis auf Master-Trip
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trips_departure ON trips(departure_time);
CREATE INDEX idx_trips_user ON trips(user_id);
CREATE INDEX idx_trips_coords ON trips(start_lat, start_lng);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL, -- Optional: Zu welcher Fahrt der Chat gehört
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_messages_to_user ON messages(to_user_id);
CREATE INDEX idx_messages_from_user ON messages(from_user_id);
CREATE INDEX idx_messages_created ON messages(created_at);
