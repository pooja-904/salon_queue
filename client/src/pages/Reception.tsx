import { useCallback, useState } from 'react';
import { Phone, Plus, UserX, X } from 'lucide-react';
import { serviceName, useLang } from '../i18n/i18n';
import { errorKey, staffApi } from '../lib/api';
import { clockTime, minutesSince, mmss } from '../lib/format';
import { useConnected, useStaffState, useTick } from '../lib/live';
import type { StaffState, StaffVisit } from '../lib/types';
import { PinGate } from '../components/PinGate';
import { Chip, StaffHeader, formatPhone } from '../components/StaffHeader';
import { WalkinDialog } from '../components/WalkinDialog';
import { AnimatePresence, motion } from 'motion/react';
import { Button, ConnectionPill, Dialog, Toast, cx } from '../components/ui';
import { EASE_OUT, Roll, SPRING, rowMotion } from '../components/motion';

export default function Reception() {
  return <PinGate>{(pin, lock) => <ReceptionScreen pin={pin} lock={lock} />}</PinGate>;
}

function ReceptionScreen({ pin, lock }: { pin: string; lock: () => void }) {
  const { t } = useLang();
  const { state, socket } = useStaffState(pin);
  const connected = useConnected(socket);
  const now = useTick(1000);
  const [tab, setTab] = useState<'queue' | 'today'>('queue');
  const [walkin, setWalkin] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<StaffVisit | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      setToast(t(errorKey(e)));
    }
  };

  if (!state) {
    return (
      <main className="min-h-dvh bg-canvas p-6">
        <div className="skeleton h-12 w-64 rounded-2xl" />
        <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_3fr]">
          <div className="skeleton h-[420px] rounded-3xl" />
          <div className="skeleton h-[420px] rounded-3xl" />
        </div>
      </main>
    );
  }

  const waiting = state.visits.filter((v) => v.status === 'waiting').sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const longest = waiting.reduce((m, v) => Math.max(m, minutesSince(v.joinedAt, now)), 0);

  return (
    <main className="min-h-dvh bg-canvas px-5 pb-8 pt-4 lg:px-7">
      <ConnectionPill connected={connected} />
      <StaffHeader
        title={t('rec.title')}
        onLock={lock}
        center={
          <>
            <Chip>
              <Roll value={t('rec.waiting', { n: waiting.length })} />
            </Chip>
            {waiting.length > 0 && (
              <Chip tone={longest > 60 ? 'warn' : 'plain'}>
                <Roll value={t('rec.longest', { n: longest })} />
              </Chip>
            )}
            <Chip tone={state.salon.onlineOpen ? 'ok' : 'off'}>{state.salon.onlineOpen ? t('rec.onlineOpen') : t('rec.onlineClosed')}</Chip>
          </>
        }
        right={
          <Button onClick={() => setWalkin(true)} className="h-11">
            <Plus size={18} aria-hidden="true" />
            {t('rec.addWalkin')}
          </Button>
        }
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby="barbers-h" className="rise [--d:1]">
          <h2 id="barbers-h" className="px-1 text-[14px] font-semibold text-muted">
            {t('rec.barbers')}
          </h2>
          <motion.div layout className="mt-2.5 flex flex-col gap-3">
            {state.allBarbers
              .filter((b) => b.onDuty)
              .map((b) => (
                <BarberCard key={b.id} barberId={b.id} state={state} now={now} act={act} />
              ))}
          </motion.div>
        </section>

        <section className="rise [--d:2]">
          <div role="tablist" className="flex gap-1 rounded-full bg-white p-1 shadow-card ring-hair w-fit">
            {(['queue', 'today'] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cx('press relative h-9 rounded-full px-4 text-[14px] font-medium', tab === k ? 'text-white' : 'text-muted hover:text-ink')}
              >
                {tab === k && <motion.span layoutId="rec-tab" transition={SPRING} className="absolute inset-0 rounded-full bg-ink" aria-hidden="true" />}
                <span className="relative">{k === 'queue' ? `${t('rec.queueTab')} · ${waiting.length}` : t('rec.todayTab')}</span>
              </button>
            ))}
          </div>

          {tab === 'queue' ? (
            <motion.div layout className="mt-3 overflow-hidden rounded-3xl bg-white shadow-card" transition={{ layout: { duration: 0.36, ease: EASE_OUT } }}>
              {waiting.length === 0 ? (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 py-12 text-center text-[15px] text-muted">
                  {t('rec.empty')}
                </motion.p>
              ) : (
                <ul>
                  <AnimatePresence initial={false} mode="popLayout">
                    {waiting.map((v) => (
                      <QueueRow key={v.id} v={v} state={state} now={now} onCancel={() => setCancelling(v)} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </motion.div>
          ) : (
            <TodayList state={state} act={act} onReadd={(token) => setToast(t('rec.added', { token }))} />
          )}
        </section>
      </div>

      <WalkinDialog
        open={walkin}
        state={state}
        onClose={() => setWalkin(false)}
        onAdded={(token) => {
          setWalkin(false);
          setToast(t('rec.added', { token }));
        }}
      />
      <Dialog open={!!cancelling} title={t('rec.cancelConfirm', { token: cancelling?.token ?? '', name: cancelling?.name ?? '' })} onClose={() => setCancelling(null)}>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="h-12 flex-1" onClick={() => setCancelling(null)} autoFocus>
            {t('common.back')}
          </Button>
          <Button
            variant="danger"
            className="h-12 flex-1"
            onClick={() => {
              const v = cancelling;
              setCancelling(null);
              if (v) void act(() => staffApi.post(`/visits/${v.id}/cancel`));
            }}
          >
            {t('rec.cancel')}
          </Button>
        </div>
      </Dialog>
      <Toast message={toast} onDone={clearToast} />
    </main>
  );
}

function servicesText(state: StaffState, ids: number[], lang: 'en' | 'gu') {
  return ids
    .map((id) => state.allServices.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => serviceName(lang, s!))
    .join(' + ');
}

function BarberCard({
  barberId,
  state,
  now,
  act,
}: {
  barberId: string;
  state: StaffState;
  now: number;
  act: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const { t, lang } = useLang();
  const b = state.allBarbers.find((x) => x.id === barberId)!;
  const cur = state.visits.find((v) => v.assignedBarber === b.id && (v.status === 'called' || v.status === 'in_chair'));
  const next = b.next ? state.visits.find((v) => v.id === b.next) : undefined;
  const stateLabel = { free: t('state.free'), called: t('state.called'), in_chair: t('state.in_chair'), break: t('state.break'), off: t('state.off') }[b.state];

  if (cur?.status === 'called') {
    const elapsed = (now - (cur.calledAt ?? now)) / 1000;
    const leftToNoShow = state.noShowMinutes * 60 - elapsed;
    return (
      <motion.article
        key={`${b.id}-${cur.id}`}
        layout
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.34, ease: EASE_OUT } }}
        className="rounded-3xl bg-pass p-5 text-white shadow-pass"
      >
        <div className="flex items-center justify-between">
          <div className="text-[18px] font-semibold">{b.name}</div>
          <span className="flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium glass">
            <span className="inline-block size-[7px] animate-ping-soft rounded-full bg-ok-glow" />
            {stateLabel}
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-[44px] font-light leading-none tracking-[-0.04em] tabular">{cur.token}</span>
          <span className="text-[17px] font-medium">{cur.name}</span>
        </div>
        <div className="mt-1 text-[13px] text-white/70">
          {servicesText(state, cur.serviceIds, lang)} · {elapsed < 60 ? t('rec.calledJust') : t('rec.calledAgo', { n: Math.floor(elapsed / 60) })}
        </div>
        <div className="mt-4 flex gap-2">
          <a href={`tel:+91${cur.phone}`} className="press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-medium text-ink hover:bg-frost">
            <Phone size={16} aria-hidden="true" />
            {t('rec.callPhone')}
          </a>
          <button
            type="button"
            disabled={!cur.canNoShow && leftToNoShow > 0}
            onClick={() => act(() => staffApi.post(`/visits/${cur.id}/no-show`))}
            className="press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-medium glass hover:bg-white/15 disabled:text-white/50"
          >
            <UserX size={16} aria-hidden="true" />
            {!cur.canNoShow && leftToNoShow > 0 ? t('rec.noShowIn', { time: mmss(leftToNoShow) }) : t('rec.noShow')}
          </button>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      key={`${b.id}-${cur?.id ?? b.state}`}
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.34, ease: EASE_OUT } }}
      className="rounded-3xl bg-white p-5 shadow-card"
    >
      <div className="flex items-center justify-between">
        <div className={cx('text-[18px] font-semibold', b.state === 'break' && 'text-muted')}>{b.name}</div>
        <span
          className={cx(
            'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium',
            b.state === 'free' ? 'bg-ok/10 text-ok' : b.state === 'break' ? 'bg-canvas text-muted' : 'bg-accent/10 text-accent',
          )}
        >
          <span className={cx('inline-block size-[7px] rounded-full', b.state === 'free' ? 'bg-ok' : b.state === 'break' ? 'bg-subtle' : 'bg-accent')} />
          {stateLabel}
        </span>
      </div>

      {cur?.status === 'in_chair' && <InChair cur={cur} state={state} now={now} />}

      {b.state === 'free' && (
        <>
          <p className="mt-2 text-[14px] text-muted">
            <Roll value={next ? t('rec.next', { token: next.token, name: next.name }) : t('rec.noneFor', { name: b.name })} />
          </p>
          <Button className="mt-3 h-12 w-full" disabled={!next} onClick={() => act(() => staffApi.post(`/barbers/${b.id}/call-next`))}>
            {t('rec.callNext')}
          </Button>
        </>
      )}
      {b.state === 'break' && <p className="mt-2 text-[14px] text-muted">{t('rec.onBreak')}</p>}
    </motion.article>
  );
}

function InChair({ cur, state, now }: { cur: StaffVisit; state: StaffState; now: number }) {
  const { t, lang } = useLang();
  const used = (now - (cur.startedAt ?? now)) / 60000;
  const left = Math.ceil(cur.minutes - used);
  const frac = Math.min(1, used / cur.minutes);
  return (
    <div className="mt-3">
      <div className="flex items-baseline gap-3">
        <span className="text-[32px] font-light leading-none tracking-[-0.04em] tabular">{cur.token}</span>
        <span className="text-[16px] font-medium">{cur.name}</span>
      </div>
      <div className="mt-1 text-[13px] text-muted">{servicesText(state, cur.serviceIds, lang)}</div>
      <div className="mt-3 h-1.5 rounded-full bg-line" aria-hidden="true">
        <div
          className={cx('h-full rounded-full transition-[width] duration-1000 ease-out', left < 0 ? 'bg-warn' : 'bg-gradient-to-r from-navy-700 to-accent')}
          style={{ width: `${frac * 100}%` }}
        />
      </div>
      <div className={cx('mt-1.5 text-right text-[13px] font-medium tabular', left < 0 ? 'text-warn' : 'text-muted')}>
        {left < 0 ? t('rec.over', { n: -left }) : t('rec.left', { n: Math.max(0, left) })}
      </div>
    </div>
  );
}

function QueueRow({ v, state, now, onCancel }: { v: StaffVisit; state: StaffState; now: number; onCancel: () => void }) {
  const { t, lang } = useLang();
  const waited = minutesSince(v.joinedAt, now);
  const pref = v.barberPref ? state.allBarbers.find((b) => b.id === v.barberPref)?.name : t('common.anyBarber');
  return (
    <motion.li
      {...rowMotion}
      className={cx('grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-5 py-3.5 transition-colors duration-500 last:border-b-0', waited > 60 && 'bg-warn-bg')}
    >
      <div className="text-[26px] font-light tracking-[-0.03em] tabular">{v.token}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 text-[15px] font-medium">
          <span className="truncate">{v.name}</span>
          <span className="text-[12px] font-normal text-subtle tabular">{formatPhone(v.phone)}</span>
          <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">{v.source === 'walkin' ? t('rec.walkin') : t('rec.online')}</span>
        </div>
        <div className="truncate text-[13px] text-muted">
          {servicesText(state, v.serviceIds, lang)} · <span className="font-medium text-ink">{pref}</span>
        </div>
        <div className={cx('text-[12px] tabular', waited > 60 ? 'font-semibold text-warn' : 'text-subtle')}>
          {t('rec.waited', { n: waited })} · <Roll value={v.wait === 0 ? t('rec.estNow') : v.wait === null ? '' : t('rec.est', { n: v.wait })} />
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="press flex size-11 items-center justify-center rounded-full text-muted hover:bg-danger-bg hover:text-danger"
        aria-label={`${t('rec.cancel')} ${v.token}`}
        title={t('rec.cancel')}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </motion.li>
  );
}

function TodayList({ state, act, onReadd }: { state: StaffState; act: (fn: () => Promise<unknown>) => Promise<void>; onReadd: (token: string) => void }) {
  const { t, lang } = useLang();
  const groups: { key: string; title: string; items: StaffVisit[] }[] = [
    { key: 'progress', title: t('rec.inProgress'), items: state.visits.filter((v) => v.status === 'called' || v.status === 'in_chair') },
    { key: 'noshow', title: t('rec.noShows'), items: state.visits.filter((v) => v.status === 'no_show') },
    { key: 'done', title: t('rec.done'), items: state.visits.filter((v) => v.status === 'done') },
    { key: 'cancelled', title: t('rec.cancelled'), items: state.visits.filter((v) => v.status === 'cancelled') },
  ].filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return <p className="mt-3 rounded-3xl bg-white px-6 py-12 text-center text-[15px] text-muted shadow-card">{t('rec.nothingToday')}</p>;
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {groups.map((g, i) => (
        <div key={g.key} className="rise overflow-hidden rounded-3xl bg-white shadow-card" style={{ '--d': i } as React.CSSProperties}>
          <h3 className="px-5 pb-1 pt-4 text-[13px] font-semibold text-muted">
            {g.title} · {g.items.length}
          </h3>
          <ul className="divide-y divide-line">
            {g.items.map((v) => (
              <motion.li key={v.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-5 py-3">
                <span className="w-[64px] text-[20px] font-light tabular">{v.token}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{v.name}</div>
                  <div className="truncate text-[12px] text-subtle">
                    {servicesText(state, v.serviceIds, lang)} · {clockTime(v.endedAt ?? v.calledAt ?? v.joinedAt)}
                  </div>
                </div>
                {v.status === 'no_show' && (
                  <Button
                    variant="secondary"
                    className="h-10"
                    onClick={() =>
                      act(async () => {
                        const r = await staffApi.post<{ token: string }>(`/visits/${v.id}/readd`);
                        onReadd(r.token);
                      })
                    }
                  >
                    {t('rec.readd')}
                  </Button>
                )}
              </motion.li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
