import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { translate } from '../i18n/i18n';
import { clockTime, hhmmTo12, initial, longDate } from '../lib/format';
import { useConnected, useLiveState, useTick } from '../lib/live';
import { chime, unlockSound } from '../lib/sound';
import type { PublicBarber, PublicState } from '../lib/types';
import { AnimatePresence, motion } from 'motion/react';
import { ConnectionPill, cx } from '../components/ui';
import { EASE_OUT, Roll, rowMotion } from '../components/motion';

const W = 1920;
const H = 1080;
const en = (k: string, v?: Record<string, string | number>) => translate('en', k, v);
const gu = (k: string, v?: Record<string, string | number>) => translate('gu', k, v);

/** Waiting-area TV. Drawn at 1920×1080 and scaled to fit any screen. */
export default function Display() {
  const state = useLiveState();
  const connected = useConnected();
  const [scale, setScale] = useState(1);
  const [started, setStarted] = useState(false);
  const [flashing, setFlashing] = useState<Record<string, number>>({});
  const lastCalled = useRef<Record<string, string>>({});
  const primed = useRef(false);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Flash + chime when a barber calls a new token.
  useEffect(() => {
    if (!state) return;
    const fresh: string[] = [];
    for (const b of state.barbers) {
      if (b.current?.status === 'called') {
        if (primed.current && lastCalled.current[b.id] !== b.current.token) fresh.push(b.id);
        lastCalled.current[b.id] = b.current.token;
      } else {
        delete lastCalled.current[b.id];
      }
    }
    primed.current = true;
    if (fresh.length) {
      chime();
      const until = Date.now() + 5000;
      setFlashing((f) => ({ ...f, ...Object.fromEntries(fresh.map((id) => [id, until])) }));
      setTimeout(() => setFlashing((f) => Object.fromEntries(Object.entries(f).filter(([, u]) => u > Date.now()))), 5100);
    }
  }, [state]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-navy-950">
      <ConnectionPill connected={connected} dark />
      <div
        style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left', left: (window.innerWidth - W * scale) / 2, top: (window.innerHeight - H * scale) / 2 }}
        className="absolute"
      >
        {state ? <Board state={state} flashing={flashing} /> : <div className="size-full bg-night" />}
      </div>

      {!started && (
        <button
          type="button"
          onClick={() => {
            unlockSound();
            setStarted(true);
            document.documentElement.requestFullscreen?.().catch(() => undefined);
          }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-navy-950/80 text-white backdrop-blur-md"
        >
          <span className="text-[40px] font-medium tracking-[-0.02em]">{en('tv.click')}</span>
          <span lang="gu" className="mt-1 font-gu text-[28px] text-white/80">
            {gu('tv.click')}
          </span>
          <span className="mt-4 text-[18px] text-white/60">{en('tv.clickSub')}</span>
        </button>
      )}
    </div>
  );
}

function Board({ state, flashing }: { state: PublicState; flashing: Record<string, number> }) {
  const now = useTick(1000);
  const barbers = state.barbers;
  const upNext = state.queue.slice(0, 5);
  const rowH = Math.min(206, Math.floor(700 / Math.max(1, barbers.length)) - 18);
  const nameOf = (id: string | null) => (id ? barbers.find((b) => b.id === id)?.name ?? '' : en('common.anyBarber'));

  return (
    <div
      className="flex size-full flex-col px-[72px] pb-10 pt-12 text-white tabular"
      style={{
        background:
          'radial-gradient(1300px 700px at 88% -12%, rgba(80,124,220,0.38), rgba(80,124,220,0) 62%), linear-gradient(180deg, #0A1430 0%, #0F1E45 100%)',
      }}
    >
      <header className="rise flex items-center justify-between">
        <div className="flex items-center gap-[22px]">
          <div className="flex size-[68px] items-center justify-center rounded-full border-2 border-white text-[30px] font-medium">K</div>
          <div>
            <div className="text-[40px] font-medium leading-tight tracking-[-0.02em]">Kesh Studio</div>
            <div className="text-[15px] font-medium tracking-[0.22em] text-white/60">HAIR &amp; GROOMING</div>
          </div>
        </div>
        <div className="flex items-center gap-9">
          <div className="flex h-[52px] items-center gap-3 rounded-full px-[22px] text-[21px] font-medium glass">
            <span
              className={cx('inline-block size-[11px] rounded-full', state.salon.onlineOpen ? 'bg-ok-glow shadow-[0_0_12px_var(--color-ok-glow)]' : 'bg-white/40')}
            />
            <Roll value={state.salon.onlineOpen ? en('tv.onlineOpen') : en('tv.onlineClosed')} />
            <span lang="gu" className="font-gu text-white/60">
              · {state.salon.onlineOpen ? gu('tv.onlineOpen') : gu('tv.onlineClosed')}
            </span>
          </div>
          <div className="text-right">
            <div className="text-[56px] font-extralight leading-none tracking-[-0.03em]">
              <Roll value={clockTime(now)} />
            </div>
            <div className="mt-1 text-[19px] text-white/60">{longDate(now)}</div>
          </div>
        </div>
      </header>

      <div className="mt-11 flex min-h-0 flex-1 gap-10">
        <section className="rise flex flex-[1.55] flex-col [--d:2]">
          <h2 className="flex items-baseline gap-3.5 px-2">
            <span className="text-[30px] font-medium tracking-[-0.01em]">{en('tv.nowServing')}</span>
            <span lang="gu" className="font-gu text-[26px] font-medium text-white/60">
              {gu('tv.nowServing')}
            </span>
          </h2>
          {barbers.length === 0 && <p className="mt-6 px-2 text-[28px] text-white/60">{en('home.noBarbers')}</p>}
          {barbers.map((b) => (
            <BarberRow key={b.id} b={b} height={rowH} flashing={!!flashing[b.id]} now={now} />
          ))}
        </section>

        <section className="rise flex flex-1 flex-col rounded-[36px] px-[38px] py-[34px] glass [--d:4]">
          <h2 className="flex items-baseline gap-3.5">
            <span className="text-[30px] font-medium">{en('tv.upNext')}</span>
            <span lang="gu" className="font-gu text-[26px] font-medium text-white/60">
              {gu('tv.upNext')}
            </span>
          </h2>
          {upNext.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } }} className="mt-8 text-[30px] font-medium leading-snug text-white/80">
              {en('tv.empty')}
              <div lang="gu" className="mt-2 font-gu text-[24px] text-white/60">
                {gu('tv.empty')}
              </div>
            </motion.div>
          ) : (
            <ul className="mt-2.5">
              <AnimatePresence initial={false} mode="popLayout">
              {upNext.map((u) => (
                <motion.li key={u.token} {...rowMotion} className="grid h-[86px] grid-cols-[150px_minmax(0,1fr)_130px] items-center gap-[18px] border-b border-white/8">
                  <span className="text-[50px] font-light tracking-[-0.04em]">{u.token}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[30px] font-medium leading-tight">{u.displayName}</span>
                    <span className="block truncate text-[19px] text-white/58">{nameOf(u.barberPref)}</span>
                  </span>
                  <span className="text-right text-[30px] font-light">
                    <Roll value={u.wait === null ? '' : u.wait === 0 ? 'now' : `~${u.wait} min`} />
                  </span>
                </motion.li>
              ))}
              </AnimatePresence>
            </ul>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-[26px]">
            <div className="flex size-[140px] shrink-0 items-center justify-center rounded-[22px] bg-white">
              <QRCodeSVG value={`${window.location.origin}/`} size={112} fgColor="#0B1630" bgColor="#FFFFFF" level="M" aria-label="QR code to join the queue" />
            </div>
            <div>
              <div className="text-[32px] font-medium tracking-[-0.01em]">{en('tv.scan')}</div>
              <div lang="gu" className="mt-0.5 font-gu text-[24px] font-medium text-white/80">
                {gu('tv.scan')}
              </div>
              <div className="mt-1.5 text-[21px] text-white/60">
                <Roll value={state.waitNewAny ? en('tv.currentWait', { n: state.waitNewAny }) : en('tv.noWait')} />
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-[30px] flex justify-between text-[19px] text-white/55">
        <span>
          {en('tv.footer', { time: hhmmTo12(state.salon.onlineUntil) })}{' '}
          <span lang="gu" className="font-gu">
            · {gu('tv.footer', { time: hhmmTo12(state.salon.onlineUntil) })}
          </span>
        </span>
        <span>
          <Roll value={en('tv.counts', { b: barbers.length, w: state.waitingCount })} />
        </span>
      </footer>
    </div>
  );
}

function BarberRow({ b, height, flashing, now }: { b: PublicBarber; height: number; flashing: boolean; now: number }) {
  const calling = b.state === 'called';
  const dim = b.state === 'break';
  let statusEn = en('state.free');
  let statusGu = gu('state.free');
  let detail = en('tv.nextPlease');
  if (b.state === 'in_chair' && b.current) {
    const left = Math.max(1, Math.ceil(b.current.minutes - (now - (b.current.startedAt ?? now)) / 60000));
    statusEn = en('state.in_chair');
    statusGu = gu('state.in_chair');
    detail = en('tv.leftMin', { n: left });
  } else if (calling) {
    statusEn = en('state.called');
    statusGu = gu('state.called');
    detail = en('tv.pleaseCome');
  } else if (dim) {
    statusEn = en('state.break');
    statusGu = gu('state.break');
    detail = en('tv.backSoon');
  }
  const dot = calling ? 'bg-accent' : b.state === 'in_chair' ? 'bg-ok-glow' : b.state === 'free' ? 'bg-frost' : 'bg-white/35';

  return (
    <div
      className={cx(
        'mt-[18px] flex items-center gap-[30px] rounded-[32px] pl-9 pr-11 transition-[background-color,color,box-shadow] duration-700 ease-out',
        calling ? 'bg-white text-ink' : 'glass',
        calling && flashing && 'animate-flash',
        dim && 'text-white/55',
      )}
      style={{
        height,
        boxShadow: calling && !flashing ? '0 0 0 8px rgba(255,255,255,0.08), 0 30px 80px -10px rgba(91,140,255,0.55)' : undefined,
      }}
    >
      <div
        className={cx(
          'flex size-[100px] shrink-0 items-center justify-center rounded-full border-2 text-[40px] transition-colors duration-700',
          calling ? 'border-ink' : dim ? 'border-white/18' : 'border-white/35',
        )}
      >
        {initial(b.name)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="truncate text-[54px] font-medium leading-none tracking-[-0.025em]">{b.name}</div>
        <div className={cx('flex items-center gap-3 text-[26px]', calling ? 'text-[#33405F]' : dim ? 'text-white/50' : 'text-white/70')}>
          <span className={cx('inline-block size-3 rounded-full', dot)} />
          <Roll value={`${statusEn} · ${detail}`} />
          <span lang="gu" className="font-gu">
            · <Roll value={statusGu} />
          </span>
        </div>
      </div>
      <div className={cx('text-[128px] font-extralight tracking-[-0.06em] transition-colors duration-500', calling ? 'text-ink' : dim || !b.current ? 'text-white/25' : 'text-white')}>
        <Roll value={b.current?.token ?? '—'} />
      </div>
    </div>
  );
}
