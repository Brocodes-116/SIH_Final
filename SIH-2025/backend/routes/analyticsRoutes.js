const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const LocationAnalyticsService = require('../services/locationAnalyticsService');
const { validateInput, positionValidation } = require('../middleware/security');
const { sequelize } = require('../config/postgres');
const { QueryTypes } = require('sequelize');

const analyticsService = new LocationAnalyticsService();

/**
 * POST /api/analytics/location
 * Store location data with analytics
 */
router.post('/location', auth, positionValidation, validateInput, async (req, res) => {
  try {
    const locationData = {
      userId: req.user.id,
      userName: req.user.name,
      lat: req.body.lat,
      lon: req.body.lon,
      accuracy: req.body.accuracy,
      timestamp: req.body.timestamp,
      deviceInfo: req.body.deviceInfo,
      networkInfo: req.body.networkInfo,
      anonymized: req.body.anonymized || false,
      retentionDays: req.body.retentionDays || 30
    };

    const storedLocation = await analyticsService.storeLocationWithAnalytics(locationData);

    res.status(201).json({
      success: true,
      message: 'Location stored with analytics',
      location: {
        id: storedLocation.id,
        userId: storedLocation.userId,
        lat: storedLocation.latitude,
        lon: storedLocation.longitude,
        accuracy: storedLocation.accuracy,
        timestamp: storedLocation.timestamp,
        qualityScore: storedLocation.qualityScore,
        isAnomalous: storedLocation.isAnomalous,
        speed: storedLocation.speed,
        distanceFromPrevious: storedLocation.distanceFromPrevious
      }
    });
  } catch (error) {
    console.error('Error storing location with analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store location data'
    });
  }
});

/**
 * GET /api/analytics/path/:userId
 * Get movement path for a user
 */
router.get('/path/:userId', auth, async (req, res) => {
  try {
    // Only authorities can access other users' data
    if (req.user.role !== 'authority' && req.user.id !== req.params.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { userId } = req.params;
    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Start time and end time are required'
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    const pathData = await analyticsService.getMovementPath(userId, start, end);

    res.json({
      success: true,
      path: pathData
    });
  } catch (error) {
    console.error('Error getting movement path:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get movement path'
    });
  }
});

/**
 * GET /api/analytics/heatmap
 * Get heatmap data for a region
 */
router.get('/heatmap', auth, async (req, res) => {
  try {
    // Only authorities can access heatmap data
    if (req.user.role !== 'authority') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Authority role required.'
      });
    }

    const { north, south, east, west, startTime, endTime } = req.query;

    if (!north || !south || !east || !west || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'All parameters (north, south, east, west, startTime, endTime) are required'
      });
    }

    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west)
    };

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    const heatmapData = await analyticsService.getHeatmapData(bounds, start, end);

    res.json({
      success: true,
      heatmap: heatmapData
    });
  } catch (error) {
    console.error('Error getting heatmap data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get heatmap data'
    });
  }
});

/**
 * GET /api/analytics/user/:userId
 * Get analytics for a specific user
 */
router.get('/user/:userId', auth, async (req, res) => {
  try {
    // Only authorities can access other users' analytics
    if (req.user.role !== 'authority' && req.user.id !== req.params.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { userId } = req.params;
    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Start time and end time are required'
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    const analytics = await analyticsService.getUserAnalytics(userId, start, end);

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting user analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user analytics'
    });
  }
});

/**
 * GET /api/analytics/radius
 * Get locations within radius
 */
router.get('/radius', auth, async (req, res) => {
  try {
    // Only authorities can access radius data
    if (req.user.role !== 'authority') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Authority role required.'
      });
    }

    const { lat, lng, radius, startTime, endTime } = req.query;

    if (!lat || !lng || !radius || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'All parameters (lat, lng, radius, startTime, endTime) are required'
      });
    }

    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);
    const radiusMeters = parseFloat(radius);
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(centerLat) || isNaN(centerLng) || isNaN(radiusMeters) || 
        isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters'
      });
    }

    const locations = await analyticsService.getLocationsInRadius(
      centerLat, centerLng, radiusMeters, start, end
    );

    res.json({
      success: true,
      locations: locations.map(loc => ({
        id: loc.id,
        userId: loc.userId,
        userName: loc.userName,
        lat: loc.latitude,
        lng: loc.longitude,
        accuracy: loc.accuracy,
        timestamp: loc.timestamp,
        speed: loc.speed,
        qualityScore: loc.qualityScore,
        isAnomalous: loc.isAnomalous
      }))
    });
  } catch (error) {
    console.error('Error getting locations in radius:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get locations in radius'
    });
  }
});

/**
 * GET /api/analytics/stats
 * Get overall analytics statistics
 */
router.get('/stats', auth, async (req, res) => {
  try {
    // Only authorities can access statistics
    if (req.user.role !== 'authority') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Authority role required.'
      });
    }

    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Start time and end time are required'
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Get overall statistics
    const stats = await sequelize.query(
      `SELECT 
         COUNT(*) as total_locations,
         COUNT(DISTINCT userId) as unique_users,
         AVG(accuracy) as avg_accuracy,
         AVG(speed) as avg_speed,
         COUNT(CASE WHEN isAnomalous = true THEN 1 END) as anomalous_count,
         COUNT(CASE WHEN isEmergency = true THEN 1 END) as emergency_count
       FROM location_history 
       WHERE timestamp BETWEEN :startTime AND :endTime`,
      {
        replacements: { startTime: start, endTime: end },
        type: QueryTypes.SELECT
      }
    );

    res.json({
      success: true,
      stats: stats[0] || {}
    });
  } catch (error) {
    console.error('Error getting analytics stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics statistics'
    });
  }
});

/**
 * POST /api/analytics/cleanup
 * Clean up old location data
 */
router.post('/cleanup', auth, async (req, res) => {
  try {
    // Only authorities can trigger cleanup
    if (req.user.role !== 'authority') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Authority role required.'
      });
    }

    const { retentionDays = 30 } = req.body;
    const deletedCount = await analyticsService.cleanupOldData(retentionDays);

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old location records`,
      deletedCount
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup old data'
    });
  }
});

module.exports = router;
