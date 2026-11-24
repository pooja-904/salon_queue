import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useLang } from '../i18n/i18n';
import { staffApi } from '../lib/api';
import { load, save } from '../lib/storage';
import { Button, Card, LangToggle, Logo, inputClass } from './ui';

/** Reception, barber and admin screens need the staff PIN (docs/03-flows-rules.md). */
export function PinGate({ children }: { children: (pin: string, lock: () => void) => ReactNode }) {
  const { t } = useLang();
  const [pin, setPin] = useState<string | null>(() => load('sq.pin'));
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const lock = () => {
    save('sq.pin', null);
    setPin(null);
  };

  if (pin) return <>{children(pin, lock)}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    save('sq.pin', value);
    try {
      await staffApi.post('/login');
      setPin(value);
    } catch {
      save('sq.pin', null);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col bg-canvas px-5 py-4">
      <div className="flex h-[52px] items-center justify-between">
        <Logo />
        <LangToggle />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-[380px] p-7">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-ink text-white">
            <Lock size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">{t('pin.title')}</h1>
          <form onSubmit={submit} className="mt-5">
            <label className="block text-[13px] font-medium text-muted" htmlFor="pin">
              {t('pin.label')}
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className={`${inputClass} mt-1.5 text-center text-[24px] tracking-[0.5em]`}
            />
            {error && (
              <p role="alert" className="mt-2 text-[13px] text-danger">
                {t('pin.wrong')}
              </p>
            )}
            <Button type="submit" disabled={busy || value.length < 4} className="mt-5 h-12 w-full">
              {t('pin.enter')}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
