import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Coffee, Scissors } from 'lucide-react';
import { serviceName, useLang } from '../i18n/i18n';
import { errorKey, staffApi } from '../lib/api';
import { initial, mmss } from '../lib/format';
import { useConnected, useStaffState, useTick } from '../lib/live';
import type { StaffState } from '../lib/types';
import { PinGate } from '../components/PinGate';
import { AnimatePresence, motion } from 'motion/react';
import { Card, ConnectionPill, LangToggle, Logo, Toast, cx } from '../components/ui';
import { EASE_IN, EASE_OUT, Roll, SPRING } from '../components/motion';

export default function Barber() {
  return <PinGate>{(pin, lock) => <BarberScreen pin={pin} lock={lock} />}</PinGate>;
}

function BarberScreen({ pin, lock }: { pin: string; lock: () => void }) {
  const { id } = useParams();
  const { t } = useLang();
  const { state, socket } = useStaffState(pin);
  const connected = useConnected(socket);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-[18px] pb-6 pt-3.5">
      <ConnectionPill connected={connected} />
      <header className="flex h-[52px] items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <LangToggle />
          <button type="button" onClick={lock} className="min-h-[44px] px-2 text-[13px] font-medium text-muted hover:text-ink">
            {t('pin.lock')}
          </button>
        </div>
      </header>
      {!state ? (
        <div className="skeleton mt-10 h-[260px] rounded-[28px]" />
      ) : id ? (
        <BarberView state={state} barberId={id} />
      ) : (
        <BarberPicker state={state} />
      )}
    </main>
  );
}

function BarberPicker({ state }: { state: StaffState }) {
  const { t } = useLang();
  return (
    <>
      <h1 className="rise mt-6 px-1 text-[28px] font-semibold tracking-[-0.025em] [--d:1]">{t('barber.pick')}</h1>
      <p className="rise px-1 text-[15px] text-muted [--d:1]">{t('barber.pickSub')}</p>
      <Card className="rise mt-5 overflow-hidden [--d:2]">
        <ul className="divide-y divide-line">
          {state.allBarbers
            .filter((b) => b.onDuty)
            .map((b) => (
              <li key={b.id}>
                <Link to={`/barber/${b.id}`} className="press flex min-h-[64px] items-center gap-3 px-5 hover:bg-canvas">
                  <span className="flex size-10 items-center justify-center rounded-full border-[1.5px] border-ink text-[16px]" aria-hidden="true">
                    {initial(b.name)}
                  </span>
                  <span className="flex-1 text-[16px] font-medium">{b.name}</span>
                  <ChevronRight size={20} className="text-subtle" aria-hidden="true" />
                </Link>
              </li>
            ))}
        </ul>
      </Card>
    </>
  );
}

function BarberView({ state, barberId }: { state: StaffState; barberId: string }) {
  const { t, lang } = useLang();
  const now = useTick(1000);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const b = state.allBarbers.find((x) => x.id === barberId);

  if (!b || !b.onDuty) {
    return (
      <Card className="mt-10 p-7 text-center">
        <p className="text-[16px] font-medium">{t('err.barber_unavailable')}</p>
        <Link to="/barber" className="mt-4 inline-flex min-h-[44px] items-center font-medium text-accent">
          {t('barber.switch')}
        </Link>
      </Card>
    );
  }

  const cur = state.visits.find((v) => v.assignedBarber === b.id && (v.status === 'called' || v.status === 'in_chair'));
  const next = b.next ? state.visits.find((v) => v.id === b.next) : undefined;
  const services = (ids: number[]) =>
    ids
      .map((sid) => state.allServices.find((s) => s.id === sid))
      .filter(Boolean)
      .map((s) => serviceName(lang, s!))
      .join(' + ');

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      setToast(t(errorKey(e)));
    }
  };

  const busy = !!cur;
  const elapsed = cur?.startedAt ? (now - cur.startedAt) / 1000 : 0;
  const over = cur?.status === 'in_chair' && elapsed > cur.minutes * 60;

  return (
    <>
      <div className="rise mt-5 flex items-center justify-between gap-3 px-1 [--d:1]">
        <h1 className="text-[28px] font-semibold tracking-[-0.025em]">{b.name}</h1>
        <div role="group" aria-label={t('barber.available')} className="flex gap-0.5 rounded-full bg-white p-[3px] shadow-card ring-hair">
          {[false, true].map((brk) => (
            <button
              key={String(brk)}
              type="button"
              aria-pressed={b.onBreak === brk}
              disabled={brk && busy}
              title={brk && busy ? t('barber.busyBreak') : undefined}
              onClick={() => b.onBreak !== brk && act(() => staffApi.post(`/barbers/${b.id}/break`, { onBreak: brk }))}
              className={cx(
                'press relative h-[38px] rounded-full px-3.5 text-[13px] font-medium',
                b.onBreak === brk ? 'text-white' : 'text-muted disabled:opacity-40',
              )}
            >
              {b.onBreak === brk && (
                <motion.span layoutId="barber-break" transition={SPRING} className="absolute inset-0 rounded-full bg-ink" aria-hidden="true" />
              )}
              <span className="relative">{brk ? t('barber.onBreak') : t('barber.available')}</span>
            </button>
          ))}
        </div>
      </div>
      {busy && <p className="mt-1 px-1 text-right text-[12px] text-subtle">{t('barber.busyBreak')}</p>}

      <AnimatePresence mode="wait">
      {cur ? (
        <motion.section
          key={cur.id}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE_OUT } }}
          exit={{ opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.2, ease: EASE_IN } }}
          className="mt-4 rounded-[28px] bg-pass px-[22px] pb-6 pt-[22px] text-white shadow-pass"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium tracking-[0.16em] text-white/60">{t('barber.current')}</div>
            <span className="flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium glass">
              <span className={cx('inline-block size-[7px] rounded-full', cur.status === 'called' ? 'animate-ping-soft bg-ok-glow' : 'bg-frost')} />
              <Roll value={cur.status === 'called' ? t('state.called') : t('state.in_chair')} />
            </span>
          </div>
          <div className="mt-3 text-[88px] font-light leading-[0.95] tracking-[-0.055em] tabular">{cur.token}</div>
          <div className="mt-3 text-[20px] font-medium">{cur.name}</div>
          <div className="text-[14px] text-white/70">
            {services(cur.serviceIds)} · {t('common.nMin', { n: cur.minutes })}
          </div>
          <div className="mt-5 h-px bg-white/12" />
          <div className={cx('mt-4 text-[15px] tabular', over ? 'font-semibold text-[#FFC978]' : 'text-white/80')}>
            {cur.status === 'called' ? t('barber.calledWait') : `${t('barber.elapsed', { time: mmss(elapsed) })}${over ? ` · ${t('barber.over')}` : ''}`}
          </div>
        </motion.section>
      ) : (
        <motion.div
          key={b.onBreak ? 'break' : 'free'}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE_OUT } }}
          exit={{ opacity: 0, y: -12, transition: { duration: 0.18, ease: EASE_IN } }}
        >
        <Card className="mt-4 flex items-center gap-4 p-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-canvas text-ink">
            {b.onBreak ? <Coffee size={22} aria-hidden="true" /> : <Scissors size={22} aria-hidden="true" />}
          </span>
          <div>
            <div className="text-[18px] font-semibold">{b.onBreak ? t('barber.breakTitle') : t('barber.freeTitle')}</div>
            <div className="text-[14px] text-muted">{b.onBreak ? t('barber.breakSub') : t('barber.freeSub')}</div>
          </div>
        </Card>
        </motion.div>
      )}
      </AnimatePresence>

      <Card className="rise mt-3.5 px-5 py-4 [--d:3]">
        <div className="text-[13px] font-medium text-muted">{t('barber.nextForYou')}</div>
        <motion.div key={next?.id ?? 'none'} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE_OUT } }} className="mt-1 text-[16px] font-medium">
          {next ? (
            <>
              <span className="tabular">{next.token}</span> {next.name} <span className="text-muted">({services(next.serviceIds)})</span>
            </>
          ) : (
            <span className="text-muted">{t('barber.noOne')}</span>
          )}
        </motion.div>
      </Card>

      <div className="flex-1" />

      <AnimatePresence>
        {cur && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: 40, transition: { duration: 0.2, ease: EASE_IN } }}
            whileTap={{ scale: 0.97 }}
            onClick={() => act(() => staffApi.post(`/visits/${cur.id}/${cur.status === 'called' ? 'start' : 'done'}`))}
            className={cx(
              'mt-6 h-24 w-full rounded-[28px] text-[24px] font-semibold tracking-[-0.01em] shadow-pass transition-colors duration-300',
              cur.status === 'called' ? 'bg-ink text-white hover:bg-navy-800' : 'bg-ok text-white hover:brightness-110',
            )}
          >
            <Roll value={cur.status === 'called' ? t('barber.start') : t('barber.done')} />
          </motion.button>
        )}
      </AnimatePresence>
      <Link to="/barber" className="mx-auto mt-3 flex min-h-[44px] items-center text-[14px] font-medium text-muted hover:text-ink">
        {t('barber.switch')}
      </Link>
      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
