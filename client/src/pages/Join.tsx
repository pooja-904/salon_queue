import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { serviceName, useLang } from '../i18n/i18n';
import { api, ApiError, errorKey } from '../lib/api';
import { hhmmTo12, initial, rupees } from '../lib/format';
import { useConnected, useLiveState } from '../lib/live';
import { unlockSound } from '../lib/sound';
import { save } from '../lib/storage';
import { motion } from 'motion/react';
import { Button, Card, ConnectionPill, Field, TopBar, cx, inputClass } from '../components/ui';
import { EASE_OUT, Reveal, Roll, SPRING } from '../components/motion';

const MAX = 3;

export default function Join() {
  const { t, lang } = useLang();
  const state = useLiveState();
  const connected = useConnected();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [maxHit, setMaxHit] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [dup, setDup] = useState<{ visitId: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const services = state?.services ?? [];
  const chosen = services.filter((s) => picked.includes(s.id));
  const minutes = chosen.reduce((a, s) => a + s.minutes, 0);
  const price = chosen.reduce((a, s) => a + s.price, 0);
  const barber = state?.barbers.find((b) => b.id === barberId);
  // If the chosen barber goes on break or off duty while the form is open, fall back to "Any".
  const effectiveBarber = barber && !barber.onBreak ? barberId : null;
  const expected = effectiveBarber ? barber?.waitNew ?? null : state?.waitNewAny ?? null;

  const toggle = (id: number) => {
    setMaxHit(false);
    setPicked((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= MAX) {
        setMaxHit(true);
        return p;
      }
      return [...p, id];
    });
  };

  const clientErrors = useMemo(
    () => ({
      name: /^[\p{L}\p{M} .'-]{2,40}$/u.test(name.trim()) ? undefined : t('err.invalid_name'),
      phone: /^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')) ? undefined : t('err.invalid_phone'),
    }),
    [name, phone, t],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockSound();
    setDup(null);
    if (clientErrors.name || clientErrors.phone) return setErrors(clientErrors);
    setErrors({});
    setBusy(true);
    try {
      const r = await api.post<{ id: string }>('/api/visits', { name, phone, serviceIds: picked, barberId: effectiveBarber });
      save('sq.myVisit', r.id);
      navigate(`/status/${r.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'duplicate') {
        setDup({ visitId: String(err.data.visitId), token: String(err.data.token) });
      } else if (err instanceof ApiError && (err.code === 'invalid_name' || err.code === 'invalid_phone')) {
        setErrors({ [err.code === 'invalid_name' ? 'name' : 'phone']: t(errorKey(err)) });
      } else {
        setErrors({ form: t(errorKey(err)) });
      }
    } finally {
      setBusy(false);
    }
  };

  if (state && !state.salon.onlineOpen) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-[18px] pb-6 pt-3.5">
        <TopBar />
        <Card className="mt-10 p-7 text-center">
          <h1 className="text-[22px] font-semibold">{t('home.closed')}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {state.salon.closedReason === 'time'
              ? t('home.closedTime', { time: hhmmTo12(state.salon.onlineUntil), close: hhmmTo12(state.salon.closingTime) })
              : t('home.closedMsg')}
          </p>
          <Link to="/" className="mt-5 inline-flex min-h-[44px] items-center font-medium text-accent">
            {t('status.goHome')}
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-[18px] pb-36 pt-3.5">
      <ConnectionPill connected={connected} />
      <TopBar />
      <Link to="/" className="rise mt-3 inline-flex min-h-[44px] w-fit items-center gap-1.5 text-[14px] font-medium text-muted transition-colors hover:text-ink">
        <ArrowLeft size={16} aria-hidden="true" />
        {t('common.back')}
      </Link>
      <h1 className="rise mt-1 px-1 text-[28px] font-semibold tracking-[-0.025em] [--d:1]">{t('join.title')}</h1>
      <p className="rise px-1 text-[15px] text-muted [--d:1]">{t('join.sub')}</p>

      <form id="join-form" onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
        <Card className="rise flex flex-col gap-4 p-5 [--d:2]">
          <Field label={t('join.name')} error={errors.name}>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((x) => ({ ...x, name: undefined }));
              }}
              placeholder={t('join.namePh')}
              autoComplete="name"
              maxLength={40}
              aria-invalid={!!errors.name}
            />
          </Field>
          <Field label={t('join.phone')} error={errors.phone}>
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/[^\d+\s]/g, '').slice(0, 14));
                if (errors.phone) setErrors((x) => ({ ...x, phone: undefined }));
              }}
              placeholder={t('join.phonePh')}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
            />
          </Field>
        </Card>

        <section className="rise [--d:3]">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[15px] font-semibold">{t('join.services')}</h2>
            <span className="text-[13px] text-subtle">{t('join.servicesHint')}</span>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {services.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s.id)}
                  className={cx(
                    'press relative min-h-[84px] rounded-[20px] p-4 text-left',
                    on ? 'bg-ink text-white shadow-pass' : 'bg-white text-ink shadow-card hover:bg-white/70',
                  )}
                >
                  {on && (
                    <motion.span
                      initial={{ scale: 0.3, opacity: 0, rotate: -30 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      transition={SPRING}
                      className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-white text-ink"
                    >
                      <Check size={13} strokeWidth={3} aria-hidden="true" />
                    </motion.span>
                  )}
                  <div className="pr-6 text-[15px] font-medium leading-snug">{serviceName(lang, s)}</div>
                  <div className={cx('mt-1.5 text-[13px] tabular', on ? 'text-white/70' : 'text-muted')}>
                    {t('common.nMin', { n: s.minutes })} · {rupees(s.price)}
                  </div>
                </button>
              );
            })}
          </div>
          <Reveal show={maxHit}>
            <p role="alert" className="mt-2 px-1 text-[13px] font-medium text-danger">
              {t('join.max3')}
            </p>
          </Reveal>
        </section>

        <section className="rise [--d:4]">
          <h2 className="px-1 text-[15px] font-semibold">{t('join.barber')}</h2>
          <div role="radiogroup" aria-label={t('join.barber')} className="mt-2.5 flex flex-col gap-2">
            <BarberOption
              selected={effectiveBarber === null}
              onSelect={() => setBarberId(null)}
              title={t('join.anyFastest')}
              avatar="∗"
              wait={state?.waitNewAny ?? null}
            />
            {state?.barbers.map((b) => (
              <BarberOption
                key={b.id}
                selected={effectiveBarber === b.id}
                onSelect={() => setBarberId(b.id)}
                title={b.name}
                avatar={initial(b.name)}
                wait={b.waitNew}
                disabled={b.onBreak}
                disabledLabel={t('join.onBreak')}
              />
            ))}
          </div>
        </section>

        <Reveal show={!!errors.form}>
          <p role="alert" className="rounded-2xl bg-danger-bg px-4 py-3 text-[14px] text-danger">
            {errors.form}
          </p>
        </Reveal>
        <Reveal show={!!dup}>
          {dup && (
          <div role="alert" className="rounded-3xl bg-white p-5 shadow-card">
            <p className="text-[15px] font-medium">{t('join.already', { token: dup.token })}</p>
            <Button
              className="mt-3 w-full"
              onClick={() => {
                save('sq.myVisit', dup.visitId);
                navigate(`/status/${dup.visitId}`);
              }}
            >
              {t('join.openStatus')}
            </Button>
          </div>
          )}
        </Reveal>
      </form>

      <motion.div
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { duration: 0.5, ease: EASE_OUT, delay: 0.25 } }}
        className="fixed inset-x-0 bottom-0 z-10 px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto flex max-w-[464px] items-center gap-3 rounded-[24px] bg-white p-3 pl-5 shadow-[0_-4px_32px_-8px_rgba(11,22,48,0.25)] ring-hair">
          <div className="min-w-0 flex-1" aria-live="polite">
            {picked.length === 0 ? (
              <div className="text-[14px] text-muted">{t('join.pickService')}</div>
            ) : (
              <>
                <div className="text-[15px] font-semibold tabular">
                  <Roll value={t('join.summary', { min: minutes, price })} />
                </div>
                <div className="text-[13px] text-muted tabular">
                  <Roll value={expected === 0 ? t('join.expectedNow') : expected === null ? '' : t('join.expected', { n: expected })} />
                </div>
              </>
            )}
          </div>
          <Button type="submit" form="join-form" disabled={picked.length === 0 || busy} className="h-12 px-7">
            {t('join.confirm')}
          </Button>
        </div>
      </motion.div>
    </main>
  );
}

function BarberOption({
  selected,
  onSelect,
  title,
  avatar,
  wait,
  disabled,
  disabledLabel,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  avatar: string;
  wait: number | null;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const { t } = useLang();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cx(
        'press flex min-h-[64px] items-center gap-3 rounded-[20px] px-4 text-left',
        selected ? 'bg-white shadow-[0_0_0_2px_var(--color-ink)]' : 'bg-white shadow-card',
        disabled && 'opacity-50',
      )}
    >
      <span
        className={cx(
          'flex size-10 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[16px] transition-colors duration-200',
          selected ? 'border-ink bg-ink text-white' : 'border-ink/70 text-ink',
        )}
        aria-hidden="true"
      >
        {avatar}
      </span>
      <span className="flex-1 text-[15px] font-medium">{title}</span>
      <span className="text-[14px] tabular text-muted">
        <Roll value={disabled ? disabledLabel ?? '' : wait === null ? '' : wait === 0 ? t('rec.estNow') : t('rec.est', { n: wait })} />
      </span>
    </button>
  );
}
