import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const Navbar = ({ user, userType, onLogout, onNavigate }) => {
  const { t, i18n } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);

  // Available languages with their native names
  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
    { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' }
  ];

  // Get current language info
  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  // Handle language change
  const handleLanguageChange = (languageCode) => {
    i18n.changeLanguage(languageCode);
    setIsLanguageOpen(false);
    // Language preference is automatically saved to localStorage by i18next
  };

  // Handle navigation
  const handleNavigation = (view) => {
    if (onNavigate) {
      onNavigate(view);
    }
    setIsMenuOpen(false);
  };

  // Handle logout
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    setIsMenuOpen(false);
  };

  // Tourist menu items
  const touristMenuItems = [
    { key: 'home', label: t('navbar.home'), view: 'portal-select' },
    { key: 'about', label: t('navbar.about'), view: 'about' },
    { key: 'tips', label: t('navbar.safetyTips'), view: 'safety-tips' },
    { key: 'sos', label: t('navbar.sos'), view: 'sos' },
    { key: 'profile', label: t('navbar.profile'), view: 'profile' }
  ];

  // Authority/Admin menu items
  const authorityMenuItems = [
    { key: 'dashboard', label: t('navbar.dashboard'), view: 'authority-dashboard' },
    { key: 'reports', label: t('navbar.incidentReports'), view: 'incident-reports' },
    { key: 'tourists', label: t('navbar.touristManagement'), view: 'tourist-management' },
    { key: 'logout', label: t('navbar.logout'), view: 'logout' }
  ];

  // Get menu items based on user role
  const menuItems = userType === 'authority' ? authorityMenuItems : touristMenuItems;

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo/Brand */}
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold text-gray-900">
              🧭 Smart Tourist Safety
            </h1>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleNavigation(item.view)}
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right side - Language Selector & Logout */}
          <div className="hidden md:flex items-center space-x-4">
            
            {/* Language Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <span>{currentLanguage.flag}</span>
                <span>{currentLanguage.name}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Language Dropdown Menu */}
              {isLanguageOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  {languages.map((language) => (
                    <button
                      key={language.code}
                      onClick={() => handleLanguageChange(language.code)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2 ${
                        language.code === i18n.language ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <span>{language.flag}</span>
                      <span>{language.name}</span>
                      {language.code === i18n.language && (
                        <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Logout Button */}
            {user && (
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {t('navbar.logout')}
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-600 hover:text-gray-900 p-2 rounded-md"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50 border-t border-gray-200">
              
              {/* Mobile Menu Items */}
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleNavigation(item.view)}
                  className="block w-full text-left text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-base font-medium transition-colors"
                >
                  {item.label}
                </button>
              ))}

              {/* Mobile Language Selector */}
              <div className="border-t border-gray-200 pt-2">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-gray-500 mb-2">{t('navbar.language')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {languages.map((language) => (
                      <button
                        key={language.code}
                        onClick={() => handleLanguageChange(language.code)}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                          language.code === i18n.language 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span>{language.flag}</span>
                        <span>{language.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile Logout */}
              {user && (
                <div className="border-t border-gray-200 pt-2">
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-base font-medium transition-colors"
                  >
                    {t('navbar.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
