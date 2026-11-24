import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from './en.json';
import gu from './gu.json';
import { load, save } from '../lib/storage';

export type Lang = 'en' | 'gu';
type Dict = Record<string, string>;
const DICTS: Record<Lang, Dict> = { en, gu };

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const raw = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
}

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (load('sq.lang') === 'gu' ? 'gu' : 'en'));
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    save('sq.lang', l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t = useCallback<TFn>((key, vars) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLang outside LangProvider');
  return ctx;
}

/** "4th in line" / "લાઇનમાં 4 નંબરે" */
export function ordinal(t: TFn, n: number) {
  const pos = n === 1 ? t('pos.1') : n === 2 ? t('pos.2') : n === 3 ? t('pos.3') : t('pos.n', { n });
  return pos;
}

export function serviceName(lang: Lang, s: { nameEn: string; nameGu: string }) {
  return lang === 'gu' && s.nameGu ? s.nameGu : s.nameEn;
}
