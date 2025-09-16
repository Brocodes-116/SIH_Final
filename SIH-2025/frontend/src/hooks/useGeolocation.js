import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for managing geolocation
 * Provides location tracking with configurable options
 */
export const useGeolocation = (options = {}) => {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isWatching, setIsWatching] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null);

  // Default options
  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
    updateInterval: 5000, // 5 seconds
    minDistance: 10, // 10 meters minimum movement
    ...options
  };

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }, []);

  /**
   * Handle successful geolocation
   */
  const handleSuccess = useCallback((position) => {
    const { latitude, longitude, accuracy } = position.coords;
    const timestamp = new Date();

    // Check if we should update based on distance moved
    let shouldUpdate = true;
    if (lastPositionRef.current) {
      const distance = calculateDistance(
        lastPositionRef.current.lat,
        lastPositionRef.current.lon,
        latitude,
        longitude
      );
      shouldUpdate = distance >= defaultOptions.minDistance;
    }

    if (shouldUpdate) {
      const newPosition = {
        lat: latitude,
        lon: longitude,
        timestamp: timestamp.toISOString()
      };

      setPosition(newPosition);
      setAccuracy(accuracy);
      setLastUpdate(timestamp);
      setError(null);
      lastPositionRef.current = { lat: latitude, lon: longitude };
    }
  }, [calculateDistance, defaultOptions.minDistance]);

  /**
   * Handle geolocation error
   */
  const handleError = useCallback((error) => {
    let errorMessage = 'Unknown location error';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied. Please enable location permissions.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out.';
        break;
      default:
        errorMessage = 'An unknown error occurred while retrieving location.';
        break;
    }

    setError(errorMessage);
  }, []);

  /**
   * Start watching position
   */
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return false;
    }

    if (isWatching) {
      console.log('Already watching position');
      return true;
    }

    const options = {
      enableHighAccuracy: defaultOptions.enableHighAccuracy,
      timeout: defaultOptions.timeout,
      maximumAge: defaultOptions.maximumAge
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        options
      );
      setIsWatching(true);
      setError(null);
      return true;
    } catch (err) {
      setError('Failed to start location tracking');
      return false;
    }
  }, [isWatching, handleSuccess, handleError, defaultOptions]);

  /**
   * Stop watching position
   */
  const stopWatching = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  /**
   * Get current position once
   */
  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return Promise.reject(new Error('Geolocation not supported'));
    }

    const options = {
      enableHighAccuracy: defaultOptions.enableHighAccuracy,
      timeout: defaultOptions.timeout,
      maximumAge: defaultOptions.maximumAge
    };

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleSuccess(position);
          resolve(position);
        },
        (error) => {
          handleError(error);
          reject(error);
        },
        options
      );
    });
  }, [handleSuccess, handleError, defaultOptions]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopWatching();
    };
  }, [stopWatching]);

  return {
    position,
    error,
    isWatching,
    accuracy,
    lastUpdate,
    startWatching,
    stopWatching,
    getCurrentPosition
  };
};

export default useGeolocation;
