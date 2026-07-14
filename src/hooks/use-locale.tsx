"use client";

// ============================================================
// LocaleProvider / useLocale — idioma do app (pt-BR, es, en)
//
// Espelha o padrão do ThemeProvider: estado em contexto,
// persistência em localStorage e sincronização entre abas.
// ============================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isLocale,
  translate,
  type Locale,
} from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** t("nav.contacts") → texto no idioma ativo */
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage pode falhar em navegação privada / sandbox.
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Sem persistência, mas a aba atual funciona na sessão.
    }
  }, []);

  // Mantém <html lang> coerente no primeiro mount.
  useEffect(() => {
    document.documentElement.lang = locale;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza entre abas.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== LOCALE_STORAGE_KEY) return;
      if (isLocale(e.newValue) && e.newValue !== locale) {
        setLocaleState(e.newValue);
        document.documentElement.lang = e.newValue;
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [locale]);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Fallback fora do provider — evita crash; textos ficam no padrão.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key: string) => translate(DEFAULT_LOCALE, key),
    };
  }
  return ctx;
}
