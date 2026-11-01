require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const initDatabase = require('./config/initDatabase');
const { requireAuth } = require('./lib/auth');


const caFile = path.join(__dirname, 'ca.pem');
const useSsl = process.env.DB_SSL !== 'false' && fs.existsSync(caFile);
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: useSsl ? { ca: fs.readFileSync(caFile), rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: ['DATE']
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, '../FrontEnd')));
app.use('/api', (req, res, next) => { req.pool = pool; next(); });


app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', require('./routes/login'));
app.use('/api', require('./routes/forgotPassword'));


app.use('/api/auth', requireAuth(), require('./routes/changePassword'));
app.use('/api/bookings', requireAuth(['lecturer']), require('./routes/bookings'));
app.use('/api/my-allocations', requireAuth(['lecturer']), require('./routes/myAllocations'));
app.use('/api/feedback', requireAuth(['lecturer']), require('./routes/feedback'));


app.use('/api/createnotifications', requireAuth(['admin']));
app.use('/api', require('./routes/createNotifications'));
app.use('/api/admin', requireAuth(['admin']),
  require('./routes/adminStats'),
  require('./routes/adminHalls'),
  require('./routes/adminUpdateHalls'),
  require('./routes/adminLecturers'),
  require('./routes/adminSubjects'),
  require('./routes/adminAllocations'),
  require('./routes/adminUpdateAllocations'),
  require('./routes/adminHallSuggestions'),
  require('./routes/adminTimetable'),
  require('./routes/adminReports'),
  require('./routes/adminHistory'),
  require('./routes/adminUsers'),
  require('./routes/adminUpdateSubject'),
  require('./routes/adminUpdateUsers'),
  require('./routes/adminDeleteUser'),
  require('./routes/adminDeleteSubject'),
  require('./routes/adminBookings'),
  require('./routes/adminFeedback'));


app.use('/api', requireAuth(), require('./routes/timetable'), require('./routes/notifications'), require('./routes/schedule'));

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

initDatabase(pool).then(() => {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}).catch(() => process.exit(1));
