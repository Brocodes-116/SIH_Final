const redisClient = require('../config/redis');
const GeofencingService = require('./geofencingService');
const LocationAnalyticsService = require('./locationAnalyticsService');

/**
 * Socket.IO service for real-time location tracking
 * Handles position updates, geofencing, and broadcasting
 */
class SocketService {
  constructor(io) {
    this.io = io;
    this.rateLimits = new Map(); // Simple in-memory rate limiting
    this.geofencingService = new GeofencingService();
    this.analyticsService = new LocationAnalyticsService();
    this.setupEventHandlers();
    this.initializeGeofencing();
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`👤 User ${socket.userName} (${socket.userRole}) connected`);

      // Handle position updates from tourists
      socket.on('position:update', async (data) => {
        await this.handlePositionUpdate(socket, data);
      });

      // Handle watch requests from authorities
      socket.on('watch:start', (data) => {
        this.handleWatchStart(socket, data);
      });

      socket.on('watch:stop', (data) => {
        this.handleWatchStop(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`👋 User ${socket.userName} disconnected`);
      });
    });
  }

  /**
   * Handle position updates from tourists
   */
  async handlePositionUpdate(socket, data) {
    try {
      // Rate limiting: 1 update per 5 seconds per user
      if (!this.checkRateLimit(socket.userId)) {
        socket.emit('error', { message: 'Rate limit exceeded. Please wait before sending another update.' });
        return;
      }

      // Validate data
      const { lat, lon, accuracy, timestamp } = data;
      if (!lat || !lon || !timestamp) {
        socket.emit('error', { message: 'Invalid position data' });
        return;
      }

      // Create position object
      const position = {
        userId: socket.userId,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        accuracy: parseFloat(accuracy) || 0,
        timestamp: new Date(timestamp),
        userName: socket.userName
      };

      // Store in Redis (if available)
      if (redisClient.isConnected && redisClient.isConnected()) {
        try {
          await redisClient.hSet('live_positions', socket.userId, JSON.stringify(position));
        } catch (redisError) {
          // Silent fail - Redis might have disconnected
        }
      }

      // Store in PostgreSQL with analytics
      try {
        const analyticsResult = await this.analyticsService.storeLocationWithAnalytics({
          userId: socket.userId,
          userName: socket.userName,
          lat: position.lat,
          lon: position.lon,
          accuracy: position.accuracy,
          timestamp: position.timestamp,
          deviceInfo: data.deviceInfo,
          networkInfo: data.networkInfo,
          anonymized: data.anonymized || false,
          retentionDays: data.retentionDays || 30
        });
        
        if (!analyticsResult.success) {
          console.log('Analytics storage skipped:', analyticsResult.reason || analyticsResult.error);
        }
      } catch (analyticsError) {
        console.error('Error storing location analytics:', analyticsError);
        // Don't fail the position update if analytics fails
      }

      // Check geofencing
      await this.checkGeofencing(position);

      // Broadcast to watchers
      this.broadcastPositionUpdate(position);

      console.log(`📍 Position updated for user ${socket.userName}: ${lat}, ${lon}`);
    } catch (error) {
      console.error('Error handling position update:', error);
      socket.emit('error', { message: 'Failed to update position' });
    }
  }

  /**
   * Handle watch start requests from authorities
   */
  handleWatchStart(socket, data) {
    const { userId } = data;
    if (!userId) {
      socket.emit('error', { message: 'User ID required for watching' });
      return;
    }

    // Join the watch room for this user
    socket.join(`watch:${userId}`);
    console.log(`👁️ Authority ${socket.userName} started watching user ${userId}`);

    // Send current position if available
    this.sendCurrentPosition(socket, userId);
  }

  /**
   * Handle watch stop requests from authorities
   */
  handleWatchStop(socket, data) {
    const { userId } = data;
    if (!userId) {
      socket.emit('error', { message: 'User ID required for stopping watch' });
      return;
    }

    // Leave the watch room
    socket.leave(`watch:${userId}`);
    console.log(`👁️ Authority ${socket.userName} stopped watching user ${userId}`);
  }

  /**
   * Broadcast position update to watchers
   */
  broadcastPositionUpdate(position) {
    this.io.to(`watch:${position.userId}`).emit('location:changed', {
      userId: position.userId,
      userName: position.userName,
      lat: position.lat,
      lon: position.lon,
      accuracy: position.accuracy,
      timestamp: position.timestamp
    });
  }

  /**
   * Send current position to a specific socket
   */
  async sendCurrentPosition(socket, userId) {
    try {
      const positionData = await redisClient.hGet('live_positions', userId);
      if (positionData) {
        const position = JSON.parse(positionData);
        socket.emit('location:changed', {
          userId: position.userId,
          userName: position.userName,
          lat: position.lat,
          lon: position.lon,
          accuracy: position.accuracy,
          timestamp: position.timestamp
        });
      }
    } catch (error) {
      console.error('Error sending current position:', error);
    }
  }

  /**
   * Initialize geofencing with sample zones
   */
  async initializeGeofencing() {
    try {
      // Load existing zones from Redis
      await this.geofencingService.loadZonesFromRedis();
      
      // Add some sample zones if none exist
      if (this.geofencingService.restrictedZones.length === 0) {
        // Sample restricted zone in Delhi
        this.geofencingService.addRestrictedZone('Delhi Restricted Area', [
          [77.2090, 28.6139],
          [77.2090, 28.6149],
          [77.2100, 28.6149],
          [77.2100, 28.6139],
          [77.2090, 28.6139]
        ], {
          description: 'High-security restricted area in Delhi',
          alertLevel: 'high'
        });

        // Sample safe zone
        this.geofencingService.addCircularZone(
          'Delhi Safe Zone',
          [77.2090, 28.6139],
          1000, // 1km radius
          'safe',
          {
            description: 'Safe tourist area in Delhi',
            alertLevel: 'low'
          }
        );
      }
    } catch (error) {
      console.error('Error initializing geofencing:', error);
    }
  }

  /**
   * Check geofencing for position
   */
  async checkGeofencing(position) {
    try {
      const geofencingResult = this.geofencingService.checkGeofencing(position);
      
      // Emit alerts to authorities
      if (geofencingResult.alerts.length > 0) {
        for (const alert of geofencingResult.alerts) {
          this.io.to('authorities').emit('alert', alert);
          console.log(`🚨 Alert sent: ${alert.type} for ${alert.userName}`);
        }
      }

      // Emit zone status to the specific user
      this.io.to(`user:${position.userId}`).emit('zone_status', {
        isInRestrictedZone: geofencingResult.isInRestrictedZone,
        isInSafeZone: geofencingResult.isInSafeZone,
        restrictedZones: geofencingResult.restrictedZones.map(z => ({
          id: z.id,
          name: z.name,
          alertLevel: z.alertLevel
        })),
        safeZones: geofencingResult.safeZones.map(z => ({
          id: z.id,
          name: z.name,
          alertLevel: z.alertLevel
        }))
      });

      return geofencingResult;
    } catch (error) {
      console.error('Error checking geofencing:', error);
      return null;
    }
  }

  /**
   * Add restricted zone for geofencing
   */
  addRestrictedZone(name, coordinates, options = {}) {
    return this.geofencingService.addRestrictedZone(name, coordinates, options);
  }

  /**
   * Add safe zone for geofencing
   */
  addSafeZone(name, coordinates, options = {}) {
    return this.geofencingService.addSafeZone(name, coordinates, options);
  }

  /**
   * Add circular zone for geofencing
   */
  addCircularZone(name, center, radius, type = 'restricted', options = {}) {
    return this.geofencingService.addCircularZone(name, center, radius, type, options);
  }

  /**
   * Get all zones
   */
  getAllZones() {
    return this.geofencingService.getAllZones();
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 50) {
    return this.geofencingService.getRecentAlerts(limit);
  }

  /**
   * Simple rate limiting: 1 update per 5 seconds per user
   */
  checkRateLimit(userId) {
    const now = Date.now();
    const lastUpdate = this.rateLimits.get(userId);
    
    if (lastUpdate && (now - lastUpdate) < 5000) {
      return false;
    }
    
    this.rateLimits.set(userId, now);
    return true;
  }

  /**
   * Get all live positions
   */
  async getAllLivePositions() {
    if (redisClient.isConnected && redisClient.isConnected()) {
      try {
        const positions = await redisClient.hGetAll('live_positions');
        return Object.values(positions).map(pos => JSON.parse(pos));
      } catch (error) {
        return [];
      }
    }
    return [];
  }
}

module.exports = SocketService;
