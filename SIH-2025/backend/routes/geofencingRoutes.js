const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

/**
 * GET /api/geofencing/zones
 * Get all geofencing zones
 */
router.get('/zones', auth, async (req, res) => {
  try {
    // Tourists should also be able to fetch zones for visualization

    // Get socket service instance (this would need to be passed from server.js)
    const socketService = req.app.get('socketService');
    if (!socketService) {
      return res.status(500).json({ 
        success: false, 
        message: 'Socket service not available' 
      });
    }

    const zones = socketService.getAllZones();
    
    res.json({
      success: true,
      zones: {
        restricted: zones.restricted.map(zone => ({
          id: zone.id,
          name: zone.name,
          type: zone.type,
          coordinates: zone.coordinates,
          alertLevel: zone.alertLevel,
          description: zone.description,
          isActive: zone.isActive,
          createdAt: zone.createdAt
        })),
        safe: zones.safe.map(zone => ({
          id: zone.id,
          name: zone.name,
          type: zone.type,
          coordinates: zone.coordinates,
          alertLevel: zone.alertLevel,
          description: zone.description,
          isActive: zone.isActive,
          createdAt: zone.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Error getting zones:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get zones' 
    });
  }
});

/**
 * POST /api/geofencing/zones/restricted
 * Create a new restricted zone
 */
router.post('/zones/restricted', auth, async (req, res) => {
  try {
    if (req.user.role !== 'authority') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Authority role required.' 
      });
    }

    const { name, coordinates, alertLevel, description } = req.body;

    if (!name || !coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and coordinates are required' 
      });
    }

    const socketService = req.app.get('socketService');
    if (!socketService) {
      return res.status(500).json({ 
        success: false, 
        message: 'Socket service not available' 
      });
    }

    const zone = socketService.addRestrictedZone(name, coordinates, {
      alertLevel: alertLevel || 'high',
      description: description || ''
    });

    res.status(201).json({
      success: true,
      message: 'Restricted zone created successfully',
      zone: {
        id: zone.id,
        name: zone.name,
        type: zone.type,
        coordinates: zone.coordinates,
        alertLevel: zone.alertLevel,
        description: zone.description,
        isActive: zone.isActive,
        createdAt: zone.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating restricted zone:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create restricted zone' 
    });
  }
});

/**
 * POST /api/geofencing/zones/safe
 * Create a new safe zone
 */
router.post('/zones/safe', auth, async (req, res) => {
  try {
    if (req.user.role !== 'authority') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Authority role required.' 
      });
    }

    const { name, coordinates, alertLevel, description } = req.body;

    if (!name || !coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and coordinates are required' 
      });
    }

    const socketService = req.app.get('socketService');
    if (!socketService) {
      return res.status(500).json({ 
        success: false, 
        message: 'Socket service not available' 
      });
    }

    const zone = socketService.addSafeZone(name, coordinates, {
      alertLevel: alertLevel || 'low',
      description: description || ''
    });

    res.status(201).json({
      success: true,
      message: 'Safe zone created successfully',
      zone: {
        id: zone.id,
        name: zone.name,
        type: zone.type,
        coordinates: zone.coordinates,
        alertLevel: zone.alertLevel,
        description: zone.description,
        isActive: zone.isActive,
        createdAt: zone.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating safe zone:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create safe zone' 
    });
  }
});

/**
 * POST /api/geofencing/zones/circular
 * Create a new circular zone
 */
router.post('/zones/circular', auth, async (req, res) => {
  try {
    if (req.user.role !== 'authority') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Authority role required.' 
      });
    }

    const { name, center, radius, type, alertLevel, description } = req.body;

    if (!name || !center || !radius || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, center, radius, and type are required' 
      });
    }

    if (!Array.isArray(center) || center.length !== 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Center must be an array of [lng, lat]' 
      });
    }

    if (type !== 'restricted' && type !== 'safe') {
      return res.status(400).json({ 
        success: false, 
        message: 'Type must be either "restricted" or "safe"' 
      });
    }

    const socketService = req.app.get('socketService');
    if (!socketService) {
      return res.status(500).json({ 
        success: false, 
        message: 'Socket service not available' 
      });
    }

    const zone = socketService.addCircularZone(name, center, radius, type, {
      alertLevel: alertLevel || (type === 'restricted' ? 'high' : 'low'),
      description: description || ''
    });

    res.status(201).json({
      success: true,
      message: 'Circular zone created successfully',
      zone: {
        id: zone.id,
        name: zone.name,
        type: zone.type,
        coordinates: zone.coordinates,
        alertLevel: zone.alertLevel,
        description: zone.description,
        isActive: zone.isActive,
        createdAt: zone.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating circular zone:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create circular zone' 
    });
  }
});

/**
 * GET /api/geofencing/alerts
 * Get recent alerts
 */
router.get('/alerts', auth, async (req, res) => {
  try {
    if (req.user.role !== 'authority') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Authority role required.' 
      });
    }

    const limit = parseInt(req.query.limit) || 50;
    const socketService = req.app.get('socketService');
    
    if (!socketService) {
      return res.status(500).json({ 
        success: false, 
        message: 'Socket service not available' 
      });
    }

    const alerts = socketService.getRecentAlerts(limit);
    
    res.json({
      success: true,
      alerts: alerts.map(alert => ({
        id: alert.id,
        type: alert.type,
        userId: alert.userId,
        userName: alert.userName,
        lat: alert.lat,
        lng: alert.lng,
        zoneName: alert.zoneName,
        zoneId: alert.zoneId,
        alertLevel: alert.alertLevel,
        description: alert.description,
        timestamp: alert.timestamp
      }))
    });
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get alerts' 
    });
  }
});

/**
 * DELETE /api/geofencing/zones/:zoneId
 * Delete a zone
 */
router.delete('/zones/:zoneId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'authority') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Authority role required.' 
      });
    }

    const { zoneId } = req.params;
    const socketService = req.app.get('socketService');
    
    if (!socketService) {
      return res.status(500).json({ 
        success: false, 
        message: 'Socket service not available' 
      });
    }

    const success = socketService.geofencingService.deleteZone(zoneId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Zone deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }
  } catch (error) {
    console.error('Error deleting zone:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete zone' 
    });
  }
});

module.exports = router;
