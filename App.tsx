import * as React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';

import Header from './components/Header';

// Use React.lazy for route components to improve performance and prevent bundling conflicts.
const InvoicePage = React.lazy(() => import('./components/InvoicePage'));
const InventoryPage = React.lazy(() => import('./components/InventoryPage'));
const ProfilePage = React.lazy(() => import('./components/ProfilePage'));

const PageLoader: React.FC = () => (
  <div className="flex justify-center items-center h-64">
    <div className="text-lg text-gray-500">Chargement...</div>
  </div>
);

const AppContent: React.FC = () => {
  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">
          <React.Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/invoices" replace />} />
              <Route path="/invoices" element={<InvoicePage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/invoices" replace />} />
            </Routes>
          </React.Suspense>
        </main>
        <footer className="text-center text-xs text-gray-400 p-2 border-t bg-gray-50">
          Version 2.1.0
        </footer>
      </div>
    </HashRouter>
  );
}


const App: React.FC = () => {
  return (
    <LanguageProvider>
        <AppContent />
    </LanguageProvider>
  );
};

export default App;