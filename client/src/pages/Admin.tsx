import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Pencil, Plus, Printer } from 'lucide-react';
import { useLang } from '../i18n/i18n';
import { errorKey, staffApi } from '../lib/api';
import { hhmmTo12, rupees } from '../lib/format';
import { useConnected, useStaffState } from '../lib/live';
import type { StaffState } from '../lib/types';
import { PinGate } from '../components/PinGate';
import { StaffHeader } from '../components/StaffHeader';
import { motion } from 'motion/react';
import { Button, Card, ConnectionPill, Toast, cx, inputClass } from '../components/ui';
import { EASE_OUT, Reveal, Roll, SPRING } from '../components/motion';

export default function Admin() {
  return <PinGate>{(pin, lock) => <AdminScreen pin={pin} lock={lock} />}</PinGate>;
}

type Act = (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;

function AdminScreen({ pin, lock }: { pin: string; lock: () => void }) {
  const { t } = useLang();
  const { state, socket } = useStaffState(pin);
  const connected = useConnected(socket);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const act: Act = async (fn, ok) => {
    try {
      await fn();
      if (ok) setToast(ok);
      return true;
    } catch (e) {
      setToast(t(errorKey(e)));
      return false;
    }
  };

  if (!state) {
    return (
      <main className="min-h-dvh bg-canvas p-6">
        <div className="skeleton h-12 w-64 rounded-2xl" />
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-[104px] rounded-3xl" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[1100px] px-5 pb-10 pt-4">
      <ConnectionPill connected={connected} />
      <StaffHeader title={t('admin.title')} onLock={lock} />

      <h2 className="rise mt-6 px-1 text-[14px] font-semibold text-muted [--d:1]">{t('admin.today')}</h2>
      <div className="rise mt-2.5 grid grid-cols-2 gap-3 md:grid-cols-4 [--d:1]">
        <Stat label={t('admin.served')} value={state.stats.served} />
        <Stat label={t('admin.avgWait')} value={t('common.nMin', { n: state.stats.avgWait })} />
        <Stat label={t('admin.noShows')} value={state.stats.noShows} />
        <Stat label={t('admin.cancelled')} value={state.stats.cancelled} />
      </div>

      <div className="rise mt-4 grid gap-4 lg:grid-cols-2 [--d:2]">
        <QueueSettings state={state} act={act} />
        <DoorQr />
      </div>
      <div className="rise mt-4 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] [--d:3]">
        <Services state={state} act={act} />
        <Barbers state={state} act={act} />
      </div>
      <Toast message={toast} onDone={clearToast} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 text-[36px] font-light tracking-[-0.03em] tabular">
        <Roll value={value} />
      </div>
    </Card>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx('press relative flex h-8 w-[52px] shrink-0 items-center rounded-full p-1 transition-colors duration-200', on ? 'justify-end bg-ink' : 'justify-start bg-line-2')}
    >
      <motion.span layout transition={SPRING} className="size-6 rounded-full bg-white shadow" />
    </button>
  );
}

/** 12:00 PM to 11:30 PM every 30 min, plus 11:59 PM (and the saved value if it isn't one of these). */
function closingOptions(current: string) {
  const list: string[] = [];
  for (let m = 12 * 60; m <= 23 * 60 + 30; m += 30) {
    list.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  list.push('23:59');
  if (current && !list.includes(current)) list.unshift(current);
  return list;
}

function QueueSettings({ state, act }: { state: StaffState; act: Act }) {
  const { t } = useLang();
  const [closing, setClosing] = useState(state.salon.closingTime);
  useEffect(() => setClosing(state.salon.closingTime), [state.salon.closingTime]);
  return (
    <Card className="p-6">
      <h2 className="text-[17px] font-semibold">{t('admin.queue')}</h2>
      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-canvas px-4 py-3">
        <span className="flex items-center gap-2 text-[15px] font-medium">
          <span className={cx('inline-block size-2 rounded-full transition-colors', state.salon.onlineOpen ? 'bg-ok' : 'bg-subtle')} aria-hidden="true" />
          <Roll value={state.salon.queueOpen ? t('admin.queueOpen') : t('admin.queueClosed')} />
        </span>
        <Switch
          on={state.salon.queueOpen}
          label={t('admin.queue')}
          onChange={(v) => act(() => staffApi.patch('/settings', { queueOpen: v }), t('admin.saved'))}
        />
      </div>
      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act(() => staffApi.patch('/settings', { closingTime: closing }), t('admin.saved'));
        }}
      >
        <label className="flex-1">
          <span className="text-[13px] font-medium text-muted">{t('admin.closing')}</span>
          {/* A list of evening times instead of a time picker, so AM/PM can't be mixed up. */}
          <select value={closing} onChange={(e) => setClosing(e.target.value)} className={`${inputClass} mt-1.5 tabular`} required>
            {closingOptions(closing).map((v) => (
              <option key={v} value={v}>
                {hhmmTo12(v)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="h-12">
          {t('common.save')}
        </Button>
      </form>
      <p className="mt-3 text-[13px] text-muted">{t('admin.cutoff', { time: hhmmTo12(state.salon.onlineUntil) })}</p>
      <Reveal show={state.salon.closedReason === 'time'}>
        <p role="status" className="mt-3 rounded-2xl bg-warn-bg px-4 py-3 text-[13px] font-medium text-warn">
          {t('admin.pastCutoff', { time: hhmmTo12(state.salon.onlineUntil) })}
        </p>
      </Reveal>
    </Card>
  );
}

function DoorQr() {
  const { t } = useLang();
  const url = `${window.location.origin}/`;
  return (
    <Card className="flex items-center gap-5 p-6">
      <div className="print-area flex shrink-0 flex-col items-center rounded-2xl bg-white p-3 ring-hair">
        <QRCodeSVG value={url} size={132} fgColor="#0B1630" level="M" aria-label="QR code for the queue" />
        <div className="mt-2 text-[12px] font-medium">Kesh Studio · Scan to join</div>
      </div>
      <div>
        <h2 className="text-[17px] font-semibold">{t('admin.qr')}</h2>
        <p className="mt-1 text-[14px] text-muted">{t('admin.qrSub')}</p>
        <p className="mt-1 break-all text-[12px] text-subtle">{url}</p>
        <Button variant="secondary" className="mt-3" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          {t('admin.print')}
        </Button>
      </div>
    </Card>
  );
}

interface Draft {
  id?: number;
  nameEn: string;
  nameGu: string;
  minutes: string;
  price: string;
  active: boolean;
}

function Services({ state, act }: { state: StaffState; act: Act }) {
  const { t } = useLang();
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const body = { ...draft, minutes: Number(draft.minutes), price: Number(draft.price) };
    const ok = await act(() => (draft.id ? staffApi.patch(`/services/${draft.id}`, body) : staffApi.post('/services', body)), t('admin.saved'));
    if (ok) setDraft(null);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">{t('admin.services')}</h2>
        <Button variant="secondary" onClick={() => setDraft({ nameEn: '', nameGu: '', minutes: '30', price: '100', active: true })}>
          <Plus size={16} aria-hidden="true" />
          {t('admin.addService')}
        </Button>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {state.allServices.map((s) =>
          draft?.id === s.id ? (
            <motion.li key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } }} className="py-3">
              <ServiceForm draft={draft} setDraft={setDraft} onSubmit={save} />
            </motion.li>
          ) : (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <div className={cx('min-w-0 flex-1 transition-opacity duration-300', !s.active && 'opacity-50')}>
                <div className="truncate text-[15px] font-medium">
                  {s.nameEn}{' '}
                  <span lang="gu" className="font-gu text-muted">
                    · {s.nameGu}
                  </span>
                </div>
                <div className="text-[13px] text-muted tabular">
                  {t('common.nMin', { n: s.minutes })} · {rupees(s.price)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDraft({ id: s.id, nameEn: s.nameEn, nameGu: s.nameGu, minutes: String(s.minutes), price: String(s.price), active: s.active })}
                className="press flex size-11 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
                aria-label={`${t('admin.edit')} ${s.nameEn}`}
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
              <Switch
                on={s.active}
                label={`${s.nameEn} ${s.active ? t('admin.on') : t('admin.off')}`}
                onChange={(v) => act(() => staffApi.patch(`/services/${s.id}`, { ...s, active: v }), t('admin.saved'))}
              />
            </li>
          ),
        )}
      </ul>
      {draft && !draft.id && (
        <div className="rise mt-3 border-t border-line pt-4">
          <ServiceForm draft={draft} setDraft={setDraft} onSubmit={save} />
        </div>
      )}
    </Card>
  );
}

function ServiceForm({ draft, setDraft, onSubmit }: { draft: Draft; setDraft: (d: Draft | null) => void; onSubmit: (e: React.FormEvent) => void }) {
  const { t } = useLang();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [k]: e.target.value });
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-2.5">
      <label className="col-span-2 sm:col-span-1">
        <span className="text-[12px] font-medium text-muted">{t('admin.nameEn')}</span>
        <input className={`${inputClass} mt-1`} value={draft.nameEn} onChange={set('nameEn')} required maxLength={40} />
      </label>
      <label className="col-span-2 sm:col-span-1">
        <span className="text-[12px] font-medium text-muted">{t('admin.nameGu')}</span>
        <input lang="gu" className={`${inputClass} mt-1 font-gu`} value={draft.nameGu} onChange={set('nameGu')} required maxLength={40} />
      </label>
      <label>
        <span className="text-[12px] font-medium text-muted">{t('admin.minutes')}</span>
        <input className={`${inputClass} mt-1`} type="number" min={5} max={240} value={draft.minutes} onChange={set('minutes')} required />
      </label>
      <label>
        <span className="text-[12px] font-medium text-muted">{t('admin.price')}</span>
        <input className={`${inputClass} mt-1`} type="number" min={0} value={draft.price} onChange={set('price')} required />
      </label>
      <div className="col-span-2 mt-1 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setDraft(null)}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">{t('common.save')}</Button>
      </div>
    </form>
  );
}

function Barbers({ state, act }: { state: StaffState; act: Act }) {
  const { t } = useLang();
  const [name, setName] = useState('');
  return (
    <Card className="p-6">
      <h2 className="text-[17px] font-semibold">{t('admin.barbers')}</h2>
      <ul className="mt-3 divide-y divide-line">
        {state.allBarbers.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-3">
            <div className="flex-1">
              <div className={cx('text-[15px] font-medium', !b.onDuty && 'text-muted')}>{b.name}</div>
              <div className="text-[13px] text-muted">{b.onDuty ? t('admin.onDuty') : t('admin.offDuty')}</div>
            </div>
            <Switch
              on={b.onDuty}
              label={`${b.name} ${t('admin.onDuty')}`}
              onChange={(v) => act(() => staffApi.patch(`/barbers/${b.id}`, { onDuty: v }), t('admin.saved'))}
            />
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2 border-t border-line pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act(() => staffApi.post('/barbers', { name }), t('admin.saved'))) setName('');
        }}
      >
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('admin.barberName')} maxLength={40} aria-label={t('admin.barberName')} />
        <Button type="submit" className="h-12 shrink-0" disabled={name.trim().length < 2}>
          <Plus size={16} aria-hidden="true" />
          {t('admin.addBarber')}
        </Button>
      </form>
    </Card>
  );
}
