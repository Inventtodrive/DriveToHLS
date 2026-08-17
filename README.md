# 🚗 DriveToHLS

Willkommen zu DriveToHLS! Diese App ermöglicht es Benutzern, Fahrten (Gesuche und Angebote) einzutragen, auf einer Karte zu betrachten, Routen anzuzeigen und in Echtzeit miteinander zu chatten.

Das Projekt besteht aus:
- **Backend**: Node.js, Express, Socket.io und PostgreSQL (gehostet auf Oracle Cloud).
- **Frontend**: React (Vite), Tailwind CSS, Leaflet-Karten und Socket.io-Client (gehostet auf Vercel).

---

## 📋 Inhaltsverzeichnis
1. [Voraussetzungen](#voraussetzungen)
2. [Lokales Setup & Installation](#lokales-setup--installation)
3. [Datenbank-Installation](#datenbank-installation)
4. [API-Dokumentation](#api-dokumentation)
5. [WebSocket-Events](#websocket-events)
6. [Deployment-Anleitung](#deployment-anleitung)
7. [Fehlerbehebung (Troubleshooting)](#fehlerbehebung-troubleshooting)

---

## 🔧 Voraussetzungen
- **Node.js**: Version 18+ (empfohlen v18.18.0+)
- **NPM**: Version 9+
- **PostgreSQL**: Version 15+ (z.B. auf deinem Oracle Cloud Server)

---

## 💻 Lokales Setup & Installation

### 1. Repository klonen & Struktur
Das Projekt ist in zwei Ordner aufgeteilt:
- `backend/`
- `frontend/`

### 2. Backend einrichten
1. Wechsle in den Backend-Ordner:
   ```bash
   cd backend
   ```
2. Installiere die Abhängigkeiten:
   ```bash
   npm install
   ```
3. Kopiere die Umgebungsvariablen und passe sie an:
   ```bash
   cp .env.example .env
   ```
   Öffne die `.env`-Datei und trage deine PostgreSQL-Verbindungsdaten ein:
   ```env
   DATABASE_URL=postgresql://user:password@dein-oracle-server-ip:5432/carpooldb
   PORT=3001
   FRONTEND_URL=http://localhost:5173
   NODE_ENV=development
   ```
4. Starte den Server im Entwicklungsmodus:
   ```bash
   npm run dev
   ```

### 3. Frontend einrichten
1. Wechsle in den Frontend-Ordner:
   ```bash
   cd ../frontend
   ```
2. Installiere die Abhängigkeiten:
   ```bash
   npm install
   ```
3. Starte den Vite-Entwicklungsserver:
   ```bash
   npm run dev
   ```
4. Öffne im Browser: `http://localhost:5173`

---

## 🗄️ Datenbank-Installation

Um die Tabellen auf deinem Oracle-Server (PostgreSQL) anzulegen, verbinde dich mit deiner Datenbank und führe die SQL-Befehle aus der Datei `backend/schema.sql` aus:

```bash
psql -h dein-oracle-server-ip -U postgres -d carpooldb -f backend/schema.sql
```

Das Schema erstellt folgende Tabellen:
1. `users`: Speichert Benutzername und Telefonnummer (wichtig: Login erfolgt passwortlos über die Telefonnummer).
2. `recurring_trips`: Speichert die Master-Konfiguration für wiederkehrende Fahrten.
3. `trips`: Enthält alle Einzeltermine. Instanzen wiederkehrender Fahrten verweisen per `recurring_id` auf die Master-Fahrt und werden bei Löschen der Serie per `ON DELETE CASCADE` mitgelöscht.
4. `messages`: Speichert alle Chat-Nachrichten inklusive Gelesen-Status (`is_read`).

---

## 🔌 API-Dokumentation

### 1. Authentifizierung
- **POST `/api/auth/register`**
  - **Beschreibung**: Registriert einen neuen Benutzer.
  - **Body**: `{ "phone": "+491761234567", "name": "Max Mustermann" }`
  - **Antwort**: `{ "id": 1, "name": "Max", "phone": "+49...", "token": "32-stelliger-hex-string" }`
- **POST `/api/auth/login`**
  - **Beschreibung**: Meldet einen Benutzer an. Falls die Nummer nicht registriert ist, wird ein 404-Fehler zurückgegeben (das Frontend wechselt dann automatisch in den Registrierungsmodus).
  - **Body**: `{ "phone": "+491761234567" }`
  - **Antwort**: `{ "id": 1, "name": "Max", "phone": "+49...", "token": "..." }`

### 2. Benutzer-Profil
- **GET `/api/users/:id`**
  - **Beschreibung**: Ruft Details eines Benutzers ab.
- **PUT `/api/users/:id`** *(Auth erforderlich)*
  - **Beschreibung**: Aktualisiert den Benutzernamen.
  - **Body**: `{ "name": "Neuer Name" }`

### 3. Fahrten (Trips)
- **GET `/api/trips`**
  - **Beschreibung**: Listet Fahrten auf.
  - **Query-Parameter**: `trip_type` (0=Sucht, 1=Bietet), `from_time` (ISO-Datum ab wann), `to_time` (ISO-Datum bis wann). Standardmäßig werden nur zukünftige Fahrten zurückgegeben.
- **GET `/api/trips/:id`**
  - **Beschreibung**: Holt Details einer bestimmten Fahrt inklusive Ersteller-Details.
- **POST `/api/trips`** *(Auth erforderlich)*
  - **Beschreibung**: Erstellt eine Einzelfahrt.
  - **Body**: `{ "user_id": 1, "start_address": "Stuttgart", "start_lat": 48.77, "start_lng": 9.18, "end_address": "München", "end_lat": 48.13, "end_lng": 11.57, "departure_time": "2026-09-01T08:00:00.000Z", "trip_type": 1, "seats_available": 3 }`
- **PUT `/api/trips/:id`** *(Auth erforderlich, nur Eigentümer)*
  - **Beschreibung**: Ändert Uhrzeit oder freie Sitze einer Fahrt.
  - **Body**: `{ "departure_time": "...", "seats_available": 2 }`
- **DELETE `/api/trips/:id`** *(Auth erforderlich, nur Eigentümer)*
  - **Beschreibung**: Löscht eine Fahrt und informiert andere Clients in Echtzeit.

### 4. Wiederkehrende Fahrten (Recurring)
- **POST `/api/recurring-trips`** *(Auth erforderlich)*
  - **Beschreibung**: Erstellt eine Serie (täglich oder wöchentlich) und generiert automatisch Einzelinstanzen in `trips` für die nächsten 30 Tage (täglich) oder 12 Wochen (wöchentlich).
  - **Body**: `{ "user_id": 1, "start_address": "...", "start_lat": ..., "start_lng": ..., "end_address": "...", "end_lat": ..., "end_lng": ..., "departure_time": "08:00", "trip_type": 1, "seats_available": 3, "frequency": "weekly", "day_of_week": 0, "end_date": "2026-10-31" }`
- **PUT `/api/recurring-trips/:id`** *(Auth erforderlich, nur Eigentümer)*
  - **Beschreibung**: Aktualisiert eine Serie. Löscht automatisch alle zukünftigen Einzelinstanzen und generiert sie mit den neuen Parametern neu.
- **DELETE `/api/recurring-trips/:id`** *(Auth erforderlich, nur Eigentümer)*
  - **Beschreibung**: Löscht die Serie und alle verknüpften Einzeltermine aus der Datenbank.

### 5. Chat & Nachrichten
- **GET `/api/messages/:userId`** *(Auth erforderlich)*
  - **Beschreibung**: Ruft den Chat-Verlauf mit einem anderen Benutzer chronologisch ab.
  - **Query-Parameter**: `otherUserId` (ID des Gesprächspartners).
- **POST `/api/messages`** *(Auth erforderlich)*
  - **Beschreibung**: Sendet eine Nachricht über HTTP-POST (leitet diese auch per WebSocket weiter, falls der Empfänger online ist).
  - **Body**: `{ "from_user_id": 1, "to_user_id": 2, "trip_id": null, "content": "Hallo!" }`
- **PUT `/api/messages/:id/read`** *(Auth erforderlich, nur Empfänger)*
  - **Beschreibung**: Markiert eine empfangene Nachricht als gelesen.

### 6. Geocoding & Routing (Rate-Limited, max 1 req/sec)
- **GET `/api/geocode?address=Ort`**
  - **Beschreibung**: Löst eine Adresse über die Nominatim-API in Koordinaten auf.
- **GET `/api/route?start_lat=...&start_lng=...&end_lat=...&end_lng=...`**
  - **Beschreibung**: Berechnet die Fahrtstrecke (OSRM-API) und liefert ein GeoJSON zur Kartendarstellung.

---

## 🔌 WebSocket-Events

Die Echtzeit-Kommunikation erfolgt über Socket.io.

### Client → Server
- `user-login` (`userId`): Registriert die Socket-Verbindung für den Benutzer (für gezielte Chat-Zustellungen).
- `user-logout`: Meldet die Verbindung ab.
- `send-message` (`{ from_user_id, to_user_id, trip_id, content }`): Sendet eine Chat-Nachricht.
- `typing` (`{ from_user_id, to_user_id }`): Löst den Tipp-Indikator beim Empfänger aus.
- `stop-typing` (`{ from_user_id, to_user_id }`): Entfernt den Tipp-Indikator beim Empfänger.
- `message-read` (`{ message_id }`): Markiert eine Nachricht als gelesen.

### Server → Client
- `new-message` (`{ id, from_user_id, to_user_id, content, created_at, is_read }`): Informiert den Empfänger über eine neue Nachricht.
- `message-sent` (`Message`): Bestätigt dem Absender das erfolgreiche Speichern der Nachricht.
- `user-typing` (`{ from_user_id }`): Teilt dem Client mit, dass der Gesprächspartner gerade tippt.
- `user-stopped-typing` (`{ from_user_id }`): Teilt dem Client mit, dass der Partner nicht mehr tippt.
- `trip-created` (`Trip`): Informiert alle Clients über eine neue Fahrt zur Live-Aktualisierung der Karte.
- `trip-updated` (`Trip`): Informiert über Änderungen an einer Fahrt.
- `trip-deleted` (`{ id }`): Veranlasst das Löschen einer Fahrt von der Karte aller Clients.
- `user-online` (`userId`) / `user-offline` (`userId`): Gibt den Online-Status von Kontakten aus.

---

## 🚀 Deployment-Anleitung

### 1. Backend (Oracle Cloud - Always Free)
1. Installiere Node.js, Git und PostgreSQL auf deiner Oracle-Instanz.
2. Klone dieses Repository.
3. Richte Nginx als Reverse Proxy ein, um Anfragen von Port 80/443 an den Express-Server (Standard Port 3001) weiterzuleiten.
4. Richte SSL über Let's Encrypt ein:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d drivetohls.duckdns.org
   ```
5. Verwende **PM2** (Process Manager), damit der Server im Hintergrund läuft und bei Fehlern automatisch neu startet:
   ```bash
   npm install -g pm2
   pm2 start server.js --name carpool-backend
   pm2 save
   pm2 startup
   ```

### 2. Frontend (Vercel - Kostenlos)
1. Erstelle ein Konto auf [Vercel](https://vercel.com) und verknüpfe es mit deinem GitHub-Repository.
2. Wähle das Verzeichnis `frontend/` als Root-Verzeichnis aus.
3. Setze im Vercel-Dashboard die Umgebungsvariable:
   - `VITE_API_URL` = `https://drivetohls.duckdns.org` (deine Backend-URL)
4. Klicke auf **Deploy**. Vercel baut die App und stellt sie unter einer HTTPS-Subdomain bereit.

---

## 🛠️ Fehlerbehebung (Troubleshooting)

### 1. Die Karte lädt nicht oder ist leer
- Prüfe, ob die Leaflet CSS- und JS-Dateien im Browser blockiert werden. In `frontend/index.html` sind die offiziellen, sicheren HTTPS CDN-Links von unpkg.com hinterlegt.
- Stelle sicher, dass eine aktive Internetverbindung besteht, um die OpenStreetMap-Kacheln abzurufen.

### 2. WebSocket-Verbindung bricht ab oder schlägt fehl
- Unser Socket-Setup im Frontend (`frontend/src/services/socket.js`) nutzt eine robuste Wiederverbindung mit bis zu 15 Versuchen im Abstand von 2 Sekunden.
- Wenn das Backend hinter einem Nginx-Reverse-Proxy liegt, stelle sicher, dass Nginx so konfiguriert ist, dass es WebSocket-Upgrade-Header zulässt:
  ```nginx
  location /socket.io/ {
      proxy_pass http://localhost:3001/socket.io/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "Upgrade";
      proxy_set_header Host $host;
  }
  ```

### 3. Geocoding-Anfragen dauern sehr lange
- Da die kostenlose OpenStreetMap Nominatim-API ein striktes Limit von maximal 1 Anfrage pro Sekunde vorschreibt, drosselt unser Backend (`backend/routes/external.js`) aufeinanderfolgende Anfragen künstlich. Bei schneller Tastatureingabe im Suchfeld verzögert das Debounce-Verfahren (600ms) im Frontend die Anfrage zusätzlich, um das Limit nicht zu überschreiten. Dies ist ein normales und gewolltes Verhalten zum Schutz vor IP-Sperren.
