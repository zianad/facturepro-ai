import * as React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';

import Header from './components/Header';
import InvoicePage from './components/InvoicePage';
import InventoryPage from './components/InventoryPage';
import ProfilePage from './components/ProfilePage';


const AppContent: React.FC = () => {
  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Navigate to="/invoices" replace />} />
            <Route path="/invoices" element={<InvoicePage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/invoices" replace />} />
          </Routes>
        </main>
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