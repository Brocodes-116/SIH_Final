const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const PrivacyService = require('../services/privacyService');
const { validateInput, privacyValidation, body } = require('../middleware/security');

const privacyService = new PrivacyService();

// Privacy validation rules
const privacyValidationRules = [
  body('locationSharing').optional().isBoolean().withMessage('Location sharing must be boolean'),
  body('dataRetention').optional().isInt({ min: 1, max: 365 }).withMessage('Data retention must be between 1 and 365 days'),
  body('anonymization').optional().isBoolean().withMessage('Anonymization must be boolean'),
  body('emergencyContacts').optional().isBoolean().withMessage('Emergency contacts must be boolean'),
  body('marketing').optional().isBoolean().withMessage('Marketing must be boolean'),
  body('analytics').optional().isBoolean().withMessage('Analytics must be boolean'),
  body('consentGiven').isBoolean().withMessage('Consent given must be boolean')
];

/**
 * GET /api/privacy/preferences
 * Get user privacy preferences
 */
router.get('/preferences', auth, async (req, res) => {
  try {
    const preferences = await privacyService.getPrivacyPreferences(req.user.id);
    
    if (!preferences) {
      return res.json({
        success: true,
        preferences: {
          locationSharing: false,
          dataRetention: 30,
          anonymization: true,
          emergencyContacts: false,
          marketing: false,
          analytics: false,
          consentGiven: false
        }
      });
    }

    res.json({
      success: true,
      preferences: preferences.preferences,
      consentGiven: preferences.consentGiven,
      consentDate: preferences.consentDate,
      lastUpdated: preferences.lastUpdated
    });
  } catch (error) {
    console.error('Error getting privacy preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get privacy preferences'
    });
  }
});

/**
 * POST /api/privacy/preferences
 * Update user privacy preferences
 */
router.post('/preferences', auth, privacyValidationRules, validateInput, async (req, res) => {
  try {
    const preferences = await privacyService.storePrivacyPreferences(req.user.id, req.body);
    
    // Log privacy event
    await privacyService.logPrivacyEvent(req.user.id, 'preferences_updated', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      changes: req.body
    });

    res.json({
      success: true,
      message: 'Privacy preferences updated successfully',
      preferences: preferences.preferences
    });
  } catch (error) {
    console.error('Error updating privacy preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy preferences'
    });
  }
});

/**
 * GET /api/privacy/consent
 * Check if user has given consent for location sharing
 */
router.get('/consent', auth, async (req, res) => {
  try {
    const hasConsent = await privacyService.hasLocationConsent(req.user.id);
    
    res.json({
      success: true,
      hasConsent,
      message: hasConsent 
        ? 'Location sharing consent given' 
        : 'Location sharing consent required'
    });
  } catch (error) {
    console.error('Error checking consent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check consent status'
    });
  }
});

/**
 * POST /api/privacy/consent
 * Give or revoke consent for location sharing
 */
router.post('/consent', auth, async (req, res) => {
  try {
    const { consent } = req.body;
    
    if (typeof consent !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Consent must be true or false'
      });
    }

    const currentPreferences = await privacyService.getPrivacyPreferences(req.user.id) || {
      preferences: {
        locationSharing: false,
        dataRetention: 30,
        anonymization: true,
        emergencyContacts: false,
        marketing: false,
        analytics: false
      }
    };

    const updatedPreferences = {
      ...currentPreferences.preferences,
      locationSharing: consent,
      consentGiven: consent
    };

    await privacyService.storePrivacyPreferences(req.user.id, updatedPreferences);
    
    // Log consent event
    await privacyService.logPrivacyEvent(req.user.id, consent ? 'consent_given' : 'consent_revoked', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      consentType: 'location_sharing'
    });

    res.json({
      success: true,
      message: consent 
        ? 'Consent given successfully' 
        : 'Consent revoked successfully',
      hasConsent: consent
    });
  } catch (error) {
    console.error('Error updating consent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update consent'
    });
  }
});

/**
 * GET /api/privacy/export
 * Export user data (GDPR compliance)
 */
router.get('/export', auth, async (req, res) => {
  try {
    const userData = await privacyService.getUserDataExport(req.user.id);
    
    // Log data export
    await privacyService.logPrivacyEvent(req.user.id, 'data_export', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export user data'
    });
  }
});

/**
 * DELETE /api/privacy/data
 * Delete all user data (GDPR right to be forgotten)
 */
router.delete('/data', auth, async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation required. Send confirm: "DELETE_ALL_DATA" to proceed.'
      });
    }

    const success = await privacyService.deleteUserData(req.user.id);
    
    if (success) {
      // Log data deletion
      await privacyService.logPrivacyEvent(req.user.id, 'data_deleted', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'All user data has been deleted successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to delete user data'
      });
    }
  } catch (error) {
    console.error('Error deleting user data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user data'
    });
  }
});

/**
 * GET /api/privacy/stats
 * Get privacy statistics (authorities only)
 */
router.get('/stats', auth, async (req, res) => {
  try {
    // Only authorities can access privacy statistics
    if (req.user.role !== 'authority') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Authority role required.'
      });
    }

    const stats = await privacyService.getPrivacyStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting privacy stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get privacy statistics'
    });
  }
});

/**
 * POST /api/privacy/cleanup
 * Trigger data cleanup (authorities only)
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

    const { dataType } = req.body;
    const cleanedCount = await privacyService.cleanupExpiredData(dataType);
    
    // Log cleanup event
    await privacyService.logPrivacyEvent(req.user.id, 'data_cleanup', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      dataType: dataType || 'all',
      cleanedCount
    });

    res.json({
      success: true,
      message: `Data cleanup completed. ${cleanedCount} records cleaned.`,
      cleanedCount
    });
  } catch (error) {
    console.error('Error during data cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup data'
    });
  }
});

module.exports = router;
