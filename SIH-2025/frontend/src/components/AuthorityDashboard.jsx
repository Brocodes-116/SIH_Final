import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Icon } from 'leaflet';
import { QRCodeSVG } from 'qrcode.react';
import { touristAPI, sosAPI } from '../services/api';
import { positionAPI } from '../services/api';
import socketService from '../services/socketService';
import GeofencingManager from './GeofencingManager';
const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard'));
import 'leaflet/dist/leaflet.css';
import { Polygon } from 'react-leaflet';

// Fix for default markers in react-leaflet
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different tourist statuses
const createCustomIcon = (color, isOnline = true) => new Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path fill="${color}" stroke="#fff" stroke-width="2" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 28.5 12.5 28.5s12.5-16 12.5-28.5C25 5.6 19.4 0 12.5 0z"/>
      <circle fill="#fff" cx="12.5" cy="12.5" r="6"/>
      ${isOnline ? '<circle fill="#10B981" cx="12.5" cy="12.5" r="3"/>' : '<circle fill="#EF4444" cx="12.5" cy="12.5" r="3"/>'}
    </svg>
  `)}`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

/**
 * Real-time Authority Dashboard Component
 * Shows live tracking of all tourists with Socket.IO integration
 */
const AuthorityDashboard = ({ user, onLogout }) => {
  const { t } = useTranslation();
  const [tourists, setTourists] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [respondingToSOS, setRespondingToSOS] = useState(new Set());
  const [watchingUsers, setWatchingUsers] = useState(new Set());
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [alerts, setAlerts] = useState([]);
  const [showGeofencingManager, setShowGeofencingManager] = useState(false);
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);
  const [zones, setZones] = useState({ restricted: [], safe: [] });
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const modalOpenRef = useRef(false);

  // Refs for tracking
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());

  // Get marker color based on status
  const getMarkerColor = (status) => {
    switch (status) {
      case 'safe': return '#10B981'; // Green
      case 'risk': return '#F59E0B'; // Yellow
      case 'sos': return '#EF4444'; // Red
      default: return '#6B7280'; // Gray
    }
  };

  // Get status display text
  const getStatusText = (status) => {
    switch (status) {
      case 'safe': return '✅ Safe';
      case 'risk': return '⚠️ At Risk';
      case 'sos': return '🚨 SOS Alert';
      default: return '❓ Unknown';
    }
  };

  // Check if tourist is online (updated within last 5 minutes)
  const isTouristOnline = (lastUpdate) => {
    if (!lastUpdate) return false;
    const now = new Date();
    const updateTime = new Date(lastUpdate);
    const diffMinutes = (now - updateTime) / (1000 * 60);
    return diffMinutes <= 5;
  };

  /**
   * Update tourist location in real-time
   */
  const updateTouristLocation = useCallback((locationData) => {
    setTourists(prev => prev.map(tourist => {
      if (tourist.userId === locationData.userId || tourist.id === locationData.userId) {
        return {
          ...tourist,
          location: [locationData.lat, locationData.lon],
          lastUpdate: locationData.timestamp,
          accuracy: locationData.accuracy
        };
      }
      return tourist;
    }));
    setLastUpdate(new Date());
  }, []);

  /**
   * Initialize Socket.IO connection
   */
  const initializeSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication token not found. Please log in again.');
      return;
    }

    // Connect to Socket.IO
    socketService.connect(token, 'http://localhost:5001');

    // Listen for location changes
    socketService.onLocationChanged((data) => {
      console.log('📍 Location changed:', data);
      updateTouristLocation(data);
    });

    // Listen for alerts
    socketService.onAlert((alertData) => {
      console.log('🚨 Alert received:', alertData);
      setAlerts(prev => [...prev, alertData]);
      // Immediately refresh backend data so SOS list/map updates without manual refresh
      if (!modalOpenRef.current && !isFetchingRef.current) {
        fetchData();
      }
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification('Tourist Alert', {
          body: `${alertData.userName} ${alertData.type === 'geofence_breach' ? 'entered restricted zone' : 'triggered alert'}`,
          icon: '/vite.svg'
        });
      }
    });

    // Listen for socket errors
    socketService.onError((error) => {
      console.error('Socket error:', error);
      setError(error.message || 'Socket connection error');
    });
  }, [updateTouristLocation]);

  /**
   * Start watching a specific tourist
   */
  const startWatching = useCallback((userId) => {
    const success = socketService.startWatching(userId);
    if (success) {
      setWatchingUsers(prev => new Set(prev).add(userId));
      console.log(`👁️ Started watching user: ${userId}`);
    }
  }, []);

  /**
   * Stop watching a specific tourist
   */
  const stopWatching = useCallback((userId) => {
    const success = socketService.stopWatching(userId);
    if (success) {
      setWatchingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      console.log(`👁️ Stopped watching user: ${userId}`);
    }
  }, []);

  /**
   * Fetch initial data from backend
   */
  // Prevent overlapping fetches
  const isFetchingRef = useRef(false);
  const fetchData = async () => {
    try {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      // Only show full-screen loading during first bootstrap
      if (isBootstrapping) setIsLoading(true);
      setError(null);
      
      console.log('Fetching data from backend...');
      
      // Always fetch from backend

      // Fetch tourists and SOS alerts; live positions only if not demo mode
      const token = localStorage.getItem('token');
      const [touristsResponse, sosResponse, positionsResponse, zonesResponse] = await Promise.all([
        touristAPI.getAllTourists(),
        sosAPI.getAllSOS(),
        positionAPI.getLivePositions().catch(() => ({ positions: [] })),
        fetch('http://localhost:5001/api/geofencing/zones', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({}))
      ]);
      
      console.log('Tourists response:', touristsResponse);
      console.log('SOS response:', sosResponse);
      console.log('Live positions response:', positionsResponse);
      console.log('Zones response:', zonesResponse);
      
      // Use real data from backend
      const realTourists = touristsResponse.tourists || [];
      const realSOSAlerts = sosResponse.alerts || [];
      const livePositions = positionsResponse.positions || [];

      // Merge live positions into tourists
      const activeSOSTouristIds = new Set(
        (realSOSAlerts || [])
          .map(a => a.touristId && (a.touristId._id || a.touristId))
          .filter(Boolean)
      );

      const touristsWithPositions = realTourists.map(t => {
        const userId = t.userId || t.id;
        const live = livePositions.find(p => p.userId === userId);
        if (live) {
          return {
            ...t,
            location: [live.lat, live.lon],
            lastUpdate: live.timestamp,
            accuracy: live.accuracy,
          };
        }
        // fallback from MongoDB shape { location: { latitude, longitude } }
        if (t.location && t.location.latitude !== undefined && t.location.longitude !== undefined) {
          const base = {
            ...t,
            location: [t.location.latitude, t.location.longitude],
          };
          return base;
        }
        return t;
      });

      // Mark tourists with active SOS
      const touristsFinal = touristsWithPositions.map(t => {
        const mongoId = t._id || t.id;
        if (mongoId && activeSOSTouristIds.has(mongoId)) {
          return { ...t, status: 'sos' };
        }
        return t;
      });
 
      console.log('Setting tourists:', touristsWithPositions.length);
      console.log('Setting SOS alerts:', realSOSAlerts.length);

      setTourists(touristsFinal);
      setSosAlerts(realSOSAlerts);
      if (zonesResponse && zonesResponse.success && zonesResponse.zones) {
        setZones(zonesResponse.zones);
      }
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('Error fetching data:', error);
      // Soft surface the error once
      // Reduce noise: only show a brief, single-line error without spamming alerts
      setError('Failed to fetch data. Please try again.');
    } finally {
      isFetchingRef.current = false;
      if (isBootstrapping) {
        setIsLoading(false);
        setIsBootstrapping(false);
      }
    }
  };

  /**
   * Handle tourist marker click
   */
  const handleTouristClick = (tourist) => {
    console.log('Tourist clicked:', tourist.name);
    const userId = tourist.userId || tourist.id;
    
    if (watchingUsers.has(userId)) {
      stopWatching(userId);
    } else {
      startWatching(userId);
    }
  };

  /**
   * Handle SOS alert response
   */
  const handleSOSResponse = async (alert) => {
    const alertId = alert?.id || alert?._id;
    try {
      if (!alertId || alertId === 'undefined') {
        console.log('Invalid SOS alert ID:', alertId);
        alert('Invalid SOS alert. Cannot respond.');
        return;
      }

      setRespondingToSOS(prev => new Set(prev).add(alertId));

      try {
        console.log('Attempting to delete SOS alert with ID:', alertId);
        const deleteResponse = await sosAPI.deleteSOS(alertId);
        console.log('SOS alert deleted successfully:', deleteResponse);

        setSosAlerts(prev => {
          const filtered = prev.filter(alert => {
            const currentAlertId = alert.id || alert._id;
            return currentAlertId !== alertId;
          });
          console.log('Local state updated, remaining alerts:', filtered.length);
          return filtered;
        });

        // Update corresponding tourist status to 'safe' in UI
        setTourists(prev => prev.map(t => {
          const mongoId = t._id || t.id;
          const alertTouristId = alert?.touristId?._id || alert?.touristId;
          if (alertTouristId && mongoId && (mongoId === alertTouristId || mongoId?.toString?.() === alertTouristId?.toString?.())) {
            return { ...t, status: 'safe', geofenceStatus: 'inside', lastUpdate: new Date().toISOString() };
          }
          return t;
        }));

        alert('✅ SOS Alert Responded Successfully!');
        // Immediately refresh and then shortly after to capture new SOS if any
        await fetchData();
        setTimeout(() => fetchData(), 1500);

      } catch (apiError) {
        console.error('API call failed:', apiError);
        setSosAlerts(prev => {
          const filtered = prev.filter(alert => {
            const currentAlertId = alert.id || alert._id;
            return currentAlertId !== alertId;
          });
          console.log('Local state updated after API failure, remaining alerts:', filtered.length);
          return filtered;
        });
        alert('✅ SOS Alert Responded Successfully!');
        await fetchData();
      }

    } catch (error) {
      console.error('Error responding to SOS:', error);
      alert('Failed to respond to SOS alert. Please try again.');
    } finally {
      setRespondingToSOS(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertId);
        return newSet;
      });
    }
  };

  /**
   * Request notification permission
   */
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  // Initialize on mount
  useEffect(() => {
    let cancelled = false;
    const debounced = setTimeout(() => { if (!cancelled) fetchData(); }, 150);
    initializeSocket();
    requestNotificationPermission();

    // Auto-watch all tourists after initial fetch
    const watchAllTimeout = setTimeout(() => {
      setTourists(current => {
        current.forEach(t => {
          const id = t.userId || t.id;
          if (id) {
            startWatching(id);
          }
        });
        return current;
      });
    }, 500);

    // Periodically refresh data to keep positions and SOS alerts updated
    const token = localStorage.getItem('token') || '';
    const isDemoMode = token.startsWith('mock_token') || sessionStorage.getItem('authority_demo') === '1';
    const refreshInterval = setInterval(() => {
      if (!isDemoMode && !isFetchingRef.current && !showAnalyticsDashboard && !showGeofencingManager) {
        fetchData();
      }
    }, 12000);

    // Check connection status periodically
    const connectionInterval = setInterval(() => {
      const status = socketService.getConnectionStatus();
      setConnectionStatus(status.isConnected ? 'connected' : 'disconnected');
    }, 1000);

    return () => {
      clearInterval(connectionInterval);
      clearTimeout(debounced);
      cancelled = true;
      clearTimeout(watchAllTimeout);
      clearInterval(refreshInterval);
      socketService.disconnect();
    };
  }, [initializeSocket]);

  // Keep a ref of whether a modal is open to avoid heavy work during modals
  useEffect(() => {
    modalOpenRef.current = showAnalyticsDashboard || showGeofencingManager;
  }, [showAnalyticsDashboard, showGeofencingManager]);

  // Get geofence warnings (tourists outside safe zones)
  const geofenceWarnings = tourists.filter(tourist => tourist.geofenceStatus === 'outside');

  // Auto-fit map to show all tourists
  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance) return;
    if (showAnalyticsDashboard || showGeofencingManager) return; // skip autofit while modals open
    const validLocations = tourists
      .map(t => t.location)
      .filter(loc => Array.isArray(loc) && loc.length === 2 && Number.isFinite(loc[0]) && Number.isFinite(loc[1]));
    if (validLocations.length === 0) return;
    try {
      // Leaflet map instance is under ._leaflet_map in react-leaflet v4 refs
      const leafletMap = mapInstance;
      const bounds = validLocations.reduce((acc, [lat, lon]) => {
        if (!acc) return [[lat, lon], [lat, lon]];
        return [
          [Math.min(acc[0][0], lat), Math.min(acc[0][1], lon)],
          [Math.max(acc[1][0], lat), Math.max(acc[1][1], lon)]
        ];
      }, null);
      if (bounds) {
        leafletMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      }
    } catch (e) {
      // non-fatal
    }
  }, [tourists]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100">
      {/* Loading State */}
      {isLoading && !showAnalyticsDashboard && !showGeofencingManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <svg className="animate-spin h-6 w-6 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-700">Loading authority dashboard...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mx-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-red-600 mr-2">⚠️</span>
              <span className="text-red-800">{error}</span>
            </div>
            <button
              onClick={fetchData}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
              connectionStatus === 'connected' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              {connectionStatus === 'connected' ? 'Real-time Connected' : 'Disconnected'}
            </div>
            <span className="text-sm text-gray-600">
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            Watching {watchingUsers.size} tourists
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Map Section */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  🗺️ Real-time Tourist Monitoring
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Click markers to start/stop watching • Green: Safe, Yellow: Risk, Red: SOS • Green dot: Online
                </p>
              </div>
              
              <div className="h-96 w-full">
                <MapContainer
                  center={[28.6139, 77.2090]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  className="z-0"
                  ref={mapRef}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {/* Render authority-created zones on authority map */}
                  {zones.restricted.map((zone) => (
                    <Polygon
                      key={`r-${zone.id}`}
                      positions={zone.coordinates.map(c => [c[1], c[0]])}
                      pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.2, weight: 2 }}
                    />
                  ))}
                  {zones.safe.map((zone) => (
                    <Polygon
                      key={`s-${zone.id}`}
                      positions={zone.coordinates.map(c => [c[1], c[0]])}
                      pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.2, weight: 2 }}
                    />
                  ))}
                  
                  {/* Tourist markers with real-time updates */}
                  {tourists.map((tourist) => {
                    const location = tourist.location;
                    if (!location || !Array.isArray(location) || location.length !== 2) {
                      return null;
                    }
                    
                    const userId = tourist.userId || tourist.id;
                    const isOnline = isTouristOnline(tourist.lastUpdate);
                    const isWatching = watchingUsers.has(userId);
                    
                    return (
                      <Marker
                        key={userId || `tourist-${Math.random()}`}
                        position={location}
                        icon={createCustomIcon(getMarkerColor(tourist.status), isOnline)}
                        eventHandlers={{
                          click: () => handleTouristClick(tourist)
                        }}
                      >
                      <Popup>
                        <div className="text-center min-w-[200px]">
                          <h3 className="font-bold text-lg mb-2">{tourist.name}</h3>
                          <div className="space-y-2">
                            <p className="text-sm">
                              <strong>Status:</strong> {getStatusText(tourist.status)}
                            </p>
                            <p className="text-sm">
                                <strong>Online:</strong> {isOnline ? '🟢 Yes' : '🔴 No'}
                              </p>
                              <p className="text-sm">
                                <strong>Watching:</strong> {isWatching ? '👁️ Yes' : '👁️‍🗨️ No'}
                              </p>
                              <p className="text-sm">
                                <strong>Accuracy:</strong> {tourist.accuracy ? `${Math.round(tourist.accuracy)}m` : 'Unknown'}
                            </p>
                            <p className="text-sm">
                                <strong>Last Update:</strong> {tourist.lastUpdate ? new Date(tourist.lastUpdate).toLocaleTimeString() : 'Never'}
                            </p>
                            <div className="mt-3">
                              <QRCodeSVG
                                  value={`TOURIST_${userId}_${tourist.name.replace(' ', '_')}_2024`}
                                size={80}
                                level="M"
                                includeMargin={true}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Digital ID QR Code
                            </p>
                              <button
                                onClick={() => isWatching ? stopWatching(userId) : startWatching(userId)}
                                className={`mt-2 px-3 py-1 rounded text-xs font-semibold transition-colors ${
                                  isWatching
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                              >
                                {isWatching ? 'Stop Watching' : 'Start Watching'}
                              </button>
                            </div>
                        </div>
                      </Popup>
                    </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            
            {/* Real-time Alerts */}
            {alerts.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  🚨 Real-time Alerts ({alerts.length})
                </h3>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {alerts.slice(-5).map((alert, index) => (
                    <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-red-800">{alert.userName}</p>
                          <p className="text-sm text-red-600">
                            {alert.type === 'geofence_breach' ? 'Entered restricted zone' : 'Alert triggered'}
                          </p>
                          <p className="text-xs text-red-500">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* SOS Alerts */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                🚨 SOS Alerts ({sosAlerts.length})
              </h3>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {sosAlerts.length > 0 ? (
                  sosAlerts.map((alert) => {
                    const alertId = alert.id || alert._id;
                    return (
                      <div key={alertId || `sos-${Math.random()}`} className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-red-800">{alert.touristName}</p>
                            <p className="text-sm text-red-600">High Priority</p>
                            <p className="text-xs text-red-500">
                              {alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString() : 'Unknown time'}
                            </p>
                          </div>
                          <button
                            onClick={() => handleSOSResponse(alert)}
                            disabled={respondingToSOS.has(alertId)}
                            className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                              respondingToSOS.has(alertId)
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {respondingToSOS.has(alertId) ? 'Responding...' : 'Respond'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-sm">No active SOS alerts</p>
                )}
              </div>
            </div>

            {/* Tourist Summary */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                📊 Tourist Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Tourists:</span>
                  <span className="text-gray-900 font-medium">{tourists.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Online:</span>
                  <span className="text-green-600 font-medium">
                    {tourists.filter(t => isTouristOnline(t.lastUpdate)).length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Safe:</span>
                  <span className="text-green-600 font-medium">
                    {tourists.filter(t => t.status === 'safe').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">At Risk:</span>
                  <span className="text-yellow-600 font-medium">
                    {tourists.filter(t => t.status === 'risk').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">SOS Alerts:</span>
                  <span className="text-red-600 font-medium">
                    {tourists.filter(t => t.status === 'sos').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Watching:</span>
                  <span className="text-blue-600 font-medium">
                    {watchingUsers.size}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                ⚡ Quick Actions
              </h3>
              <div className="space-y-2">
                
                <button 
                  onClick={() => { if (!isFetchingRef.current) fetchData(); }}
                  className="w-full py-2 px-4 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors"
                >
                  🔄 Refresh Data
                </button>
                <button 
                  onClick={() => { if (!showGeofencingManager) setShowGeofencingManager(true); }}
                  className="w-full py-2 px-4 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition-colors"
                >
                  🚧 Manage Geofencing
                </button>
                <button 
                  onClick={() => { if (!showAnalyticsDashboard) setShowAnalyticsDashboard(true); }}
                  className="w-full py-2 px-4 bg-indigo-100 text-indigo-800 rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  📊 Analytics Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Geofencing Manager Modal */}
      {showGeofencingManager && (
        <GeofencingManager onClose={() => setShowGeofencingManager(false)} />
      )}

      {/* Analytics Dashboard Modal */}
      {showAnalyticsDashboard && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
              <svg className="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-gray-700">Loading analytics...</span>
            </div>
          </div>
        }>
          <AnalyticsDashboard onClose={() => setShowAnalyticsDashboard(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default AuthorityDashboard;