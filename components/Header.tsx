import * as React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const GlobeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-hover:text-gray-700 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" />
    </svg>
);

const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);


const Header: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = React.useState(false);
  
  const langDropdownRef = React.useRef<HTMLDivElement>(null);

  const navLinkClasses = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const activeNavLinkClasses = "bg-indigo-50 text-indigo-600";
  const inactiveNavLinkClasses = "text-gray-500 hover:bg-gray-100 hover:text-gray-900";

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
            <div className="hidden sm:flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
              <NavLink to="/invoices" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : inactiveNavLinkClasses}`}>{t('invoices')}</NavLink>
              <NavLink to="/inventory" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : inactiveNavLinkClasses}`}>{t('inventory')}</NavLink>
              <NavLink to="/profile" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : inactiveNavLinkClasses}`}>{t('profile')}</NavLink>
            </div>
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
        </div>
      </nav>
    </header>
  );
};

export default Header;