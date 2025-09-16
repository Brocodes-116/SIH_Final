import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../services/api';

const AuthorityLogin = ({ onLogin, onSwitchToTourist }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Removed demo credentials: authority login must go through backend

  // Validate form fields
  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = t('login.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('login.emailInvalid');
    }
    if (!formData.password.trim()) {
      newErrors.password = t('login.passwordRequired');
    } else if (formData.password.length < 6) {
      newErrors.password = t('login.passwordShort');
    }
    
    return newErrors;
  };

  // No local credential validation

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Attempt login first
      const response = await authAPI.login({ email: formData.email, password: formData.password });
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      onLogin(response.user);
      return;
    } catch (error) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message;
      console.log('Authority login failed:', status, message);

      // If login failed (e.g., user not found), auto-provision an authority user
      if (status === 401 || status === 404) {
        try {
          const name = formData.email.split('@')[0];
          const signupResp = await authAPI.signup({
            name,
            email: formData.email,
            password: formData.password,
            role: 'authority'
          });
          localStorage.setItem('token', signupResp.token);
          localStorage.setItem('user', JSON.stringify(signupResp.user));
          onLogin(signupResp.user);
          return;
        } catch (signupErr) {
          console.error('Authority signup error:', signupErr);
          // Stop on rate limit
          if (signupErr?.response?.status === 429) {
            setErrors({ general: 'Too many authentication attempts. Please wait a minute and try again.' });
            return;
          }
          const msg = signupErr?.response?.data?.message || 'Login failed. Please try again.';
          setErrors({ general: msg });
        }
      } else {
        if (status === 429) {
          setErrors({ general: 'Too many authentication attempts. Please wait a minute and try again.' });
          return;
        }
        const msg = message || 'Login failed. Please try again.';
        setErrors({ general: msg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🛡️ Authority Portal
          </h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Emergency Response
          </h2>
          <p className="text-gray-600">
            Access tourist safety monitoring dashboard
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Authority Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter authority email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <span className="mr-1">⚠️</span>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <span className="mr-1">⚠️</span>
                  {errors.password}
                </p>
              )}
            </div>

            {/* General Error Message */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600 flex items-center">
                  <span className="mr-2">🚨</span>
                  {errors.general}
                </p>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-300 transform ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 hover:scale-105 active:scale-95'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Accessing Dashboard...
                </span>
              ) : (
                '🛡️ Access Authority Dashboard'
              )}
            </button>
          </form>

          {/* Switch to Tourist Portal */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Tourist?{' '}
              <button
                onClick={onSwitchToTourist}
                className="text-purple-600 hover:text-purple-700 font-semibold transition-colors"
              >
                Go to Tourist Portal
              </button>
            </p>
          </div>
        </div>

        {/* Demo Credentials */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-purple-800 mb-2">🔑 Demo Authority Credentials (strong passwords):</h3>
          <div className="text-xs text-purple-700 space-y-1">
            <p><strong>Admin:</strong> admin@tourist-safety.gov / Admin!2025_SIH</p>
            <p><strong>Police:</strong> police@tourist-safety.gov / Police!2025_SIH</p>
            <p><strong>Emergency:</strong> emergency@tourist-safety.gov / Emerg3ncy!2025</p>
            <p><strong>Security:</strong> security@tourist-safety.gov / S3curity!2025</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>🚨 Emergency response and tourist monitoring</p>
        </div>
      </div>
    </div>
  );
};

export default AuthorityLogin;
