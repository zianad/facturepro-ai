
import React, { ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

import Header from './components/Header';
import LoginPage from './components/LoginPage';
import InvoicePage from './components/InvoicePage';
import InventoryPage from './components/InventoryPage';
import ProfilePage from './components/ProfilePage';
import AdminPage from './components/AdminPage';

interface ProtectedRouteProps {
  isAllowed: boolean;
  redirectPath?: string;
  children?: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAllowed,
  redirectPath = '/login',
  children,
}) => {
  if (!isAllowed) {
    return <Navigate to={redirectPath} replace />;
  }
  return children ? <>{children}</> : <Outlet />;
};


const AppContent: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  
  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route element={<ProtectedRoute isAllowed={isAuthenticated} />}>
              <Route path="/" element={<Navigate to="/invoices" />} />
              <Route path="/invoices" element={<InvoicePage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              
              <Route 
                path="/admin"
                element={
                  <ProtectedRoute isAllowed={!!user && user.role === 'admin'}>
                    <AdminPage />
                  </ProtectedRoute>
                } 
              />
            </Route>

            <Route path="*" element={<Navigate to={isAuthenticated ? "/invoices" : "/login"} />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}


const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
