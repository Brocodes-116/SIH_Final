import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import socketService from '../services/socketService';
import useGeolocation from '../hooks/useGeolocation';
import PrivacySettings from './PrivacySettings';

/**
 * Tourist Location Tracker Component
 * Handles real-time location sharing with geolocation API and Socket.IO
 */
const Tracker = ({ user, onError }) => {
  const { t } = useTranslation();
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isTracking, setIsTracking] = useState(false);
  const [zoneStatus, setZoneStatus] = useState({
    isInRestrictedZone: false,
    isInSafeZone: false,
    restrictedZones: [],
    safeZones: []
  });
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [hasLocationConsent, setHasLocationConsent] = useState(false);

  // Use custom geolocation hook
  const {
    position: currentPosition,
    error: locationError,
    isWatching,
    accuracy,
    lastUpdate: lastUpdateTime,
    startWatching,
    stopWatching
  } = useGeolocation({
    updateInterval: 5000,
    minDistance: 10
  });

  /**
   * Send position update via Socket.IO
   */
  const sendPositionUpdate = useCallback((position) => {
    if (!user?.id) return false;

    const positionData = {
      userId: user.id,
      lat: position.lat,
      lon: position.lon,
      accuracy: accuracy || 0,
      timestamp: position.timestamp
    };

    return socketService.sendPositionUpdate(positionData);
  }, [user?.id, accuracy]);

  /**
   * Check location consent
   */
  const checkLocationConsent = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/privacy/consent', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHasLocationConsent(data.hasConsent);
      } else {
        // If consent endpoint is not available, allow tracking to proceed
        setHasLocationConsent(true);
      }
    } catch (error) {
      console.error('Error checking consent:', error);
      // Fail open in dev to allow tracking
      setHasLocationConsent(true);
    }
  }, []);

  /**
   * Start location tracking
   */
  const startTracking = useCallback(() => {
    if (!hasLocationConsent) {
      onError?.('Location sharing consent required. Please check your privacy settings.');
      setShowPrivacySettings(true);
      return;
    }

    // Connect to Socket.IO if not already connected
    if (!socketService.getConnectionStatus().isConnected) {
      const token = localStorage.getItem('token');
      if (!token) {
        onError?.('Authentication token not found. Please log in again.');
        return;
      }
      socketService.connect(token);
    }

    const success = startWatching();
    if (success) {
      setIsTracking(true);
      console.log('📍 Location tracking started');
    }
  }, [startWatching, onError, hasLocationConsent]);

  /**
   * Stop location tracking
   */
  const stopTracking = useCallback(() => {
    stopWatching();
    setIsTracking(false);
    console.log('📍 Location tracking stopped');
  }, [stopWatching]);

  /**
   * Send position update when position changes
   */
  useEffect(() => {
    if (currentPosition && isTracking) {
      const success = sendPositionUpdate(currentPosition);
      if (!success) {
        onError?.('Failed to send position update. Please check your connection.');
      }
    }
  }, [currentPosition, isTracking, sendPositionUpdate, onError]);

  /**
   * Setup Socket.IO event listeners
   */
  useEffect(() => {
    // Listen for connection status changes
    const checkConnection = () => {
      const status = socketService.getConnectionStatus();
      setConnectionStatus(status.isConnected ? 'connected' : 'disconnected');
    };

    // Check connection status periodically
    const connectionInterval = setInterval(checkConnection, 1000);

    // Listen for socket errors
    socketService.onError((error) => {
      onError?.(error.message || 'Socket connection error');
    });

    // Listen for zone status updates
    socketService.socket?.on('zone_status', (data) => {
      console.log('📍 Zone status update:', data);
      setZoneStatus(data);
    });

    return () => {
      clearInterval(connectionInterval);
    };
  }, [onError]);

  // Check consent on mount
  useEffect(() => {
    checkLocationConsent();
  }, [checkLocationConsent]);

  /**
   * Format time for display
   */
  const formatTime = (date) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString();
  };

  /**
   * Format accuracy for display
   */
  const formatAccuracy = (acc) => {
    if (!acc) return 'Unknown';
    return `${Math.round(acc)}m`;
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {t('Location Tracker')}
        </h2>
        <p className="text-gray-600">
          {t('Share your location with authorities for safety')}
        </p>
      </div>

      {/* Connection Status */}
      <div className="mb-4">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
          connectionStatus === 'connected' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${
            connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          {connectionStatus === 'connected' ? t('Connected') : t('Disconnected')}
        </div>
      </div>

      {/* Current Position Display */}
      {currentPosition && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-2">{t('Current Position')}</h3>
          <div className="text-sm text-gray-600">
            <p><strong>{t('Latitude')}:</strong> {currentPosition.lat.toFixed(6)}</p>
            <p><strong>{t('Longitude')}:</strong> {currentPosition.lon.toFixed(6)}</p>
            <p><strong>{t('Accuracy')}:</strong> {formatAccuracy(accuracy)}</p>
            <p><strong>{t('Last Update')}:</strong> {formatTime(lastUpdateTime)}</p>
          </div>
        </div>
      )}

      {/* Zone Status Display */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-700 mb-2">{t('Zone Status')}</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{t('Restricted Zone')}:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              zoneStatus.isInRestrictedZone 
                ? 'bg-red-100 text-red-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {zoneStatus.isInRestrictedZone ? t('Inside') : t('Outside')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{t('Safe Zone')}:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              zoneStatus.isInSafeZone 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {zoneStatus.isInSafeZone ? t('Inside') : t('Outside')}
            </span>
          </div>
          {zoneStatus.restrictedZones.length > 0 && (
            <div className="text-xs text-red-600">
              <strong>{t('Restricted Zones')}:</strong> {zoneStatus.restrictedZones.map(z => z.name).join(', ')}
            </div>
          )}
          {zoneStatus.safeZones.length > 0 && (
            <div className="text-xs text-green-600">
              <strong>{t('Safe Zones')}:</strong> {zoneStatus.safeZones.map(z => z.name).join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {locationError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <div className="text-red-500 mr-2">⚠️</div>
            <p className="text-red-700 text-sm">{locationError}</p>
          </div>
        </div>
      )}

        {/* Control Buttons */}
        <div className="space-y-3">
          {!isTracking ? (
            <button
              onClick={startTracking}
              disabled={!user || !hasLocationConsent}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              {!hasLocationConsent ? t('Consent Required') : t('Start Sharing Location')}
            </button>
          ) : (
            <button
              onClick={stopTracking}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              {t('Stop Sharing Location')}
            </button>
          )}

          {/* Privacy Settings Button */}
          <button
            onClick={() => setShowPrivacySettings(true)}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition duration-200"
          >
            🔒 {t('Privacy Settings')}
          </button>

          {/* Info Text */}
          <div className="text-xs text-gray-500 text-center">
            <p>{t('Location updates every 5 seconds or when you move 10+ meters')}</p>
            <p>{t('Your location is only shared with authorized authorities')}</p>
            {!hasLocationConsent && (
              <p className="text-red-500 font-medium">{t('Location sharing consent required')}</p>
            )}
          </div>
        </div>

        {/* Privacy Settings Modal */}
        {showPrivacySettings && (
          <PrivacySettings onClose={() => setShowPrivacySettings(false)} />
        )}
    </div>
  );
};

export default Tracker;
