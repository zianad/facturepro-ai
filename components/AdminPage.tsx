
import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const AdminPage: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white">{t('adminPageTitle')}</h1>
       <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <p className="text-gray-600 dark:text-gray-300">{t('pageContentPlaceholder')}</p>
      </div>
    </div>
  );
};

export default AdminPage;
