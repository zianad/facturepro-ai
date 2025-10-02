import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const Spinner = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const LoginPage: React.FC = () => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const { login, isAuthenticated, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/invoices', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      login({ username });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 -mt-16">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">{t('appName')}</h1>
            <p className="text-sm text-gray-500">{t('loginPageTitle')}</p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="relative">
            <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-600">
              {t('username')}
            </label>
            <div className="absolute inset-y-0 left-0 top-7 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            </div>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 p-2.5 transition-shadow"
              placeholder="admin or user"
              required
            />
          </div>
          <div className="relative">
            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-600">
              {t('password')}
            </label>
            <div className="absolute inset-y-0 left-0 top-7 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 p-2.5 transition-shadow"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center px-5 py-3 text-sm font-medium text-center text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-300 disabled:bg-indigo-400 transition-all shadow-md hover:shadow-lg"
          >
            {loading ? <Spinner /> : t('login')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;