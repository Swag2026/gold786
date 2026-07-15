import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '../lib/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('sg_lang') || 'en');

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    localStorage.setItem('sg_lang', lang);
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLang(l => (l === 'en' ? 'ar' : 'en'));
  }, []);

  const t = useCallback((key) => {
    return translations[lang]?.[key] || translations.en[key] || key;
  }, [lang]);

  // Interpolated variant: tf('pg.showing', {a, b, n}) replaces {a}/{b}/{n}
  // placeholders in the translated string — mirrors the vanilla app's _tf().
  const tf = useCallback((key, vars) => {
    let s = translations[lang]?.[key] || translations.en[key] || key;
    if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
    return s;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t, tf }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
