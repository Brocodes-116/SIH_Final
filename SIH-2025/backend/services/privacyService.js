const redisClient = require('../config/redis');

/**
 * Privacy Service
 * Handles privacy controls, data retention, and user consent
 */
class PrivacyService {
  constructor() {
    this.dataRetentionDays = 30; // Default retention period
    this.consentRequired = true;
    this.anonymizationEnabled = true;
  }

  /**
   * Store user privacy preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - Privacy preferences
   */
  async storePrivacyPreferences(userId, preferences) {
    try {
      const privacyData = {
        userId,
        preferences: {
          locationSharing: preferences.locationSharing || false,
          dataRetention: preferences.dataRetention || this.dataRetentionDays,
          anonymization: preferences.anonymization || true,
          emergencyContacts: preferences.emergencyContacts || false,
          marketing: preferences.marketing || false,
          analytics: preferences.analytics || false
        },
        consentGiven: preferences.consentGiven || false,
        consentDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      await redisClient.hSet('privacy_preferences', userId, JSON.stringify(privacyData));
      console.log(`Privacy preferences stored for user: ${userId}`);
      return privacyData;
    } catch (error) {
      console.error('Error storing privacy preferences:', error);
      throw error;
    }
  }

  /**
   * Get user privacy preferences
   * @param {string} userId - User ID
   * @returns {Object|null} Privacy preferences
   */
  async getPrivacyPreferences(userId) {
    try {
      const data = await redisClient.hGet('privacy_preferences', userId);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting privacy preferences:', error);
      return null;
    }
  }

  /**
   * Check if user has given consent for location sharing
   * @param {string} userId - User ID
   * @returns {boolean} Consent status
   */
  async hasLocationConsent(userId) {
    try {
      const preferences = await this.getPrivacyPreferences(userId);
      return preferences?.preferences?.locationSharing === true && preferences?.consentGiven === true;
    } catch (error) {
      console.error('Error checking location consent:', error);
      return false;
    }
  }

  /**
   * Anonymize location data
   * @param {Object} locationData - Location data to anonymize
   * @param {Object} preferences - User privacy preferences
   * @returns {Object} Anonymized location data
   */
  anonymizeLocationData(locationData, preferences) {
    if (!preferences?.preferences?.anonymization) {
      return locationData;
    }

    // Round coordinates to reduce precision (approximately 100m accuracy)
    const anonymized = { ...locationData };
    
    if (anonymized.lat) {
      anonymized.lat = Math.round(anonymized.lat * 100) / 100;
    }
    
    if (anonymized.lon) {
      anonymized.lon = Math.round(anonymized.lon * 100) / 100;
    }

    // Remove or hash sensitive identifiers
    if (anonymized.userId) {
      anonymized.userId = this.hashUserId(anonymized.userId);
    }

    if (anonymized.userName) {
      anonymized.userName = this.anonymizeUserName(anonymized.userName);
    }

    return anonymized;
  }

  /**
   * Hash user ID for anonymization
   * @param {string} userId - User ID
   * @returns {string} Hashed user ID
   */
  hashUserId(userId) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
  }

  /**
   * Anonymize user name
   * @param {string} userName - User name
   * @returns {string} Anonymized user name
   */
  anonymizeUserName(userName) {
    if (!userName || userName.length < 2) return 'Anonymous';
    return userName.charAt(0) + '*'.repeat(userName.length - 1);
  }

  /**
   * Check if data should be retained based on user preferences
   * @param {string} userId - User ID
   * @param {Date} dataDate - Date when data was created
   * @returns {boolean} Whether data should be retained
   */
  async shouldRetainData(userId, dataDate) {
    try {
      const preferences = await this.getPrivacyPreferences(userId);
      const retentionDays = preferences?.preferences?.dataRetention || this.dataRetentionDays;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      return dataDate >= cutoffDate;
    } catch (error) {
      console.error('Error checking data retention:', error);
      return true; // Default to retaining data if error
    }
  }

  /**
   * Clean up expired data
   * @param {string} dataType - Type of data to clean up
   */
  async cleanupExpiredData(dataType = 'location_history') {
    try {
      const allData = await redisClient.hGetAll(dataType);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.dataRetentionDays);

      let cleanedCount = 0;
      
      for (const [key, value] of Object.entries(allData)) {
        try {
          const data = JSON.parse(value);
          const dataDate = new Date(data.timestamp || data.createdAt);
          
          if (dataDate < cutoffDate) {
            await redisClient.hDel(dataType, key);
            cleanedCount++;
          }
        } catch (parseError) {
          console.error(`Error parsing data for key ${key}:`, parseError);
        }
      }

      console.log(`Cleaned up ${cleanedCount} expired ${dataType} records`);
      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up expired data:', error);
      throw error;
    }
  }

  /**
   * Get data export for user (GDPR compliance)
   * @param {string} userId - User ID
   * @returns {Object} User data export
   */
  async getUserDataExport(userId) {
    try {
      const preferences = await this.getPrivacyPreferences(userId);
      const locationHistory = await this.getUserLocationHistory(userId);
      const sosHistory = await this.getUserSOSHistory(userId);

      return {
        userId,
        exportDate: new Date().toISOString(),
        privacyPreferences: preferences,
        locationHistory: locationHistory || [],
        sosHistory: sosHistory || [],
        dataRetentionPolicy: {
          retentionDays: this.dataRetentionDays,
          anonymizationEnabled: this.anonymizationEnabled
        }
      };
    } catch (error) {
      console.error('Error creating user data export:', error);
      throw error;
    }
  }

  /**
   * Delete all user data (GDPR right to be forgotten)
   * @param {string} userId - User ID
   * @returns {boolean} Success status
   */
  async deleteUserData(userId) {
    try {
      // Delete privacy preferences
      await redisClient.hDel('privacy_preferences', userId);
      
      // Delete location history
      await redisClient.hDel('location_history', userId);
      
      // Delete live position
      await redisClient.hDel('live_positions', userId);
      
      // Delete SOS history
      await redisClient.hDel('sos_history', userId);

      console.log(`All data deleted for user: ${userId}`);
      return true;
    } catch (error) {
      console.error('Error deleting user data:', error);
      return false;
    }
  }

  /**
   * Get user location history
   * @param {string} userId - User ID
   * @returns {Array} Location history
   */
  async getUserLocationHistory(userId) {
    try {
      const data = await redisClient.hGet('location_history', userId);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting user location history:', error);
      return [];
    }
  }

  /**
   * Get user SOS history
   * @param {string} userId - User ID
   * @returns {Array} SOS history
   */
  async getUserSOSHistory(userId) {
    try {
      const data = await redisClient.hGet('sos_history', userId);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting user SOS history:', error);
      return [];
    }
  }

  /**
   * Log privacy event
   * @param {string} userId - User ID
   * @param {string} event - Event type
   * @param {Object} details - Event details
   */
  async logPrivacyEvent(userId, event, details = {}) {
    try {
      const logEntry = {
        userId,
        event,
        details,
        timestamp: new Date().toISOString(),
        ip: details.ip || 'unknown'
      };

      await redisClient.lPush('privacy_logs', JSON.stringify(logEntry));
      
      // Keep only last 1000 log entries
      await redisClient.lTrim('privacy_logs', 0, 999);
      
      console.log(`Privacy event logged: ${event} for user ${userId}`);
    } catch (error) {
      console.error('Error logging privacy event:', error);
    }
  }

  /**
   * Get privacy statistics
   * @returns {Object} Privacy statistics
   */
  async getPrivacyStats() {
    try {
      const totalUsers = await redisClient.hLen('privacy_preferences');
      const locationConsent = await this.getConsentStats('locationSharing');
      const anonymizationEnabled = await this.getConsentStats('anonymization');
      
      return {
        totalUsers,
        locationConsent,
        anonymizationEnabled,
        dataRetentionDays: this.dataRetentionDays,
        lastCleanup: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting privacy stats:', error);
      return {};
    }
  }

  /**
   * Get consent statistics for a specific preference
   * @param {string} preference - Preference name
   * @returns {Object} Consent statistics
   */
  async getConsentStats(preference) {
    try {
      const allPreferences = await redisClient.hGetAll('privacy_preferences');
      let consented = 0;
      let total = 0;

      for (const [userId, data] of Object.entries(allPreferences)) {
        try {
          const prefs = JSON.parse(data);
          total++;
          if (prefs.preferences?.[preference] === true && prefs.consentGiven === true) {
            consented++;
          }
        } catch (parseError) {
          console.error(`Error parsing preferences for user ${userId}:`, parseError);
        }
      }

      return {
        consented,
        total,
        percentage: total > 0 ? Math.round((consented / total) * 100) : 0
      };
    } catch (error) {
      console.error('Error getting consent stats:', error);
      return { consented: 0, total: 0, percentage: 0 };
    }
  }
}

module.exports = PrivacyService;
