import { translations, type Language, type TranslationKey } from './translations';

export type { Language } from './translations';

const LANGUAGE_STORAGE_KEY = 'uno-remake:language';

let currentLanguage: Language = resolveInitialLanguage();
const listeners = new Set<(language: Language) => void>();

function resolveInitialLanguage(): Language {
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'pt-BR' || stored === 'en-US') {
    return stored;
  }

  const browserLanguage = (navigator.language || '').toLowerCase();
  if (browserLanguage.startsWith('pt')) {
    return 'pt-BR';
  }

  return 'en-US';
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(language: Language): void {
  if (language === currentLanguage) {
    return;
  }

  currentLanguage = language;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  listeners.forEach((listener) => listener(language));
}

export function subscribeLanguageChange(listener: (language: Language) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let value: string = translations[currentLanguage][key] ?? translations['pt-BR'][key] ?? key;
  if (!params) {
    return value;
  }

  Object.entries(params).forEach(([paramKey, paramValue]) => {
    value = value.replaceAll(`{${paramKey}}`, String(paramValue));
  });

  return value;
}
