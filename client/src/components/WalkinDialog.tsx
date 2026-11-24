import { useState } from 'react';
import { Check } from 'lucide-react';
import { serviceName, useLang } from '../i18n/i18n';
import { ApiError, errorKey, staffApi } from '../lib/api';
import type { StaffState } from '../lib/types';
import { Button, Dialog, Field, cx, inputClass } from './ui';

export function WalkinDialog({
  open,
  state,
  onClose,
  onAdded,
}: {
  open: boolean;
  state: StaffState;
  onClose: () => void;
  onAdded: (token: string) => void;
}) {
  const { t, lang } = useLang();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [barberId, setBarberId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setPhone('');
    setPicked([]);
    setBarberId('');
    setError(null);
  };

  const toggle = (id: number) => {
    setError(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? (setError(t('join.max3')), p) : [...p, id]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await staffApi.post<{ token: string }>('/walkin', { name, phone, serviceIds: picked, barberId: barberId || null });
      reset();
      onAdded(r.token);
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'duplicate' ? `${t('err.duplicate')} (${String(err.data.token ?? '')})` : t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={t('rec.walkinTitle')}
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label={t('join.name')}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
        </Field>
        <Field label={t('join.phone')}>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="numeric" />
        </Field>
        <div>
          <div className="text-[13px] font-medium text-muted">
            {t('join.services')} · {t('join.servicesHint')}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {state.services.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s.id)}
                  className={cx(
                    'inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium',
                    on ? 'bg-ink text-white' : 'bg-canvas text-ink ring-hair',
                  )}
                >
                  {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                  {serviceName(lang, s)}
                </button>
              );
            })}
          </div>
        </div>
        <Field label={t('join.barber')}>
          <select className={inputClass} value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            <option value="">{t('join.anyFastest')}</option>
            {state.barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.onBreak ? ` (${t('join.onBreak')})` : ''}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p role="alert" className="rounded-2xl bg-danger-bg px-4 py-3 text-[14px] text-danger">
            {error}
          </p>
        )}
        <div className="mt-1 flex gap-2">
          <Button
            variant="secondary"
            className="h-12 flex-1"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={busy || picked.length === 0}>
            {t('rec.addToQueue')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
