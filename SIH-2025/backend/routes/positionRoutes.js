const express = require('express');
const router = express.Router();
const redisClient = require('../config/redis');
const auth = require('../middleware/auth');

/**
 * POST /api/position
 * Fallback endpoint for non-WebSocket clients to send position updates
 */
router.post('/', auth, async (req, res) => {
  try {
    const { lat, lon, accuracy, timestamp } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!lat || !lon || !timestamp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Latitude, longitude, and timestamp are required' 
      });
    }

    // Create position object
    const position = {
      userId: userId,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      accuracy: parseFloat(accuracy) || 0,
      timestamp: new Date(timestamp),
      userName: req.user.name
    };

    // Store in Redis
    await redisClient.hSet('live_positions', userId, JSON.stringify(position));

    console.log(`📍 Position updated via API for user ${req.user.name}: ${lat}, ${lon}`);

    res.json({
      success: true,
      message: 'Position updated successfully',
      position: {
        lat: position.lat,
        lon: position.lon,
        accuracy: position.accuracy,
        timestamp: position.timestamp
      }
    });
  } catch (error) {
    console.error('Error updating position:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update position' 
    });
  }
});

/**
 * GET /api/position/live
 * Get all live positions (for authorities)
 */
router.get('/live', auth, async (req, res) => {
  try {
    // Only authorities can access live positions
    if (req.user.role !== 'authority') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Authority role required.' 
      });
    }

    const positions = await redisClient.hGetAll('live_positions');
    const livePositions = Object.values(positions).map(pos => JSON.parse(pos));

    res.json({
      success: true,
      positions: livePositions
    });
  } catch (error) {
    console.error('Error getting live positions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get live positions' 
    });
  }
});

module.exports = router;
