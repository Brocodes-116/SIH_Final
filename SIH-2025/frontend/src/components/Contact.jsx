import React from 'react';
import { useTranslation } from 'react-i18next';

const Contact = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-6 text-center">
            📞 {t('contact.title')}
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('contact.getInTouch')}</h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">📧</span>
                  <div>
                    <p className="font-semibold text-gray-800">{t('contact.emailLabel')}</p>
                    <p className="text-gray-600">{t('contact.emailValue')}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="font-semibold text-gray-800">{t('contact.phoneLabel')}</p>
                    <p className="text-gray-600">{t('contact.phoneValue')}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">📍</span>
                  <div>
                    <p className="font-semibold text-gray-800">{t('contact.addressLabel')}</p>
                    <p className="text-gray-600">{t('contact.addressValue')}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('contact.emergencyContacts')}</h2>
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-2">🚨 {t('contact.sosLabel')}</h3>
                  <p className="text-red-600">{t('contact.sosValue')}</p>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-800 mb-2">🛡️ {t('contact.hotlineLabel')}</h3>
                  <p className="text-yellow-600">{t('contact.hotlineValue')}</p>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">🏛️ {t('contact.infoLabel')}</h3>
                  <p className="text-blue-600">{t('contact.infoValue')}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <button
              onClick={() => window.history.back()}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
