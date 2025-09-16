import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, useMapEvents } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * Geofencing Manager Component
 * Allows authorities to create and manage geofencing zones
 */
const GeofencingManager = ({ onClose }) => {
  const { t } = useTranslation();
  const [zones, setZones] = useState({ restricted: [], safe: [] });
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('zones');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newZone, setNewZone] = useState({
    name: '',
    type: 'restricted',
    alertLevel: 'high',
    description: '',
    center: null,
    radius: 1000,
    coordinates: []
  });
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]);
  const [mapZoom, setMapZoom] = useState(13);

  const API_BASE = 'http://localhost:5001';

  // Fetch zones and alerts
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch zones and alerts in parallel
      const [zonesResponse, alertsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/geofencing/zones`, { headers }),
        fetch(`${API_BASE}/api/geofencing/alerts?limit=20`, { headers })
      ]);

      if (!zonesResponse.ok || !alertsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const zonesData = await zonesResponse.json();
      const alertsData = await alertsResponse.json();

      if (zonesData.success) {
        setZones(zonesData.zones);
      }

      if (alertsData.success) {
        setAlerts(alertsData.alerts);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch geofencing data');
    } finally {
      setIsLoading(false);
    }
  };

  // Create new zone
  const createZone = async () => {
    try {
      if (!newZone.name.trim()) {
        setError('Zone name is required');
        return;
      }

      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      let endpoint = '';
      let body = {};

      if (newZone.type === 'circular') {
        endpoint = '/api/geofencing/zones/circular';
        // UI stores center as [lat,lng] for Leaflet; backend expects [lng,lat]
        const uiCenter = newZone.center; // [lat, lng]
        const backendCenter = uiCenter ? [uiCenter[1], uiCenter[0]] : null; // [lng, lat]
        body = {
          name: newZone.name,
          center: backendCenter,
          radius: newZone.radius,
          type: newZone.alertLevel === 'high' ? 'restricted' : 'safe',
          alertLevel: newZone.alertLevel,
          description: newZone.description
        };
      } else {
        endpoint = newZone.type === 'restricted' 
          ? '/api/geofencing/zones/restricted'
          : '/api/geofencing/zones/safe';
        // Coordinates drawn on map are stored as [lng,lat]; convert to backend expected if needed (already [lng,lat])
        body = {
          name: newZone.name,
          coordinates: newZone.coordinates,
          alertLevel: newZone.alertLevel,
          description: newZone.description
        };
      }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create zone');
      }

      const result = await response.json();
      if (result.success) {
        setShowCreateForm(false);
        setNewZone({
          name: '',
          type: 'restricted',
          alertLevel: 'high',
          description: '',
          center: null,
          radius: 1000,
          coordinates: []
        });
        fetchData(); // Refresh data locally
        // Also broadcast to other dashboards by nudging their polling via storage event
        try { localStorage.setItem('zones_last_updated', String(Date.now())); } catch {}
      }
    } catch (error) {
      console.error('Error creating zone:', error);
      setError(error.message || 'Failed to create zone');
    }
  };

  // Delete zone
  const deleteZone = async (zoneId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/geofencing/zones/${zoneId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete zone');
      }

      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error deleting zone:', error);
      setError(error.message || 'Failed to delete zone');
    }
  };

  // Map click hook
  const MapClicks = () => {
    useMapEvents({
      click: (e) => {
        if (!showCreateForm) return;
        const { lat, lng } = e.latlng;
        if (newZone.type === 'circular') {
          // Store for UI as [lat,lng] so Circle renders correctly
          setNewZone(prev => ({ ...prev, center: [lat, lng] }));
        } else {
          // Store polygon vertices as [lng,lat] for backend compatibility
          setNewZone(prev => ({
            ...prev,
            coordinates: [...prev.coordinates, [lng, lat]]
          }));
        }
      }
    });
    return null;
  };

  // Get zone color based on type and alert level
  const getZoneColor = (type, alertLevel) => {
    if (type === 'restricted') {
      return alertLevel === 'high' ? '#EF4444' : '#F59E0B';
    } else {
      return alertLevel === 'high' ? '#10B981' : '#34D399';
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
          <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-700">Loading geofencing data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Geofencing Manager</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('zones')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'zones'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Zones ({zones.restricted.length + zones.safe.length})
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'alerts'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Alerts ({alerts.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex">
          {/* Map */}
          <div className="flex-1">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {/* Visualize circular center for UI */}
              {newZone.type === 'circular' && newZone.center && (
                <>
                  <Marker position={newZone.center} />
                  <Circle center={newZone.center} radius={newZone.radius} />
                </>
              )}
              
              {/* Zone polygons */}
              {zones.restricted.map((zone) => (
                <Polygon
                  key={zone.id}
                  positions={zone.coordinates.map(coord => [coord[1], coord[0]])}
                  pathOptions={{
                    color: getZoneColor('restricted', zone.alertLevel),
                    fillColor: getZoneColor('restricted', zone.alertLevel),
                    fillOpacity: 0.3,
                    weight: 2
                  }}
                >
                  <Popup>
                    <div>
                      <h3 className="font-bold text-red-800">{zone.name}</h3>
                      <p className="text-sm">Type: Restricted Zone</p>
                      <p className="text-sm">Alert Level: {zone.alertLevel}</p>
                      <p className="text-sm">{zone.description}</p>
                    </div>
                  </Popup>
                </Polygon>
              ))}

              {zones.safe.map((zone) => (
                <Polygon
                  key={zone.id}
                  positions={zone.coordinates.map(coord => [coord[1], coord[0]])}
                  pathOptions={{
                    color: getZoneColor('safe', zone.alertLevel),
                    fillColor: getZoneColor('safe', zone.alertLevel),
                    fillOpacity: 0.3,
                    weight: 2
                  }}
                >
                  <Popup>
                    <div>
                      <h3 className="font-bold text-green-800">{zone.name}</h3>
                      <p className="text-sm">Type: Safe Zone</p>
                      <p className="text-sm">Alert Level: {zone.alertLevel}</p>
                      <p className="text-sm">{zone.description}</p>
                    </div>
                  </Popup>
                </Polygon>
              ))}

              {/* Click handler for zone creation */}
              <MapClicks />
            </MapContainer>
          </div>

          {/* Sidebar */}
          <div className="w-96 border-l border-gray-200 overflow-y-auto">
            {activeTab === 'zones' ? (
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Zones</h3>
                  <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    {showCreateForm ? 'Cancel' : 'Create Zone'}
                  </button>
                </div>

                {showCreateForm && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-3">Create New Zone</h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Zone name"
                        value={newZone.name}
                        onChange={(e) => setNewZone(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <select
                        value={newZone.type}
                        onChange={(e) => setNewZone(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="restricted">Restricted Zone</option>
                        <option value="safe">Safe Zone</option>
                        <option value="circular">Circular Zone</option>
                      </select>
                      <select
                        value={newZone.alertLevel}
                        onChange={(e) => setNewZone(prev => ({ ...prev, alertLevel: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="high">High Alert</option>
                        <option value="medium">Medium Alert</option>
                        <option value="low">Low Alert</option>
                      </select>
                      <textarea
                        placeholder="Description"
                        value={newZone.description}
                        onChange={(e) => setNewZone(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        rows="2"
                      />
                      {newZone.type === 'circular' && (
                        <input
                          type="number"
                          placeholder="Radius (meters)"
                          value={newZone.radius}
                          onChange={(e) => setNewZone(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      )}
                      <div className="flex space-x-2">
                        <button
                          onClick={createZone}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => setShowCreateForm(false)}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Zones List */}
                <div className="space-y-3">
                  {[...zones.restricted, ...zones.safe].map((zone) => (
                    <div key={zone.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{zone.name}</h4>
                          <p className="text-sm text-gray-600 capitalize">
                            {zone.type} Zone • {zone.alertLevel} Alert
                          </p>
                          <p className="text-xs text-gray-500">{zone.description}</p>
                          <p className="text-xs text-gray-400">
                            Created: {formatTime(zone.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteZone(zone.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Alerts</h3>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{alert.userName}</h4>
                          <p className="text-sm text-gray-600 capitalize">
                            {alert.type.replace('_', ' ')} • {alert.alertLevel} Alert
                          </p>
                          {alert.zoneName && (
                            <p className="text-sm text-gray-600">Zone: {alert.zoneName}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {formatTime(alert.timestamp)}
                          </p>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${
                          alert.alertLevel === 'high' ? 'bg-red-500' :
                          alert.alertLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border-t border-red-200">
            <div className="flex items-center">
              <span className="text-red-600 mr-2">⚠️</span>
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeofencingManager;
