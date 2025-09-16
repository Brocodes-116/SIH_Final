import React, { useState, useEffect } from 'react';
import TouristLogin from './components/TouristLogin';
import TouristSignup from './components/TouristSignup';
import TouristDashboard from './components/TouristDashboard';
import AuthorityLogin from './components/AuthorityLogin';
import AuthorityDashboard from './components/AuthorityDashboard';
import { useTranslation } from 'react-i18next';
import Navbar from './components/Navbar';
import About from './components/About';
import Contact from './components/Contact';
import './App.css';

export default function App() {
  const [currentView, setCurrentView] = useState('portal-select'); // 'portal-select', 'tourist-login', 'tourist-signup', 'tourist-dashboard', 'authority-login', 'authority-dashboard'
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'tourist' or 'authority'
  const { t } = useTranslation();

  // Always start at portal selection (landing index)
  useEffect(() => {
    setCurrentView('portal-select');
  }, []);

  // Handle successful tourist login
  const handleTouristLogin = (userData) => {
    setUser(userData);
    setUserType('tourist');
    setCurrentView('tourist-dashboard');
  };

  // Handle successful tourist signup
  const handleTouristSignup = (userData) => {
    // After successful signup, redirect to login page
    setCurrentView('tourist-login');
    alert(t('signup.success'));
  };

  // Handle successful authority login
  const handleAuthorityLogin = (userData) => {
    setUser(userData);
    setUserType('authority');
    setCurrentView('authority-dashboard');
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setUserType(null);
    setCurrentView('portal-select');
  };

  // Handle navigation from navbar
  const handleNavigation = (view) => {
    setCurrentView(view);
  };

  // Portal Selection Component
  const PortalSelection = () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🧭 {t('app.title')}
          </h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            {t('app.choosePortal')}
          </h2>
          <p className="text-gray-600">
            {t('app.selectRole')}
          </p>
        </div>

        <div className="space-y-4">
          {/* Tourist Portal */}
          <button
            onClick={() => setCurrentView('tourist-login')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg"
          >
            🧭 {t('app.touristPortal')}
            <p className="text-sm font-normal mt-1 opacity-90">
              {t('app.touristDesc')}
            </p>
          </button>

          {/* Authority Portal */}
          <button
            onClick={() => setCurrentView('authority-login')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg"
          >
            🛡️ {t('app.authorityPortal')}
            <p className="text-sm font-normal mt-1 opacity-90">
              {t('app.authorityDesc')}
            </p>
          </button>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>🛡️ Your safety is our priority</p>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              setUser(null);
              setUserType(null);
              setCurrentView('portal-select');
            }}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            {t('app.clearData')}
          </button>
        </div>
      </div>
    </div>
  );

  // Render current view
  const renderCurrentView = () => {
    switch (currentView) {
      case 'portal-select':
        return <PortalSelection />;
      case 'tourist-login':
        return (
          <TouristLogin
            onLogin={handleTouristLogin}
            onSwitchToSignup={() => setCurrentView('tourist-signup')}
            onSwitchToAuthority={() => setCurrentView('authority-login')}
          />
        );
      case 'tourist-signup':
        return (
          <TouristSignup
            onSignup={handleTouristSignup}
            onSwitchToLogin={() => setCurrentView('tourist-login')}
            onSwitchToAuthority={() => setCurrentView('authority-login')}
          />
        );
      case 'tourist-dashboard':
        return <TouristDashboard user={user} onLogout={handleLogout} />;
      case 'authority-login':
        return (
          <AuthorityLogin
            onLogin={handleAuthorityLogin}
            onSwitchToTourist={() => setCurrentView('tourist-login')}
          />
        );
      case 'authority-dashboard':
        return <AuthorityDashboard user={user} onLogout={handleLogout} />;
      case 'about':
        return <About />;
      case 'contact':
        return <Contact />;
      default:
        return <PortalSelection />;
    }
  };

  // Only show navbar on non-auth pages
  const showNavbar = !['portal-select', 'tourist-login', 'tourist-signup', 'authority-login'].includes(currentView);
  return (
    <div className="App">
      {showNavbar && (
        <Navbar 
          user={user} 
          userType={userType} 
          onLogout={handleLogout} 
          onNavigate={handleNavigation}
        />
      )}
      {renderCurrentView()}
    </div>
  );
}
  
