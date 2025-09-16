const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const {
  securityHeaders,
  requestLogger,
  sanitizeData,
  privacyControls,
  generalRateLimit,
  authRateLimit,
  positionRateLimit,
  sosRateLimit,
  geofencingRateLimit
} = require('./middleware/security');
require('dotenv').config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5001;

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Security middleware
app.use(securityHeaders);
app.use(requestLogger);
app.use(sanitizeData);
app.use(privacyControls);

// CORS and JSON parsing
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes with rate limiting
app.use('/api/auth', authRateLimit, require('./routes/authRoutes'));
app.use('/api/tourists', generalRateLimit, require('./routes/touristRoutes'));
// Apply granular rate limits inside sosRoutes so GET listing isn't throttled
app.use('/api/sos', require('./routes/sosRoutes'));
app.use('/api/position', positionRateLimit, require('./routes/positionRoutes'));
app.use('/api/geofencing', geofencingRateLimit, require('./routes/geofencingRoutes'));
app.use('/api/privacy', generalRateLimit, require('./routes/privacyRoutes'));
app.use('/api/analytics', generalRateLimit, require('./routes/analyticsRoutes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Connect to MongoDB
require('./config/db')();

// Initialize PostgreSQL
const { initializeDatabase } = require('./config/postgres');

// Initialize Socket.IO service
const socketAuth = require('./middleware/socketAuth');
const SocketService = require('./services/socketService');

// Apply authentication middleware to Socket.IO
io.use(socketAuth);

// Initialize socket service
const socketService = new SocketService(io);

// Make socket service available to routes
app.set('socketService', socketService);

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize PostgreSQL (optional)
    await initializeDatabase();

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.IO server ready`);
      console.log(`📱 Tourist tracking system ready`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
