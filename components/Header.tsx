import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const GlobeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-hover:text-gray-700 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" />
    </svg>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 group-hover:text-gray-600" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
);

const LogoutIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
    </svg>
);

const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);


const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const navLinkClasses = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const activeNavLinkClasses = "bg-indigo-50 text-indigo-600";
  const inactiveNavLinkClasses = "text-gray-500 hover:bg-gray-100 hover:text-gray-900";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
            setIsUserDropdownOpen(false);
        }
        if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
            setIsLangDropdownOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
      <nav className="container mx-auto px-4 sm:px-6 py-2 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-gray-800">
            {t('appName').replace(' AI', '')}<span className="text-indigo-600"> AI</span>
        </Link>
        
        <div className="flex items-center">
          {isAuthenticated && (
            <div className="hidden sm:flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
              <NavLink to="/invoices" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : inactiveNavLinkClasses}`}>{t('invoices')}</NavLink>
              <NavLink to="/inventory" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : inactiveNavLinkClasses}`}>{t('inventory')}</NavLink>
              <NavLink to="/profile" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : inactiveNavLinkClasses}`}>{t('profile')}</NavLink>
              {user?.role === 'admin' && (
                <NavLink to="/admin" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : inactiveNavLinkClasses}`}>{t('admin')}</NavLink>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
            <div className="relative" ref={langDropdownRef}>
                <button onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)} className="group flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
                    <GlobeIcon />
                    <span className="text-sm font-medium text-gray-700">{language === 'fr' ? 'Français' : 'العربية'}</span>
                    <ChevronDownIcon />
                </button>
                {isLangDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg py-1 z-40 border border-gray-200">
                        <button onClick={() => { setLanguage('fr'); setIsLangDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${language === 'fr' ? 'bg-gray-100 text-gray-900' : 'text-gray-700'} hover:bg-gray-100`}>
                            Français
                        </button>
                        <button onClick={() => { setLanguage('ar'); setIsLangDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${language === 'ar' ? 'bg-gray-100 text-gray-900' : 'text-gray-700'} hover:bg-gray-100`}>
                            العربية
                        </button>
                    </div>
                )}
            </div>

          {isAuthenticated ? (
            <div className="relative" ref={userDropdownRef}>
              <button onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} className="group flex items-center space-x-2 p-2 rounded-full hover:bg-gray-100 transition-colors">
                <span className="text-sm font-medium text-gray-700">{user?.username}</span>
                <UserIcon />
              </button>
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-40 border border-gray-200">
                  <div className="px-4 py-2 text-sm text-gray-500 border-b">{t('welcome')}, {user?.username}</div>
                  <Link to="/profile" onClick={() => setIsUserDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">{t('profile')}</Link>
                  <button onClick={() => { logout(); setIsUserDropdownOpen(false); }} className="w-full text-left flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <LogoutIcon />
                    <span>{t('logout')}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-shadow shadow-sm hover:shadow-md">{t('login')}</Link>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;