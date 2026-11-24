import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { ordinal, useLang } from '../i18n/i18n';
import { api, ApiError, errorKey } from '../lib/api';
import { hhmmTo12, initial } from '../lib/format';
import { useConnected, useLiveState, useOnStateChange } from '../lib/live';
import { load, save } from '../lib/storage';
import type { PublicBarber, VisitView } from '../lib/types';
import { Button, Card, ConnectionPill, TopBar, cx, inputClass } from '../components/ui';
import { Reveal, Roll } from '../components/motion';

export default function Home() {
  const { t } = useLang();
  const state = useLiveState();
  const connected = useConnected();
  const navigate = useNavigate();
  const [mine, setMine] = useState<VisitView | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [findError, setFindError] = useState<string | null>(null);

  const refreshMine = useCallback(() => {
    const id = load('sq.myVisit');
    if (!id) return setMine(null);
    api
      .get<VisitView>(`/api/visits/${id}`)
      .then((v) => setMine(['waiting', 'called', 'in_chair'].includes(v.status) ? v : null))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) save('sq.myVisit', null);
        setMine(null);
      });
  }, []);
  useEffect(refreshMine, [refreshMine]);
  useOnStateChange(refreshMine);

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setFindError(null);
    try {
      const r = await api.get<{ id: string }>(`/api/visits/lookup?phone=${encodeURIComponent(phone)}`);
      save('sq.myVisit', r.id);
      navigate(`/status/${r.id}`);
    } catch (err) {
      setFindError(err instanceof ApiError && err.code === 'not_found' ? t('home.notFound') : t(errorKey(err)));
    }
  };

  const salon = state?.salon;
  const waiting = state?.waitingCount ?? 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-[18px] pb-6 pt-3.5">
      <ConnectionPill connected={connected} />
      <TopBar />

      {salon && (
        <div className="rise mt-5 flex items-center gap-2 px-1 text-[13px] font-medium text-muted [--d:1]">
          <span className={cx('inline-block size-2 rounded-full', salon.onlineOpen ? 'bg-ok' : 'bg-subtle')} />
          {salon.onlineOpen ? t('home.openUntil', { time: hhmmTo12(salon.onlineUntil) }) : t('home.closed')}
        </div>
      )}

      <Reveal show={!!mine}>
        {mine && (
        <Link
          to={`/status/${mine.id}`}
          className="press mt-4 flex items-center justify-between rounded-2xl bg-ink px-5 py-4 text-white shadow-pass hover:bg-navy-800"
        >
          <span className="text-[15px] font-medium">
            {mine.status === 'called'
              ? t('home.yourSpotCalled', { token: mine.token })
              : mine.status === 'in_chair'
                ? t('home.yourSpotChair', { token: mine.token })
                : t('home.yourSpot', { token: mine.token })}
            {mine.position && (
              <span className="text-white/60"> · {t('pos.inLine', { pos: ordinal(t, mine.position) })}</span>
            )}
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
        )}
      </Reveal>

      <section className="rise mt-4 rounded-[28px] bg-pass px-[22px] pb-5 pt-[22px] text-white shadow-pass [--d:2]" aria-live="polite">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium tracking-[0.16em] text-white/60">KESH STUDIO · LIVE QUEUE</div>
          <div className="flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium glass">
            <span className="inline-block size-[7px] rounded-full bg-ok-glow shadow-[0_0_8px_var(--color-ok-glow)]" />
            {t('common.live')}
          </div>
        </div>
        {state === null ? (
          <div className="mt-6 h-[140px] animate-pulse rounded-2xl bg-white/5" />
        ) : waiting === 0 ? (
          <div className="mt-5">
            <div className="text-[96px] font-extralight leading-[0.95] tracking-[-0.05em] tabular">0</div>
            <div className="mt-3 text-[17px] font-medium">{t('home.noOne')}</div>
          </div>
        ) : (
          <div className="mt-5 flex items-end gap-3">
            <div className="text-[96px] font-extralight leading-[0.95] tracking-[-0.05em] tabular">
              <Roll value={waiting} />
            </div>
            <div className="pb-3 text-[17px] font-medium text-white/80">
              {waiting === 1 ? t('home.personLabel') : t('home.peopleLabel')}
            </div>
          </div>
        )}
        <div className="mt-5 h-px bg-white/12" />
        <div className="mt-4 flex items-baseline justify-between">
          <div className="text-[13px] text-white/60">{t('home.waitNow')}</div>
          <div className="text-[20px] font-medium tabular">
            <Roll
              value={
                state?.waitNewAny === null || state === null
                  ? '–'
                  : state.waitNewAny === 0
                    ? t('common.anyMoment')
                    : t('common.aboutMin', { n: state.waitNewAny })
              }
            />
          </div>
        </div>
      </section>

      <Card className="rise mt-3.5 px-5 py-4 [--d:3]">
        <h2 className="text-[14px] font-semibold">{t('home.barbers')}</h2>
        <ul className="mt-2 divide-y divide-line">
          {state?.barbers.length === 0 && <li className="py-3 text-[14px] text-muted">{t('home.noBarbers')}</li>}
          {state?.barbers.map((b) => <BarberRow key={b.id} b={b} />)}
        </ul>
      </Card>

      <div className="flex-1" />

      <div className="rise mt-6 [--d:4]">
        {salon && !salon.onlineOpen && (
          <p className="mb-3 text-center text-[14px] text-muted">
            {salon.closedReason === 'time'
              ? t('home.closedTime', { time: hhmmTo12(salon.onlineUntil), close: hhmmTo12(salon.closingTime) })
              : t('home.closedMsg')}
          </p>
        )}
        <Button
          className="h-14 w-full rounded-[18px] text-[17px]"
          disabled={!salon?.onlineOpen || state?.barbers.length === 0}
          onClick={() => navigate('/join')}
        >
          {t('home.join')}
        </Button>

        {!findOpen ? (
          <button
            type="button"
            onClick={() => setFindOpen(true)}
            className="mx-auto mt-3 flex min-h-[44px] items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink"
          >
            <Search size={16} aria-hidden="true" />
            {t('home.findSpot')}
          </button>
        ) : (
          <form onSubmit={find} className="rise mt-4">
            <label htmlFor="find-phone" className="text-[13px] font-medium text-muted">
              {t('home.findLabel')}
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="find-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder={t('join.phonePh')}
              />
              <Button type="submit" className="h-12 shrink-0">
                {t('home.find')}
              </Button>
            </div>
            {findError && (
              <p role="alert" className="mt-2 text-[13px] text-danger">
                {findError}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

function BarberRow({ b }: { b: PublicBarber }) {
  const { t } = useLang();
  const busy = b.state === 'in_chair' || b.state === 'called';
  const label = b.state === 'free' ? t('state.free') : b.state === 'break' ? t('state.break') : t('state.in_chair');
  return (
    <li className="flex items-center gap-3 py-3">
      <div
        className={cx(
          'flex size-10 items-center justify-center rounded-full border-[1.5px] text-[16px]',
          b.state === 'break' ? 'border-line-2 text-subtle' : 'border-ink text-ink',
        )}
        aria-hidden="true"
      >
        {initial(b.name)}
      </div>
      <div className="flex-1">
        <div className={cx('text-[15px] font-medium', b.state === 'break' && 'text-muted')}>{b.name}</div>
        <div className="flex items-center gap-1.5 text-[13px] text-muted">
          <span className={cx('inline-block size-[7px] rounded-full transition-colors duration-300', b.state === 'free' ? 'bg-ok' : busy ? 'bg-accent' : 'bg-subtle')} />
          <Roll value={label} />
        </div>
      </div>
      <div className="text-[15px] tabular text-muted">
        <Roll value={b.waitNew === null ? '' : b.waitNew === 0 ? t('rec.estNow') : t('rec.est', { n: b.waitNew })} />
      </div>
    </li>
  );
}
