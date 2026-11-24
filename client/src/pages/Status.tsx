import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bell, Volume2, VolumeX } from 'lucide-react';
import { ordinal, serviceName, useLang } from '../i18n/i18n';
import { api, ApiError, errorKey } from '../lib/api';
import { mmss, rupees, waitText } from '../lib/format';
import { useConnected, useOnStateChange, useTick } from '../lib/live';
import { chime, soundReady, unlockSound, vibrate } from '../lib/sound';
import { load, save } from '../lib/storage';
import type { VisitView } from '../lib/types';
import { motion } from 'motion/react';
import { Button, Card, ConnectionPill, Dialog, Ring, TopBar, cx } from '../components/ui';
import { EASE_OUT, Reveal, Roll } from '../components/motion';

export default function Status() {
  const { id = '' } = useParams();
  const { t } = useLang();
  const connected = useConnected();
  const [visit, setVisit] = useState<VisitView | null>(null);
  const [missing, setMissing] = useState(false);
  const prevStatus = useRef<string | null>(null);

  const refresh = useCallback(() => {
    api
      .get<VisitView>(`/api/visits/${id}`)
      .then((v) => {
        setVisit(v);
        setMissing(false);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setMissing(true);
      });
  }, [id]);

  useEffect(() => {
    if (load('sq.myVisit') !== id) save('sq.myVisit', id);
    refresh();
    const poll = setInterval(refresh, 20_000); // safety net if the socket drops
    return () => clearInterval(poll);
  }, [id, refresh]);
  useOnStateChange(refresh);

  // Alert the moment the customer is called.
  useEffect(() => {
    if (!visit) return;
    if (visit.status === 'called' && prevStatus.current && prevStatus.current !== 'called') {
      chime();
      vibrate();
    }
    prevStatus.current = visit.status;
  }, [visit]);

  if (missing) {
    return (
      <Shell>
        <Card className="mt-10 p-7 text-center">
          <p className="text-[16px] font-medium">{t('status.notFound')}</p>
          <Link to="/" className="mt-4 inline-flex min-h-[44px] items-center font-medium text-accent">
            {t('status.goHome')}
          </Link>
        </Card>
      </Shell>
    );
  }
  if (!visit) {
    return (
      <Shell>
        <div className="skeleton mt-24 h-[300px] rounded-[28px]" />
      </Shell>
    );
  }

  if (visit.status === 'called') return <YourTurn visit={visit} connected={connected} />;

  return (
    <Shell connected={connected}>
      {visit.status === 'waiting' && <Waiting visit={visit} onCancelled={refresh} />}
      {visit.status === 'in_chair' && <EndCard title={t('chair.title')} sub={`${t('chair.with', { name: visit.assignedBarber?.name ?? '' })} · ${t('chair.sub')}`} token={visit.token} />}
      {visit.status === 'done' && <EndCard title={t('done.title')} sub={t('done.sub')} token={visit.token} again />}
      {visit.status === 'cancelled' && <EndCard title={t('cancelled.title')} sub={t('cancelled.sub')} token={visit.token} again />}
      {visit.status === 'no_show' && <EndCard title={t('noshow.title')} sub={t('noshow.sub')} token={visit.token} />}
    </Shell>
  );
}

function Shell({ children, connected = true }: { children: React.ReactNode; connected?: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-[18px] pb-6 pt-3.5">
      <ConnectionPill connected={connected} />
      <TopBar />
      {children}
    </main>
  );
}

function SoundButton({ dark = false }: { dark?: boolean }) {
  const { t } = useLang();
  const [ready, setReady] = useState(soundReady());
  if (ready) {
    return (
      <span className={cx('flex items-center gap-1.5 text-[13px]', dark ? 'text-white/70' : 'text-muted')}>
        <Volume2 size={16} aria-hidden="true" />
        {t('status.soundOn')}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        unlockSound();
        setTimeout(() => setReady(soundReady()), 50);
      }}
      className={cx('flex min-h-[44px] items-center gap-1.5 text-[13px] font-medium underline-offset-4 hover:underline', dark ? 'text-white' : 'text-ink')}
    >
      <VolumeX size={16} aria-hidden="true" />
      {t('status.soundOff')}
    </button>
  );
}

/** One beat of the "your turn" entrance: fade up after `delay` seconds. */
const beat = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT, delay } },
});

const STEPS = ['status.step.joined', 'status.step.ready', 'status.step.turn', 'status.step.chair', 'status.step.done'];

function Waiting({ visit, onCancelled }: { visit: VisitView; onCancelled: () => void }) {
  const { t, lang } = useLang();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pos = visit.position ?? 1;
  const ahead = pos - 1;
  const step = visit.getReady ? 1 : 0;
  const fill = step === 0 ? 10 : 25;

  const cancel = async () => {
    try {
      await api.post(`/api/visits/${visit.id}/cancel`);
      setConfirming(false);
      onCancelled();
    } catch (e) {
      setError(t(errorKey(e)));
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="rise mt-5 px-1 [--d:1]">
        <div className="text-[15px] text-muted">{t('status.hi', { name: visit.firstName })}</div>
        <h1 className="mt-0.5 text-[28px] font-semibold tracking-[-0.025em]">{t('status.inLine')}</h1>
      </div>

      <Reveal show={visit.getReady}>
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-3xl bg-ink px-5 py-4 text-white shadow-pass">
          <Bell size={20} className="mt-0.5 shrink-0 text-ok-glow" aria-hidden="true" />
          <div>
            <div className="text-[16px] font-semibold">{t('status.startComing')}</div>
            <div className="text-[14px] text-white/70">{t('status.startComingSub', { wait: waitText(t, visit.wait) })}</div>
          </div>
        </div>
      </Reveal>

      <Reveal show={!!visit.barberPref?.onBreak}>
        <div role="status" className="mt-3 rounded-2xl bg-warn-bg px-4 py-3 text-[14px] font-medium text-warn">
          {t('status.onBreak', { name: visit.barberPref?.name ?? '' })}
        </div>
      </Reveal>

      <section className="rise mt-4 rounded-[28px] bg-pass px-[22px] pb-5 pt-[22px] text-white shadow-pass [--d:2]" aria-live="polite">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium tracking-[0.16em] text-white/60">{t('status.yourToken')}</div>
          <div className="flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium glass">
            <span className="inline-block size-[7px] animate-ping-soft rounded-full bg-ok-glow" />
            {t('common.live')}
          </div>
        </div>
        <div className="mt-3.5 text-[112px] font-light leading-[0.95] tracking-[-0.055em] tabular">{visit.token}</div>
        <div className="mt-5 h-px bg-white/12" />
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-[10px] font-medium tracking-[0.14em] text-white/60">{t('status.position')}</dt>
            <dd className="mt-1 text-[20px] font-medium tabular">
              <Roll value={ordinal(t, pos)} />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium tracking-[0.14em] text-white/60">{t('status.estWait')}</dt>
            <dd className="mt-1 text-[20px] font-medium tabular">
              <Roll value={visit.wait === null ? '–' : visit.wait === 0 ? t('rec.estNow') : t('common.nMin', { n: visit.wait })} />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium tracking-[0.14em] text-white/60">{t('status.barber')}</dt>
            <dd className="mt-1 truncate text-[20px] font-medium">{visit.barberPref?.name ?? t('status.any')}</dd>
          </div>
        </dl>
      </section>

      <Card className="rise mt-3.5 px-5 pb-4 pt-[18px] [--d:3]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold">{t('status.progress')}</h2>
          <div className="text-[13px] text-muted">
            <Roll value={ahead === 0 ? t('status.youreNext') : ahead === 1 ? t('status.aheadOne') : t('status.aheadMany', { n: ahead })} />
          </div>
        </div>
        <div className="relative mt-3.5 h-1.5 rounded-full bg-line" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={5}>
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-navy-700 to-accent"
            initial={{ width: '0%' }}
            animate={{ width: `${fill}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.35 }}
          />
          <motion.div
            className="absolute top-1/2 -ml-[7px] -mt-[7px] size-3.5 rounded-full bg-white shadow-[0_0_0_3px_var(--color-accent),0_0_12px_rgba(59,99,184,0.6)]"
            initial={{ left: '0%', scale: 0 }}
            animate={{ left: `${fill}%`, scale: 1 }}
            transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.35 }}
          />
        </div>
        <ol className="mt-3 grid grid-cols-5 text-[11px] text-subtle">
          {STEPS.map((key, i) => (
            <li key={key} className={cx('transition-colors duration-300', i === 0 ? 'text-left' : i === 4 ? 'text-right' : 'text-center', i <= step && 'font-semibold text-ink')}>
              {t(key)}
            </li>
          ))}
        </ol>
      </Card>

      <Card className="rise mt-3.5 flex flex-col gap-2.5 px-5 py-4 text-[14px] [--d:4]">
        {visit.services.map((s) => (
          <div key={s.nameEn} className="flex justify-between">
            <span>{serviceName(lang, s)}</span>
            <span className="tabular text-muted">
              {t('common.nMin', { n: s.minutes })} · {rupees(s.price)}
            </span>
          </div>
        ))}
        <div className="h-px bg-line" />
        <div className="flex justify-between font-semibold">
          <span>{t('common.total')}</span>
          <span className="tabular">
            {t('common.nMin', { n: visit.minutes })} · {rupees(visit.price)}
          </span>
        </div>
      </Card>

      <div className="rise mt-4 flex flex-col items-start gap-1 px-1.5 [--d:5]">
        <p className="flex items-start gap-2 text-[13px] leading-snug text-muted">
          <Bell size={16} className="mt-px shrink-0" aria-hidden="true" />
          {t('status.keepOpen')}
        </p>
        <SoundButton />
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-danger-bg px-4 py-3 text-[14px] text-danger">
          {error}
        </p>
      )}

      <div className="flex-1" />
      <Button variant="danger" className="rise mt-6 h-[52px] w-full [--d:6]" onClick={() => setConfirming(true)}>
        {t('status.cancel')}
      </Button>

      <Dialog open={confirming} title={t('status.cancelTitle')} onClose={() => setConfirming(false)}>
        <p className="text-[15px] text-muted">{t('status.cancelBody', { pos: t('pos.inLine', { pos: ordinal(t, pos) }) })}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="primary" className="h-12" onClick={() => setConfirming(false)} autoFocus>
            {t('status.keep')}
          </Button>
          <Button variant="danger" className="h-12" onClick={cancel}>
            {t('status.yesCancel')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function YourTurn({ visit, connected }: { visit: VisitView; connected: boolean }) {
  const { t } = useLang();
  const now = useTick(1000);
  const total = visit.noShowMinutes * 60;
  const elapsed = visit.calledAt ? (now - visit.calledAt) / 1000 : 0;
  const left = Math.max(0, total - elapsed);
  const barberName = visit.assignedBarber?.name ?? '';
  const goTo = t('turn.goTo', { name: '\u0000' }).split('\u0000');

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4, ease: EASE_OUT } }}
      className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col overflow-hidden bg-night px-[18px] pb-6 pt-3.5 text-white"
    >
      <ConnectionPill connected={connected} dark />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-36 h-[420px] w-[510px] animate-glow rounded-full bg-[radial-gradient(closest-side,rgba(91,140,255,0.45),rgba(91,140,255,0))]"
      />
      <div className="relative">
        <TopBar dark />
      </div>

      <div role="alert" className="relative flex flex-1 flex-col items-center justify-center text-center">
        <motion.div {...beat(0.1)} className="flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-white/70">
          <span className="inline-block size-2 animate-ping-soft rounded-full bg-ok-glow" />
          {t('turn.nowCalling')}
        </motion.div>
        <motion.h1 {...beat(0.18)} className="mt-3.5 text-[30px] font-medium tracking-[-0.02em]">
          {t('turn.title')}
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, scale: 1.14, filter: 'blur(18px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.75, ease: EASE_OUT, delay: 0.26 } }}
          className="mt-2 text-[156px] font-extralight leading-[0.95] tracking-[-0.06em] tabular [text-shadow:0_0_40px_rgba(120,160,255,0.45)]"
        >
          {visit.token}
        </motion.div>
        <motion.div {...beat(0.55)} className="mt-6 flex h-14 items-center gap-3 rounded-full pl-2 pr-[22px] glass">
          <span className="flex size-10 items-center justify-center rounded-full bg-white text-[17px] font-semibold text-ink">
            {barberName.charAt(0)}
          </span>
          <span className="text-[17px] text-white/80">
            {goTo[0]}
            <strong className="font-semibold text-white">{barberName}</strong>
            {goTo[1]}
          </span>
        </motion.div>
      </div>

      <motion.div {...beat(0.68)} className="relative flex items-center gap-4 rounded-3xl px-[18px] py-4 glass">
        <Ring size={60} stroke={5} fraction={total ? left / total : 0} color="#FFFFFF" track="rgba(255,255,255,0.14)" />
        <div>
          <div className="text-[13px] text-white/70">{left > 0 ? t('turn.reachIn') : t('turn.overdue')}</div>
          <div className="text-[36px] font-light leading-tight tracking-[-0.02em] tabular" aria-live="off">
            {mmss(left)}
          </div>
        </div>
      </motion.div>
      <motion.div {...beat(0.8)} className="relative mt-3 flex flex-col items-center gap-1 text-center">
        <p className="text-[13px] text-white/60">{t('turn.cantMake')}</p>
        <SoundButton dark />
      </motion.div>
    </motion.main>
  );
}

function EndCard({ title, sub, token, again }: { title: string; sub: string; token: string; again?: boolean }) {
  const { t } = useLang();
  return (
    <div className="flex flex-1 flex-col">
      <section className="rise mt-8 rounded-[28px] bg-pass px-[22px] py-7 text-white shadow-pass">
        <div className="text-[11px] font-medium tracking-[0.16em] text-white/60">{t('status.yourToken')}</div>
        <div className="mt-2 text-[72px] font-light leading-none tracking-[-0.05em] tabular">{token}</div>
        <h1 className="mt-6 text-[24px] font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-1 text-[15px] text-white/70">{sub}</p>
      </section>
      <div className="flex-1" />
      {again && (
        <Link to="/join" className="mt-6 flex h-14 items-center justify-center rounded-[18px] bg-ink text-[17px] font-medium text-white">
          {t('done.joinAgain')}
        </Link>
      )}
      <Link to="/" className="mx-auto mt-2 flex min-h-[44px] items-center text-[14px] font-medium text-muted">
        {t('status.goHome')}
      </Link>
    </div>
  );
}

