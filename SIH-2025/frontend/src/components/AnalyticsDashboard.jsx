import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { touristAPI } from '../services/api';

// Fix for default markers in react-leaflet
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * Analytics Dashboard Component
 * Provides advanced analytics and insights for authorities
 */
const AnalyticsDashboard = ({ onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    stats: {},
    heatmap: [],
    paths: [],
    users: []
  });
  const [filters, setFilters] = useState({
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    endTime: new Date().toISOString().slice(0, 16),
    userId: '',
    radius: 1000
  });
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]);
  const [mapZoom, setMapZoom] = useState(13);
  const [tourists, setTourists] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const isDemoMode = (token || '').startsWith('mock_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const startTime = new Date(filters.startTime).toISOString();
      const endTime = new Date(filters.endTime).toISOString();

      // Fetch different data based on active tab
      const requests = [];

      if (activeTab === 'overview') {
        requests.push(
          fetch(`http://localhost:5000/api/analytics/stats?startTime=${startTime}&endTime=${endTime}`, { headers })
        );
      } else if (activeTab === 'heatmap') {
        requests.push(
          fetch(`http://localhost:5000/api/analytics/heatmap?north=28.7&south=28.5&east=77.3&west=77.1&startTime=${startTime}&endTime=${endTime}`, { headers })
        );
      } else if (activeTab === 'paths' && filters.userId) {
        requests.push(
          fetch(`http://localhost:5000/api/analytics/path/${filters.userId}?startTime=${startTime}&endTime=${endTime}`, { headers })
        );
      }

      if (isDemoMode) {
        setData(prev => ({ ...prev, stats: {}, heatmap: [], paths: [] }));
        setError('Analytics are disabled in demo mode. Use real authority login to view analytics.');
        return;
      }

      const responses = await Promise.all(requests);
      const results = await Promise.all(responses.map(r => r.json()));

      if (activeTab === 'overview') {
        setData(prev => ({ ...prev, stats: results[0].stats }));
      } else if (activeTab === 'heatmap') {
        setData(prev => ({ ...prev, heatmap: results[0].heatmap }));
      } else if (activeTab === 'paths') {
        setData(prev => ({ ...prev, paths: results[0].path ? [results[0].path] : [] }));
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch tourists once for suggestions
  useEffect(() => {
    const loadTourists = async () => {
      try {
        const resp = await touristAPI.getAllTourists();
        setTourists(resp.tourists || []);
      } catch (e) {
        // non-fatal
      }
    };
    loadTourists();
  }, []);

  const filteredSuggestions = useMemo(() => {
    const q = (filters.userId || '').toLowerCase().trim();
    if (!q) return [];
    return (tourists || [])
      .filter(t => (t.name || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [filters.userId, tourists]);

  const handleSelectSuggestion = (tourist) => {
    const userId = tourist.userId || tourist.id || tourist._id;
    setFilters(prev => ({ ...prev, userId: userId }));
    // Center map to tourist location if available
    if (tourist.location && typeof tourist.location.latitude === 'number' && typeof tourist.location.longitude === 'number') {
      setMapCenter([tourist.location.latitude, tourist.location.longitude]);
      setMapZoom(14);
    }
    setShowSuggestions(false);
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Format number with commas
  const formatNumber = (num) => {
    return num ? num.toLocaleString() : '0';
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Get heatmap color based on density
  const getHeatmapColor = (density) => {
    if (density > 50) return '#ff0000';
    if (density > 20) return '#ff8800';
    if (density > 10) return '#ffff00';
    if (density > 5) return '#88ff00';
    return '#00ff00';
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [activeTab, filters.startTime, filters.endTime, filters.userId]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
          <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-700">Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {['overview', 'heatmap', 'paths', 'users'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium capitalize ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={filters.startTime}
                onChange={(e) => handleFilterChange('startTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="datetime-local"
                value={filters.endTime}
                onChange={(e) => handleFilterChange('endTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID / Search Name</label>
              <input
                type="text"
                value={filters.userId}
                onChange={(e) => { handleFilterChange('userId', e.target.value); setShowSuggestions(true); }}
                placeholder="Type name to search or paste user ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                  {filteredSuggestions.map((t) => (
                    <button
                      key={(t.userId && (t.userId._id || t.userId)) || t._id || t.id}
                      onClick={() => handleSelectSuggestion(t)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-500">ID: {(t.userId && (t.userId._id || t.userId)) || t._id || t.id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchAnalyticsData}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium"
              >
                Refresh Data
              </button>
            </div>
          </div>
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
              
              {/* Heatmap markers */}
              {activeTab === 'heatmap' && data.heatmap.map((point, index) => (
                <Circle
                  key={index}
                  center={[point.lat, point.lng]}
                  radius={50}
                  pathOptions={{
                    color: getHeatmapColor(point.density),
                    fillColor: getHeatmapColor(point.density),
                    fillOpacity: 0.6,
                    weight: 1
                  }}
                >
                  <Popup>
                    <div>
                      <p><strong>Density:</strong> {point.density}</p>
                      <p><strong>Location:</strong> {point.lat.toFixed(4)}, {point.lng.toFixed(4)}</p>
                    </div>
                  </Popup>
                </Circle>
              ))}

              {/* Movement paths */}
              {activeTab === 'paths' && data.paths.map((path, index) => {
                if (!path.geometry || !path.geometry.coordinates) return null;
                
                const coordinates = path.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                
                return (
                  <Polyline
                    key={index}
                    positions={coordinates}
                    pathOptions={{
                      color: '#3b82f6',
                      weight: 3,
                      opacity: 0.8
                    }}
                  >
                    <Popup>
                      <div>
                        <p><strong>User ID:</strong> {path.properties.userId}</p>
                        <p><strong>Points:</strong> {path.properties.pointCount}</p>
                        <p><strong>Distance:</strong> {path.properties.totalDistance?.toFixed(2)}m</p>
                      </div>
                    </Popup>
                  </Polyline>
                );
              })}
            </MapContainer>
          </div>

          {/* Sidebar */}
          <div className="w-96 border-l border-gray-200 overflow-y-auto">
            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Overview Statistics</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatNumber(data.stats.total_locations)}
                      </div>
                      <div className="text-sm text-blue-800">Total Locations</div>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {formatNumber(data.stats.unique_users)}
                      </div>
                      <div className="text-sm text-green-800">Unique Users</div>
                    </div>
                    
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {data.stats.avg_accuracy ? data.stats.avg_accuracy.toFixed(1) : '0'}m
                      </div>
                      <div className="text-sm text-yellow-800">Avg Accuracy</div>
                    </div>
                    
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {formatNumber(data.stats.anomalous_count)}
                      </div>
                      <div className="text-sm text-red-800">Anomalous Points</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Movement Statistics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Average Speed:</span>
                        <span className="font-medium">
                          {data.stats.avg_speed ? data.stats.avg_speed.toFixed(1) : '0'} km/h
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Emergency Count:</span>
                        <span className="font-medium text-red-600">
                          {formatNumber(data.stats.emergency_count)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'heatmap' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Location Heatmap</h3>
                  
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600">
                      Showing {data.heatmap.length} heatmap points
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Density Legend</h4>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-red-500 rounded"></div>
                          <span className="text-sm">High (50+)</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-orange-500 rounded"></div>
                          <span className="text-sm">Medium (20-49)</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                          <span className="text-sm">Low (10-19)</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-green-500 rounded"></div>
                          <span className="text-sm">Very Low (5-9)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'paths' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Movement Paths</h3>
                  
                  {data.paths.length > 0 ? (
                    <div className="space-y-4">
                      {data.paths.map((path, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900">Path {index + 1}</h4>
                          <div className="mt-2 space-y-1 text-sm text-gray-600">
                            <div>User ID: {path.properties.userId}</div>
                            <div>Points: {path.properties.pointCount}</div>
                            <div>Distance: {path.properties.totalDistance?.toFixed(2)}m</div>
                            <div>Time Range: {formatDate(filters.startTime)} - {formatDate(filters.endTime)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <p>No movement paths found</p>
                      <p className="text-sm">Enter a User ID and select a time range</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'users' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">User Analytics</h3>
                  <div className="text-center text-gray-500 py-8">
                    <p>User analytics coming soon</p>
                    <p className="text-sm">This will show individual user statistics and patterns</p>
                  </div>
                </div>
              )}
            </div>
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

export default AnalyticsDashboard;
