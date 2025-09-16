import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import { Icon } from 'leaflet';
import { QRCodeSVG } from 'qrcode.react';
import { touristAPI, sosAPI } from '../services/api';
import Tracker from './Tracker';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map events and geofencing
function MapEvents({ onLocationUpdate, geofenceCenter, geofenceRadius }) {
  useMapEvents({
    click: (e) => {
      // Update geofence center when map is clicked
      onLocationUpdate(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

const TouristDashboard = ({ user, onLogout }) => {
  const { t } = useTranslation();
  // State for tourist location
  const [touristLocation, setTouristLocation] = useState([28.6139, 77.2090]); // Default to Delhi
  const [geofenceCenter, setGeofenceCenter] = useState([28.6139, 77.2090]);
  const [geofenceRadius, setGeofenceRadius] = useState(1000); // 1km radius
  const [isInGeofence, setIsInGeofence] = useState(true);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [touristProfile, setTouristProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tourist ID for QR code
  const touristId = touristProfile?.userId || user?.id || "TOURIST_12345_DELHI_2024";

  // Get current location and fetch/create tourist profile
  useEffect(() => {
    const initializeTouristProfile = async () => {
      try {
        setIsLoading(true);
        
        // Get current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              setTouristLocation([latitude, longitude]);
              setGeofenceCenter([latitude, longitude]);
              
              // Get or create tourist profile
              await getOrCreateTouristProfile(latitude, longitude);
            },
            async (error) => {
              console.log('Geolocation error:', error);
              // Get or create profile with default location
              await getOrCreateTouristProfile(28.6139, 77.2090);
            }
          );
        } else {
          // Get or create profile with default location
          await getOrCreateTouristProfile(28.6139, 77.2090);
        }
      } catch (error) {
        console.error('Error initializing tourist profile:', error);
        setError('Failed to initialize tourist profile');
      } finally {
        setIsLoading(false);
      }
    };

    initializeTouristProfile();
  }, [user]);

  // Real-time location updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            setTouristLocation([latitude, longitude]);
            
            // Update tourist location in backend
            if (touristProfile && touristProfile._id) {
              try {
                await touristAPI.updateLocation(touristProfile._id, {
                  latitude,
                  longitude
                });
                console.log('Location updated in real-time');
              } catch (error) {
                console.error('Error updating location:', error);
              }
            }
          },
          (error) => {
            console.log('Real-time geolocation error:', error);
          }
        );
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [touristProfile]);

  // Get or create tourist profile
  const getOrCreateTouristProfile = async (latitude, longitude) => {
    try {
      // First, try to get existing tourist profile
      const touristsResponse = await touristAPI.getAllTourists();
      const existingTourist = touristsResponse.tourists.find(t => {
        const populated = t.userId && typeof t.userId === 'object';
        const touristUserId = populated ? t.userId._id : t.userId;
        return touristUserId === user.id;
      });
      
      if (existingTourist) {
        // Update existing tourist location
        const updatedTourist = await touristAPI.updateLocation(existingTourist._id, {
          latitude,
          longitude
        });
        setTouristProfile(updatedTourist.tourist);
        console.log('Tourist profile updated:', updatedTourist.tourist);
      } else {
        // Create new tourist profile only if it doesn't exist
        const touristData = {
          userId: user.id,
          name: user.name,
          email: user.email,
          location: {
            latitude,
            longitude
          },
          status: 'safe',
          geofenceStatus: 'inside',
          emergencyContacts: ['+91-9876543210', '+91-9876543211']
        };

        const response = await touristAPI.createTourist(touristData);
        setTouristProfile(response.tourist);
        console.log('Tourist profile created:', response.tourist);
      }
    } catch (error) {
      console.error('Error managing tourist profile:', error);
      // If API fails, set a mock profile for now
      setTouristProfile({
        userId: user.id,
        name: user.name,
        email: user.email,
        location: { latitude, longitude },
        status: 'safe'
      });
    }
  };

  // Check if tourist is within geofence
  useEffect(() => {
    const distance = calculateDistance(
      touristLocation[0], touristLocation[1],
      geofenceCenter[0], geofenceCenter[1]
    );
    setIsInGeofence(distance <= geofenceRadius / 1000); // Convert meters to km
  }, [touristLocation, geofenceCenter, geofenceRadius]);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Handle location update from map click
  const handleLocationUpdate = (lat, lng) => {
    setGeofenceCenter([lat, lng]);
  };

  // Emergency SOS button handler
  const handleSOS = async () => {
    try {
      setSosTriggered(true);
      
      const sosData = {
        touristId: touristProfile?.userId || user?.id,
        touristName: user?.name || 'Unknown Tourist',
        location: {
          latitude: touristLocation[0],
          longitude: touristLocation[1]
        },
        priority: 'high',
        description: 'Emergency SOS triggered by tourist'
      };

      // Call backend SOS API
      const response = await sosAPI.createSOS(sosData);
      
      console.log('🚨 EMERGENCY SOS TRIGGERED!');
      console.log('SOS Alert ID:', response.sos?._id);
      alert('🚨 Emergency SOS Alert Sent Successfully!');
      
    } catch (error) {
      console.error('SOS API error:', error);
      const msg = error?.response?.data?.message || 'Failed to send SOS alert. Please try again.';
      alert(`❌ ${msg}`);
    } finally {
      // Reset SOS button after 5 seconds
      setTimeout(() => {
        setSosTriggered(false);
      }, 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Loading State */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-700">Loading your safety dashboard...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mx-4 mt-4">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">⚠️</span>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}
      {/* Removed duplicate header and logout button. Only main navbar remains. */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Map Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  🗺️ Interactive Safety Map
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Click on map to set geofence center • Green circle shows safe zone
                </p>
              </div>
              
              <div className="h-96 w-full">
                <MapContainer
                  center={touristLocation}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  className="z-0"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  
                  {/* Tourist current location marker */}
                  <Marker position={touristLocation}>
                    <Popup>
                      <div className="text-center">
                        <strong>📍 {t('dashboard.yourLocation')}</strong><br/>
                        Lat: {touristLocation[0].toFixed(4)}<br/>
                        Lng: {touristLocation[1].toFixed(4)}
                      </div>
                    </Popup>
                  </Marker>

                  {/* Geofence circle */}
                  <Circle
                    center={geofenceCenter}
                    radius={geofenceRadius}
                    pathOptions={{
                      color: isInGeofence ? '#10B981' : '#EF4444',
                      fillColor: isInGeofence ? '#10B981' : '#EF4444',
                      fillOpacity: 0.2,
                      weight: 2
                    }}
                  >
                    <Popup>
                      <div className="text-center">
                        <strong>🛡️ {t('dashboard.safetyZone')}</strong><br/>
                        {t('dashboard.radius')}: {(geofenceRadius/1000).toFixed(1)} km<br/>
                        {t('dashboard.status')}: {isInGeofence ? t('dashboard.inside') : t('dashboard.outside')}
                      </div>
                    </Popup>
                  </Circle>

                  {/* Map events handler */}
                  <MapEvents 
                    onLocationUpdate={handleLocationUpdate}
                    geofenceCenter={geofenceCenter}
                    geofenceRadius={geofenceRadius}
                  />
                </MapContainer>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            
            {/* Location Tracker */}
            <Tracker user={user} onError={setError} />
            
            {/* Emergency SOS Button */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                🚨 SOS
              </h3>
              <button
                onClick={handleSOS}
                disabled={sosTriggered}
                className={`w-full py-4 px-6 rounded-lg font-bold text-white text-lg transition-all duration-300 transform ${
                  sosTriggered
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95'
                }`}
              >
                {sosTriggered ? 'SOS Sent' : 'SOS'}
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {/* {sosTriggered ? t('dashboard.sosNotified') : t('dashboard.sosPress')} */}
                {sosTriggered ? t('Notified‼️') : t('Press 👆')}
              </p>
            </div>

            {/* Status Panel */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                📊 Safety Status
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Geofence Status:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    isInGeofence 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {isInGeofence ? 'Inside Safe Zone' : 'Outside Safe Zone'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Zone Radius:</span>
                  <span className="text-gray-900 font-medium">
                    {(geofenceRadius/1000).toFixed(1)} km
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Last Update:</span>
                  <span className="text-gray-900 font-medium">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Digital ID QR Code */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                {/* 🆔 {t('dashboard.digitalId')} */}
                🆔 Digital ID
              </h3>
              <div className="flex flex-col items-center">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <QRCodeSVG
                    value={touristId}
                    size={120}
                    level="M"
                    includeMargin={true}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  {/* {t('dashboard.qrScanInfo')} */}
                  QR Code to scan for your digital ID
                </p>
                <p className="text-xs text-gray-400 mt-1 text-center font-mono">
                  ID: {touristId}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                {/* ⚡ {t('dashboard.quickActions')} */}
                ⚡ Quick Actions
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setGeofenceRadius(500)}
                  className="w-full py-2 px-4 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  {/* {t('dashboard.set500m')} */}
                  Set 500m
                </button>
                <button
                  onClick={() => setGeofenceRadius(1000)}
                  className="w-full py-2 px-4 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  {/* {t('dashboard.set1km')} */}
                  Set 1km
                </button>
                <button
                  onClick={() => setGeofenceRadius(2000)}
                  className="w-full py-2 px-4 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  {/* {t('dashboard.set2km')} */}
                  Set 2km
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TouristDashboard;
