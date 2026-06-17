require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes  = require('./routes/auth');
const faultRoutes = require('./routes/faults');
const toolRoutes  = require('./routes/tools');
const logRoutes   = require('./routes/logs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());

// TODO: lock this down before the actual demo, only allow our frontend
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// stricter limit on login attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again later.' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300
});

app.use(express.json({ limit: '1mb' }));

app.use('/api/auth',   authLimiter, authRoutes);
app.use('/api/faults', apiLimiter,  faultRoutes);
app.use('/api/tools',  apiLimiter,  toolRoutes);
app.use('/api/logs',   apiLimiter,  logRoutes);

// quick health check so the frontend knows the server is up
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
