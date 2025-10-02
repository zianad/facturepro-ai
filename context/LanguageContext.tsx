import * as React from 'react';
import { fr } from '../locales/fr';
import { ar } from '../locales/ar';

const translations = { fr, ar };

type Language = 'fr' | 'ar';
// Using 'keyof typeof fr' ensures we have a canonical set of keys.
export type TranslationKey = keyof typeof fr;

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = React.createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = React.useState<Language>('fr');

  const t = React.useCallback((key: TranslationKey): string => {
    // Fallback to French if a translation is missing in another language, then to the key itself.
    return translations[language]?.[key] || translations.fr[key] || key;
  }, [language]);

  const value = React.useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    {/* FIX: Corrected typo in the closing tag for LanguageContext.Provider. */}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = React.useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};