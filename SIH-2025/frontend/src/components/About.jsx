import React from 'react';
import { useTranslation } from 'react-i18next';

const About = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-6 text-center">
            🧭 {t('about.title')}
          </h1>
          
          <div className="prose max-w-none">
            <p className="text-lg text-gray-600 mb-6">
              {t('about.desc')}
            </p>
            
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('about.keyFeatures')}</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600 mb-6">
              <li>{t('about.feature1')}</li>
              <li>{t('about.feature2')}</li>
              <li>{t('about.feature3')}</li>
              <li>{t('about.feature4')}</li>
              <li>{t('about.feature5')}</li>
              <li>{t('about.feature6')}</li>
            </ul>
            
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">{t('about.techStack')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">{t('about.frontend')}</h3>
                <p className="text-gray-600">{t('about.frontendTech')}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">{t('about.backend')}</h3>
                <p className="text-gray-600">{t('about.backendTech')}</p>
              </div>
            </div>
            
            <div className="text-center">
              <button
                onClick={() => window.history.back()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                {t('about.backBtn')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
