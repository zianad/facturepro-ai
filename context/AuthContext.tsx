import * as React from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (user: Omit<User, 'role'>) => void;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(false);

  const login = (userData: Omit<User, 'role'>) => {
    setLoading(true);
    // Mock login logic
    setTimeout(() => {
      const role = userData.username.toLowerCase() === 'admin' ? 'admin' : 'user';
      setUser({ ...userData, role });
      setLoading(false);
    }, 500);
  };

  const logout = () => {
    setUser(null);
  };

  const isAuthenticated = React.useMemo(() => !!user, [user]);

  const value = { user, isAuthenticated, loading, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};