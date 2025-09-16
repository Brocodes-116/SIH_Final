const LocationHistory = require('../models/LocationHistory');
const { sequelize } = require('../config/postgres');
const turf = require('@turf/turf');

/**
 * Location Analytics Service
 * Provides advanced analytics and insights from location data
 */
class LocationAnalyticsService {
  constructor() {
    this.anomalyThresholds = {
      speed: 50, // km/h
      accuracy: 1000, // meters
      distance: 10000, // meters
      timeGap: 3600 // seconds (1 hour)
    };
  }

  /**
   * Store location data with analytics
   * @param {Object} locationData - Location data
   * @returns {Object} Stored location with analytics
   */
  async storeLocationWithAnalytics(locationData) {
    try {
      // Check if PostgreSQL is available
      if (!sequelize || !sequelize.authenticate) {
        console.log('📊 PostgreSQL not available - skipping analytics storage');
        return { success: false, reason: 'PostgreSQL not available' };
      }

      const {
        userId,
        userName,
        lat,
        lon,
        accuracy,
        timestamp,
        deviceInfo,
        networkInfo,
        anonymized = false,
        retentionDays = 30
      } = locationData;

      // Get previous location for analysis
      const previousLocation = await LocationHistory.findOne({
        where: { userId },
        order: [['timestamp', 'DESC']]
      });

      // Calculate movement metrics
      let distanceFromPrevious = null;
      let timeFromPrevious = null;
      let speed = null;
      let heading = null;

      if (previousLocation) {
        const distance = this.calculateDistance(
          previousLocation.latitude,
          previousLocation.longitude,
          lat,
          lon
        );
        const timeDiff = (new Date(timestamp) - new Date(previousLocation.timestamp)) / 1000;
        
        distanceFromPrevious = distance;
        timeFromPrevious = timeDiff;
        speed = timeDiff > 0 ? (distance / timeDiff) * 3.6 : 0; // km/h
        heading = this.calculateBearing(
          previousLocation.latitude,
          previousLocation.longitude,
          lat,
          lon
        );
      }

      // Detect anomalies
      const isAnomalous = this.detectAnomalies({
        speed,
        accuracy,
        distanceFromPrevious,
        timeFromPrevious
      });

      // Calculate quality score
      const qualityScore = this.calculateQualityScore({
        accuracy,
        speed,
        timeFromPrevious,
        distanceFromPrevious
      });

      // Store location with analytics
      const locationRecord = await LocationHistory.create({
        userId,
        userName,
        latitude: lat,
        longitude: lon,
        accuracy,
        timestamp: new Date(timestamp),
        deviceInfo,
        networkInfo,
        anonymized,
        retentionDays,
        distanceFromPrevious,
        timeFromPrevious,
        speed,
        heading,
        qualityScore,
        isAnomalous
      });

      console.log(`📍 Location stored with analytics for user ${userName}`);
      return locationRecord;
    } catch (error) {
      console.error('Error storing location with analytics:', error);
      // Don't throw error to prevent breaking the main flow
      return { success: false, error: error.message };
    }
  }

  /**
   * Get movement path for a user
   * @param {string} userId - User ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Object} Movement path data
   */
  async getMovementPath(userId, startTime, endTime) {
    try {
      const pathData = await LocationHistory.getMovementPath(userId, startTime, endTime);
      
      // Convert to GeoJSON LineString
      const coordinates = pathData.map(point => [
        parseFloat(point.longitude),
        parseFloat(point.latitude)
      ]);

      const lineString = turf.lineString(coordinates);
      
      return {
        type: 'Feature',
        geometry: lineString.geometry,
        properties: {
          userId,
          startTime,
          endTime,
          pointCount: pathData.length,
          totalDistance: this.calculatePathDistance(coordinates)
        }
      };
    } catch (error) {
      console.error('Error getting movement path:', error);
      throw error;
    }
  }

  /**
   * Get heatmap data for a region
   * @param {Object} bounds - Bounding box {north, south, east, west}
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Array} Heatmap data points
   */
  async getHeatmapData(bounds, startTime, endTime) {
    try {
      const heatmapData = await LocationHistory.getHeatmapData(bounds, startTime, endTime);
      
      return heatmapData.map(point => ({
        lat: parseFloat(point.lat),
        lng: parseFloat(point.lng),
        density: parseInt(point.density)
      }));
    } catch (error) {
      console.error('Error getting heatmap data:', error);
      throw error;
    }
  }

  /**
   * Get location analytics for a user
   * @param {string} userId - User ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Object} Analytics data
   */
  async getUserAnalytics(userId, startTime, endTime) {
    try {
      const [analytics] = await LocationHistory.getAnalytics(userId, startTime, endTime);
      
      // Get movement patterns
      const movementPatterns = await this.analyzeMovementPatterns(userId, startTime, endTime);
      
      // Get frequent locations
      const frequentLocations = await this.getFrequentLocations(userId, startTime, endTime);
      
      return {
        ...analytics,
        movementPatterns,
        frequentLocations,
        timeRange: { startTime, endTime }
      };
    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw error;
    }
  }

  /**
   * Get locations within radius
   * @param {number} lat - Center latitude
   * @param {number} lng - Center longitude
   * @param {number} radius - Radius in meters
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Array} Locations within radius
   */
  async getLocationsInRadius(lat, lng, radius, startTime, endTime) {
    try {
      const locations = await LocationHistory.getLocationsInRadius(lat, lng, radius);
      
      // Filter by time range
      return locations.filter(loc => {
        const locTime = new Date(loc.timestamp);
        return locTime >= startTime && locTime <= endTime;
      });
    } catch (error) {
      console.error('Error getting locations in radius:', error);
      throw error;
    }
  }

  /**
   * Detect movement anomalies
   * @param {Object} metrics - Movement metrics
   * @returns {boolean} Is anomalous
   */
  detectAnomalies(metrics) {
    const { speed, accuracy, distanceFromPrevious, timeFromPrevious } = metrics;
    
    // Speed anomaly
    if (speed && speed > this.anomalyThresholds.speed) {
      return true;
    }
    
    // Accuracy anomaly
    if (accuracy && accuracy > this.anomalyThresholds.accuracy) {
      return true;
    }
    
    // Distance anomaly
    if (distanceFromPrevious && distanceFromPrevious > this.anomalyThresholds.distance) {
      return true;
    }
    
    // Time gap anomaly
    if (timeFromPrevious && timeFromPrevious > this.anomalyThresholds.timeGap) {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate quality score for location data
   * @param {Object} metrics - Location metrics
   * @returns {number} Quality score (0-1)
   */
  calculateQualityScore(metrics) {
    const { accuracy, speed, timeFromPrevious, distanceFromPrevious } = metrics;
    let score = 1.0;
    
    // Accuracy penalty
    if (accuracy) {
      if (accuracy > 100) score -= 0.3;
      else if (accuracy > 50) score -= 0.1;
    }
    
    // Speed penalty (unrealistic speeds)
    if (speed && speed > 200) {
      score -= 0.5;
    }
    
    // Time gap penalty
    if (timeFromPrevious && timeFromPrevious > 3600) {
      score -= 0.2;
    }
    
    // Distance penalty (unrealistic jumps)
    if (distanceFromPrevious && distanceFromPrevious > 50000) {
      score -= 0.4;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate distance between two points
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} Distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Calculate bearing between two points
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} Bearing in degrees
   */
  calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360;
  }

  /**
   * Calculate total distance of a path
   * @param {Array} coordinates - Array of [lng, lat] coordinates
   * @returns {number} Total distance in meters
   */
  calculatePathDistance(coordinates) {
    let totalDistance = 0;
    
    for (let i = 1; i < coordinates.length; i++) {
      const [lng1, lat1] = coordinates[i - 1];
      const [lng2, lat2] = coordinates[i];
      totalDistance += this.calculateDistance(lat1, lng1, lat2, lng2);
    }
    
    return totalDistance;
  }

  /**
   * Analyze movement patterns
   * @param {string} userId - User ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Object} Movement patterns
   */
  async analyzeMovementPatterns(userId, startTime, endTime) {
    try {
      const locations = await LocationHistory.findAll({
        where: {
          userId,
          timestamp: {
            [sequelize.Op.between]: [startTime, endTime]
          }
        },
        order: [['timestamp', 'ASC']]
      });

      if (locations.length < 2) {
        return { pattern: 'insufficient_data' };
      }

      // Calculate average speed
      const speeds = locations
        .filter(loc => loc.speed !== null)
        .map(loc => loc.speed);
      const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

      // Calculate movement consistency
      const distances = locations
        .filter(loc => loc.distanceFromPrevious !== null)
        .map(loc => loc.distanceFromPrevious);
      const avgDistance = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;

      // Determine pattern
      let pattern = 'normal';
      if (avgSpeed > 50) pattern = 'high_speed';
      else if (avgSpeed < 5) pattern = 'stationary';
      else if (avgDistance > 1000) pattern = 'erratic';

      return {
        pattern,
        avgSpeed,
        avgDistance,
        totalPoints: locations.length,
        timeSpan: (endTime - startTime) / (1000 * 60 * 60) // hours
      };
    } catch (error) {
      console.error('Error analyzing movement patterns:', error);
      return { pattern: 'error' };
    }
  }

  /**
   * Get frequent locations for a user
   * @param {string} userId - User ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Array} Frequent locations
   */
  async getFrequentLocations(userId, startTime, endTime) {
    try {
      const frequentLocations = await sequelize.query(
        `SELECT 
           ST_X(location) as lng,
           ST_Y(location) as lat,
           COUNT(*) as visit_count,
           AVG(accuracy) as avg_accuracy,
           MIN(timestamp) as first_visit,
           MAX(timestamp) as last_visit
         FROM location_history 
         WHERE userId = :userId 
           AND timestamp BETWEEN :startTime AND :endTime
         GROUP BY ST_SnapToGrid(location, 0.001)
         HAVING COUNT(*) > 3
         ORDER BY visit_count DESC
         LIMIT 10`,
        {
          replacements: { userId, startTime, endTime },
          type: sequelize.QueryTypes.SELECT
        }
      );

      return frequentLocations.map(loc => ({
        lat: parseFloat(loc.lat),
        lng: parseFloat(loc.lng),
        visitCount: parseInt(loc.visit_count),
        avgAccuracy: parseFloat(loc.avg_accuracy),
        firstVisit: loc.first_visit,
        lastVisit: loc.last_visit
      }));
    } catch (error) {
      console.error('Error getting frequent locations:', error);
      return [];
    }
  }

  /**
   * Clean up old location data
   * @param {number} retentionDays - Days to retain data
   * @returns {number} Number of records deleted
   */
  async cleanupOldData(retentionDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deletedCount = await LocationHistory.destroy({
        where: {
          timestamp: {
            [sequelize.Op.lt]: cutoffDate
          }
        }
      });

      console.log(`🧹 Cleaned up ${deletedCount} old location records`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      throw error;
    }
  }
}

module.exports = LocationAnalyticsService;
