import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useLang } from '../i18n/i18n';
import { LangToggle, Logo } from './ui';

export function StaffHeader({ title, center, right, onLock }: { title: string; center?: ReactNode; right?: ReactNode; onLock: () => void }) {
  const { t } = useLang();
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-3 py-1">
      <div className="flex items-center gap-4">
        <Logo />
        <span className="h-6 w-px bg-line-2" aria-hidden="true" />
        <h1 className="text-[15px] font-medium text-muted">{title}</h1>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2">{center}</div>
      <div className="flex items-center gap-2">
        {right}
        <LangToggle />
        <button
          type="button"
          onClick={onLock}
          className="flex size-11 items-center justify-center rounded-full bg-white text-muted shadow-card ring-hair hover:text-ink"
          aria-label={t('pin.lock')}
          title={t('pin.lock')}
        >
          <Lock size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export function Chip({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'ok' | 'off' | 'warn' }) {
  const dot = { plain: 'bg-accent', ok: 'bg-ok', off: 'bg-subtle', warn: 'bg-warn' }[tone];
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] font-medium shadow-card ring-hair tabular">
      <span className={`inline-block size-2 rounded-full ${dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export const formatPhone = (p: string) => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);
