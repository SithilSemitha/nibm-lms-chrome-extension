# LMS Activity Manager Chrome Extension

A Chrome extension to manage and track activities within NIBM Worldwide LMS (https://lms.nibmworldwide.com/).

## Project Structure

```
lms-activity-manager/
├── extension/              # Chrome Extension (Frontend)
│   ├── manifest.json
│   ├── popup/
│   ├── content/
│   └── background/
├── backend/               # Node.js Backend
│   ├── src/
│   ├── config/
│   └── package.json
└── database/             # PostgreSQL Schema
    └── schema.sql
```

## Features

- Track LMS activities (assignments, courses, deadlines)
- Schedule reminders for upcoming tasks
- Dashboard view of all activities
- Sync data across devices via backend
- Activity analytics and progress tracking

## Setup Instructions

### 1. Database Setup (PostgreSQL)

```bash
# Install PostgreSQL (if not already installed)
# For Ubuntu/Debian:
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Create database
sudo -u postgres psql
CREATE DATABASE lms_activities;
CREATE USER lms_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE lms_activities TO lms_user;
\q

# Run schema
psql -U lms_user -d lms_activities -f database/schema.sql
```

### 2. Backend Setup (Node.js)

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your database credentials

# Start the server
npm start
# For development with auto-reload:
npm run dev
```

### 3. Chrome Extension Setup

```bash
# Build the extension (if needed)
cd extension
npm install
npm run build

# Load in Chrome:
# 1. Open Chrome and go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the extension/ directory
```

## Configuration

### Backend (.env)
```
PORT=3000
DATABASE_URL=postgresql://lms_user:your_password@localhost:5432/lms_activities
JWT_SECRET=your_jwt_secret_here
CORS_ORIGIN=chrome-extension://your-extension-id
```

### Extension (config.js)
```javascript
const API_URL = 'http://localhost:3000/api';
```

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/activities` - Get all activities
- `POST /api/activities` - Create new activity
- `PUT /api/activities/:id` - Update activity
- `DELETE /api/activities/:id` - Delete activity
- `GET /api/analytics` - Get activity analytics

## Development

### Backend Development
```bash
cd backend
npm run dev  # Runs with nodemon for auto-reload
```

### Extension Development
- Make changes to extension files
- Reload the extension in chrome://extensions/
- Check console for errors

## Technologies Used

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Chrome APIs**: chrome.storage, chrome.alarms, chrome.notifications

## License

MIT License
