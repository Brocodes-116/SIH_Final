const turf = require('@turf/turf');
const redisClient = require('../config/redis');

/**
 * Geofencing Service
 * Handles geofencing logic, zone management, and alert generation
 */
class GeofencingService {
  constructor() {
    this.restrictedZones = [];
    this.safeZones = [];
    this.alertHistory = [];
    this.zoneSubscriptions = new Map(); // userId -> Set of zone names
  }

  /**
   * Add a restricted zone
   * @param {string} name - Zone name
   * @param {Array} coordinates - Array of [lng, lat] coordinates forming a polygon
   * @param {Object} options - Zone options
   */
  addRestrictedZone(name, coordinates, options = {}) {
    try {
      // Ensure the polygon is closed (first and last coordinates are the same)
      if (coordinates.length < 4) {
        throw new Error('Polygon must have at least 4 coordinates');
      }

      if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
          coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
        coordinates.push(coordinates[0]); // Close the polygon
      }

      const polygon = turf.polygon([coordinates]);
      
      // Validate polygon
      if (!turf.booleanValid(polygon)) {
        throw new Error('Invalid polygon coordinates');
      }

      const zone = {
        id: `restricted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        polygon,
        coordinates,
        type: 'restricted',
        alertLevel: options.alertLevel || 'high',
        description: options.description || '',
        createdAt: new Date(),
        isActive: true,
        ...options
      };

      this.restrictedZones.push(zone);
      this.saveZonesToRedis();
      
      console.log(`🚧 Added restricted zone: ${name} (${zone.id})`);
      return zone;
    } catch (error) {
      console.error('Error adding restricted zone:', error);
      throw error;
    }
  }

  /**
   * Add a safe zone
   * @param {string} name - Zone name
   * @param {Array} coordinates - Array of [lng, lat] coordinates forming a polygon
   * @param {Object} options - Zone options
   */
  addSafeZone(name, coordinates, options = {}) {
    try {
      // Ensure the polygon is closed
      if (coordinates.length < 4) {
        throw new Error('Polygon must have at least 4 coordinates');
      }

      if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
          coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
        coordinates.push(coordinates[0]);
      }

      const polygon = turf.polygon([coordinates]);
      
      if (!turf.booleanValid(polygon)) {
        throw new Error('Invalid polygon coordinates');
      }

      const zone = {
        id: `safe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        polygon,
        coordinates,
        type: 'safe',
        alertLevel: options.alertLevel || 'low',
        description: options.description || '',
        createdAt: new Date(),
        isActive: true,
        ...options
      };

      this.safeZones.push(zone);
      this.saveZonesToRedis();
      
      console.log(`🛡️ Added safe zone: ${name} (${zone.id})`);
      return zone;
    } catch (error) {
      console.error('Error adding safe zone:', error);
      throw error;
    }
  }

  /**
   * Add a circular zone
   * @param {string} name - Zone name
   * @param {Array} center - [lng, lat] center coordinates
   * @param {number} radius - Radius in meters
   * @param {string} type - 'restricted' or 'safe'
   * @param {Object} options - Zone options
   */
  addCircularZone(name, center, radius, type = 'restricted', options = {}) {
    try {
      const circle = turf.circle(center, radius, { units: 'meters' });
      const coordinates = circle.geometry.coordinates[0];
      
      if (type === 'restricted') {
        return this.addRestrictedZone(name, coordinates, options);
      } else {
        return this.addSafeZone(name, coordinates, options);
      }
    } catch (error) {
      console.error('Error adding circular zone:', error);
      throw error;
    }
  }

  /**
   * Check if a point is in any restricted zones
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Array} Array of zones the point is in
   */
  checkRestrictedZones(lat, lng) {
    const point = turf.point([lng, lat]);
    const zonesIn = [];

    for (const zone of this.restrictedZones) {
      if (!zone.isActive) continue;

      try {
        if (turf.booleanPointInPolygon(point, zone.polygon)) {
          zonesIn.push(zone);
        }
      } catch (error) {
        console.error(`Error checking zone ${zone.name}:`, error);
      }
    }

    return zonesIn;
  }

  /**
   * Check if a point is in any safe zones
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Array} Array of zones the point is in
   */
  checkSafeZones(lat, lng) {
    const point = turf.point([lng, lat]);
    const zonesIn = [];

    for (const zone of this.safeZones) {
      if (!zone.isActive) continue;

      try {
        if (turf.booleanPointInPolygon(point, zone.polygon)) {
          zonesIn.push(zone);
        }
      } catch (error) {
        console.error(`Error checking zone ${zone.name}:`, error);
      }
    }

    return zonesIn;
  }

  /**
   * Check geofencing for a position and generate alerts
   * @param {Object} position - Position object with lat, lng, userId, userName
   * @returns {Object} Geofencing result with alerts and zone info
   */
  checkGeofencing(position) {
    const { lat, lng, userId, userName } = position;
    const result = {
      userId,
      userName,
      lat,
      lng,
      timestamp: new Date(),
      restrictedZones: [],
      safeZones: [],
      alerts: [],
      isInRestrictedZone: false,
      isInSafeZone: false
    };

    try {
      // Check restricted zones
      const restrictedZones = this.checkRestrictedZones(lat, lng);
      result.restrictedZones = restrictedZones;
      result.isInRestrictedZone = restrictedZones.length > 0;

      // Check safe zones
      const safeZones = this.checkSafeZones(lat, lng);
      result.safeZones = safeZones;
      result.isInSafeZone = safeZones.length > 0;

      // Generate alerts
      if (result.isInRestrictedZone) {
        for (const zone of restrictedZones) {
          const alert = this.generateAlert('geofence_breach', {
            userId,
            userName,
            lat,
            lng,
            zoneName: zone.name,
            zoneId: zone.id,
            alertLevel: zone.alertLevel,
            description: `Tourist entered restricted zone: ${zone.name}`,
            zone
          });
          result.alerts.push(alert);
        }
      }

      // Check if tourist left safe zone (if they were previously in one)
      const previousState = this.getTouristZoneState(userId);
      if (previousState && previousState.isInSafeZone && !result.isInSafeZone) {
        const alert = this.generateAlert('safe_zone_exit', {
          userId,
          userName,
          lat,
          lng,
          description: 'Tourist left safe zone',
          alertLevel: 'medium'
        });
        result.alerts.push(alert);
      }

      // Update tourist zone state
      this.updateTouristZoneState(userId, result);

      return result;
    } catch (error) {
      console.error('Error checking geofencing:', error);
      return result;
    }
  }

  /**
   * Generate an alert
   * @param {string} type - Alert type
   * @param {Object} data - Alert data
   * @returns {Object} Alert object
   */
  generateAlert(type, data) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date(),
      ...data
    };

    this.alertHistory.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    console.log(`🚨 Alert generated: ${type} for ${data.userName}`);
    return alert;
  }

  /**
   * Get tourist's current zone state
   * @param {string} userId - User ID
   * @returns {Object|null} Zone state
   */
  getTouristZoneState(userId) {
    return this.touristZoneStates?.get(userId) || null;
  }

  /**
   * Update tourist's zone state
   * @param {string} userId - User ID
   * @param {Object} state - Zone state
   */
  updateTouristZoneState(userId, state) {
    if (!this.touristZoneStates) {
      this.touristZoneStates = new Map();
    }
    this.touristZoneStates.set(userId, state);
  }

  /**
   * Get all zones
   * @returns {Object} All zones
   */
  getAllZones() {
    return {
      restricted: this.restrictedZones,
      safe: this.safeZones
    };
  }

  /**
   * Get zone by ID
   * @param {string} zoneId - Zone ID
   * @returns {Object|null} Zone object
   */
  getZoneById(zoneId) {
    const allZones = [...this.restrictedZones, ...this.safeZones];
    return allZones.find(zone => zone.id === zoneId) || null;
  }

  /**
   * Update zone
   * @param {string} zoneId - Zone ID
   * @param {Object} updates - Updates to apply
   * @returns {Object|null} Updated zone
   */
  updateZone(zoneId, updates) {
    const zone = this.getZoneById(zoneId);
    if (!zone) return null;

    Object.assign(zone, updates);
    this.saveZonesToRedis();
    
    console.log(`📝 Updated zone: ${zone.name} (${zoneId})`);
    return zone;
  }

  /**
   * Delete zone
   * @param {string} zoneId - Zone ID
   * @returns {boolean} Success status
   */
  deleteZone(zoneId) {
    const zone = this.getZoneById(zoneId);
    if (!zone) return false;

    if (zone.type === 'restricted') {
      this.restrictedZones = this.restrictedZones.filter(z => z.id !== zoneId);
    } else {
      this.safeZones = this.safeZones.filter(z => z.id !== zoneId);
    }

    this.saveZonesToRedis();
    console.log(`🗑️ Deleted zone: ${zone.name} (${zoneId})`);
    return true;
  }

  /**
   * Save zones to Redis
   */
  async saveZonesToRedis() {
    try {
      // Only save to Redis if client is connected
      if (redisClient.isConnected && redisClient.isConnected()) {
        const zonesData = {
          restricted: this.restrictedZones,
          safe: this.safeZones,
          lastUpdated: new Date().toISOString()
        };
        
        await redisClient.set('geofencing_zones', JSON.stringify(zonesData));
      }
    } catch (error) {
      console.error('Error saving zones to Redis:', error);
    }
  }

  /**
   * Load zones from Redis
   */
  async loadZonesFromRedis() {
    try {
      // Only load from Redis if client is connected
      if (redisClient.isConnected && redisClient.isConnected()) {
        const zonesData = await redisClient.get('geofencing_zones');
        if (zonesData) {
          const parsed = JSON.parse(zonesData);
          this.restrictedZones = parsed.restricted || [];
          this.safeZones = parsed.safe || [];
          console.log(`📂 Loaded ${this.restrictedZones.length} restricted zones and ${this.safeZones.length} safe zones from Redis`);
        }
      }
    } catch (error) {
      console.error('Error loading zones from Redis:', error);
    }
  }

  /**
   * Get recent alerts
   * @param {number} limit - Number of alerts to return
   * @returns {Array} Recent alerts
   */
  getRecentAlerts(limit = 50) {
    return this.alertHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get alerts by user
   * @param {string} userId - User ID
   * @param {number} limit - Number of alerts to return
   * @returns {Array} User alerts
   */
  getUserAlerts(userId, limit = 20) {
    return this.alertHistory
      .filter(alert => alert.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }
}

module.exports = GeofencingService;
