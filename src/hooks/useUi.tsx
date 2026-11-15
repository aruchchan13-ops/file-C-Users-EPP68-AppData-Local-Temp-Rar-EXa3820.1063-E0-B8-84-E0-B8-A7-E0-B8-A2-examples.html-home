import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Lightweight per-device UI preferences (localStorage) and toasts.
 * Text size and high-contrast mode are part of the coping workflow.
 */
export type TextScale = 100 | 115 | 130;
export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const darkQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);


interface UiState {
  textScale: TextScale;
  setTextScale: (s: TextScale) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  resolvedTheme: ResolvedTheme;
  toast: (message: string, tone?: 'ok' | 'error') => void;
  toasts: { id: number; message: string; tone: 'ok' | 'error' }[];
  dismiss: (id: number) => void;
}

const Ctx = createContext<UiState | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* blocked storage: preference just won't persist */
  }
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [textScale, setTextScaleState] = useState<TextScale>(() => read('eyeready.textScale', 100 as TextScale));
  const [highContrast, setHighContrastState] = useState<boolean>(() => read('eyeready.highContrast', false));
  const [toasts, setToasts] = useState<UiState['toasts']>([]);
  const [theme, setThemeState] = useState<ThemePref>(() => read('eyeready.theme', 'system' as ThemePref));
  const [systemDark, setSystemDark] = useState(() => darkQuery()?.matches ?? false);
  const resolvedTheme: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const q = darkQuery();
    if (!q) return;
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${textScale}%`;
    document.documentElement.dataset.contrast = highContrast ? 'high' : 'normal';
    document.documentElement.dataset.theme = resolvedTheme;
  }, [textScale, highContrast, resolvedTheme]);

  const setTextScale = useCallback((s: TextScale) => {
    setTextScaleState(s);
    write('eyeready.textScale', s);
  }, []);
  const setHighContrast = useCallback((v: boolean) => {
    setHighContrastState(v);
    write('eyeready.highContrast', v);
  }, []);
  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    write('eyeready.theme', t);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message: string, tone: 'ok' | 'error' = 'ok') => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 3500);
    },
    [dismiss],
  );

  return <Ctx.Provider value={{ textScale, setTextScale, highContrast, setHighContrast, theme, setTheme, resolvedTheme, toast, toasts, dismiss }}>{children}</Ctx.Provider>;
}

export function useUi(): UiState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUi must be used inside UiProvider');
  return v;
}
