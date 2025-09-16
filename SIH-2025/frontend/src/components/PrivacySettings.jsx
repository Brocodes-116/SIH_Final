import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Privacy Settings Component
 * Allows users to manage their privacy preferences and data
 */
const PrivacySettings = ({ onClose }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState({
    locationSharing: false,
    dataRetention: 30,
    anonymization: true,
    emergencyContacts: false,
    marketing: false,
    analytics: false,
    consentGiven: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Fetch privacy preferences
  const fetchPreferences = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/privacy/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch privacy preferences');
      }

      const data = await response.json();
      if (data.success) {
        setPreferences({
          ...preferences,
          ...data.preferences,
          consentGiven: data.consentGiven
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      setError('Failed to load privacy settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Save privacy preferences
  const savePreferences = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/privacy/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save preferences');
      }

      const data = await response.json();
      if (data.success) {
        setSuccess('Privacy preferences saved successfully');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setError(error.message || 'Failed to save privacy settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Export user data
  const exportData = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/privacy/export', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const data = await response.json();
      if (data.success) {
        // Download as JSON file
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setSuccess('Data exported successfully');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      setError(error.message || 'Failed to export data');
    }
  };

  // Delete all user data
  const deleteAllData = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/privacy/data', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirm: 'DELETE_ALL_DATA' })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete data');
      }

      const data = await response.json();
      if (data.success) {
        setSuccess('All data deleted successfully');
        setShowDeleteConfirm(false);
        setDeleteConfirmText('');
        // Optionally redirect to login or close the app
        setTimeout(() => {
          localStorage.removeItem('token');
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Error deleting data:', error);
      setError(error.message || 'Failed to delete data');
    }
  };

  // Handle preference change
  const handlePreferenceChange = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
          <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-700">Loading privacy settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-5/6 overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Privacy Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-green-600 mr-2">✅</span>
                <span className="text-green-800">{success}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-red-600 mr-2">⚠️</span>
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {/* Location Sharing */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Location Sharing</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.locationSharing}
                  onChange={(e) => handlePreferenceChange('locationSharing', e.target.checked)}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">Share my location with authorities for safety purposes</span>
              </label>
              <p className="text-sm text-gray-500 ml-7">
                This allows authorities to track your location in real-time for emergency response and safety monitoring.
              </p>
            </div>
          </div>

          {/* Data Retention */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Data Retention</h3>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Keep my data for (days):
              </label>
              <select
                value={preferences.dataRetention}
                onChange={(e) => handlePreferenceChange('dataRetention', parseInt(e.target.value))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year</option>
              </select>
              <p className="text-sm text-gray-500">
                Your location data will be automatically deleted after this period.
              </p>
            </div>
          </div>

          {/* Anonymization */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Data Anonymization</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.anonymization}
                  onChange={(e) => handlePreferenceChange('anonymization', e.target.checked)}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">Anonymize my location data</span>
              </label>
              <p className="text-sm text-gray-500 ml-7">
                Reduces location precision and removes personal identifiers from stored data.
              </p>
            </div>
          </div>

          {/* Emergency Contacts */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Emergency Contacts</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.emergencyContacts}
                  onChange={(e) => handlePreferenceChange('emergencyContacts', e.target.checked)}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">Allow emergency contact sharing</span>
              </label>
              <p className="text-sm text-gray-500 ml-7">
                Share your emergency contact information with authorities during emergencies.
              </p>
            </div>
          </div>

          {/* Marketing */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Marketing</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={(e) => handlePreferenceChange('marketing', e.target.checked)}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">Receive marketing communications</span>
              </label>
              <p className="text-sm text-gray-500 ml-7">
                Allow us to send you promotional content and updates about our services.
              </p>
            </div>
          </div>

          {/* Analytics */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(e) => handlePreferenceChange('analytics', e.target.checked)}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">Help improve our services with usage analytics</span>
              </label>
              <p className="text-sm text-gray-500 ml-7">
                Share anonymous usage data to help us improve the application.
              </p>
            </div>
          </div>

          {/* Data Management */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Data Management</h3>
            <div className="space-y-3">
              <button
                onClick={exportData}
                className="w-full py-2 px-4 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
              >
                📥 Export My Data
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2 px-4 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
              >
                🗑️ Delete All My Data
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={savePreferences}
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Data Deletion</h3>
              <p className="text-gray-600 mb-4">
                This action will permanently delete ALL your data including location history, preferences, and account information. This cannot be undone.
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Type "DELETE_ALL_DATA" to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                placeholder="DELETE_ALL_DATA"
              />
              <div className="flex space-x-3">
                <button
                  onClick={deleteAllData}
                  disabled={deleteConfirmText !== 'DELETE_ALL_DATA'}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Delete All Data
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrivacySettings;
