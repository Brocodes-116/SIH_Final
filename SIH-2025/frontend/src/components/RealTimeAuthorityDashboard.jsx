import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Icon } from 'leaflet';
import { QRCodeSVG } from 'qrcode.react';
import { touristAPI, sosAPI } from '../services/api';
import socketService from '../services/socketService';
import 'leaflet/dist/leaflet.css';

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
const RealTimeAuthorityDashboard = ({ user, onLogout }) => {
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
   * Initialize Socket.IO connection
   */
  const initializeSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication token not found. Please log in again.');
      return;
    }

    // Connect to Socket.IO
    socketService.connect(token);

    // Listen for location changes
    socketService.onLocationChanged((data) => {
      console.log('📍 Location changed:', data);
      updateTouristLocation(data);
    });

    // Listen for alerts
    socketService.onAlert((alertData) => {
      console.log('🚨 Alert received:', alertData);
      setAlerts(prev => [...prev, alertData]);
      
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
  }, []);

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
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching data from backend...');
      
      // Fetch tourists and SOS alerts in parallel
      const [touristsResponse, sosResponse] = await Promise.all([
        touristAPI.getAllTourists(),
        sosAPI.getAllSOS()
      ]);
      
      console.log('Tourists response:', touristsResponse);
      console.log('SOS response:', sosResponse);
      
      // Use real data from backend
      const realTourists = touristsResponse.tourists || [];
      const realSOSAlerts = sosResponse.alerts || [];

      console.log('Setting tourists:', realTourists.length);
      console.log('Setting SOS alerts:', realSOSAlerts.length);

      setTourists(realTourists);
      setSosAlerts(realSOSAlerts);
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data. Please try again.');
    } finally {
      setIsLoading(false);
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
  const handleSOSResponse = async (alertId) => {
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
        
        alert('✅ SOS Alert Responded Successfully!\n\nEmergency response team has been notified.');
        
        setTimeout(() => {
          console.log('Refreshing data after SOS deletion...');
          fetchData();
        }, 1000);
        
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
        
        alert('✅ SOS Alert Responded Successfully!\n\nEmergency response team has been notified.');
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
    fetchData();
    initializeSocket();
    requestNotificationPermission();

    // Check connection status periodically
    const connectionInterval = setInterval(() => {
      const status = socketService.getConnectionStatus();
      setConnectionStatus(status.isConnected ? 'connected' : 'disconnected');
    }, 1000);

    return () => {
      clearInterval(connectionInterval);
      socketService.disconnect();
    };
  }, [initializeSocket]);

  // Get geofence warnings (tourists outside safe zones)
  const geofenceWarnings = tourists.filter(tourist => tourist.geofenceStatus === 'outside');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100">
      {/* Loading State */}
      {isLoading && (
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
                            onClick={() => handleSOSResponse(alertId)}
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
                  onClick={() => {
                    tourists.forEach(tourist => {
                      const userId = tourist.userId || tourist.id;
                      if (!watchingUsers.has(userId)) {
                        startWatching(userId);
                      }
                    });
                  }}
                  className="w-full py-2 px-4 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  👁️ Watch All Tourists
                </button>
                <button 
                  onClick={() => {
                    watchingUsers.forEach(userId => stopWatching(userId));
                  }}
                  className="w-full py-2 px-4 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
                >
                  👁️‍🗨️ Stop Watching All
                </button>
                <button 
                  onClick={fetchData}
                  className="w-full py-2 px-4 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors"
                >
                  🔄 Refresh Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeAuthorityDashboard;
