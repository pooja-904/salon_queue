// All queue rules live here (docs/03-flows-rules.md). Pure functions only:
// no database, no sockets, so they are easy to test and reuse.

export type Status = 'waiting' | 'called' | 'in_chair' | 'done' | 'cancelled' | 'no_show';

export interface Visit {
  id: string;
  day: string;
  tokenNo: number;
  name: string;
  phone: string;
  barberPref: string | null; // null = "Any barber"
  assignedBarber: string | null; // set when called
  status: Status;
  source: 'online' | 'walkin';
  joinedAt: number;
  calledAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
  serviceIds: number[];
  minutes: number;
  price: number;
}

export interface Barber {
  id: string;
  name: string;
  onDuty: boolean;
  onBreak: boolean;
  sort: number;
}

export interface Service {
  id: number;
  nameEn: string;
  nameGu: string;
  minutes: number;
  price: number;
  active: boolean;
  sort: number;
}

export const MAX_SERVICES = 3;
export const BREAK_ASSUME_MIN = 15;
export const ONLINE_CUTOFF_MIN = 30;
export const IN_CHAIR_MIN_LEFT = 2;
export const GET_READY_MIN = 15;
const MIN = 60_000;

// ---------- statuses ----------

const TRANSITIONS: Record<Status, Status[]> = {
  waiting: ['called', 'cancelled'],
  called: ['in_chair', 'no_show'],
  in_chair: ['done'],
  done: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}

export const ACTIVE: Status[] = ['waiting', 'called', 'in_chair'];
export const isActive = (v: Visit) => ACTIVE.includes(v.status);

// ---------- time helpers ----------

export function localParts(now: number, timeZone = 'Asia/Kolkata') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Online joining closes 30 min before closing time, or when the owner switches it off. */
export function onlineJoiningOpen(queueOpen: boolean, closingTime: string, nowLocalMinutes: number): boolean {
  return queueOpen && nowLocalMinutes < hhmmToMinutes(closingTime) - ONLINE_CUTOFF_MIN;
}

export function onlineUntil(closingTime: string): string {
  return minutesToHhmm(hhmmToMinutes(closingTime) - ONLINE_CUTOFF_MIN);
}

// ---------- joining ----------

export type JoinError =
  | 'invalid_name'
  | 'invalid_phone'
  | 'invalid_services'
  | 'too_many_services'
  | 'invalid_barber'
  | 'barber_on_break';

export function normalizePhone(raw: string): string {
  let d = String(raw ?? '').replace(/[^\d]/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  return d;
}

export const isValidPhone = (p: string) => /^[6-9]\d{9}$/.test(p);
export const isValidName = (n: string) => /^[\p{L}\p{M} .'-]{2,40}$/u.test(n) && /\p{L}/u.test(n);

export interface JoinInput {
  name: string;
  phone: string;
  serviceIds: number[];
  barberId: string | null;
}

export function validateJoin(
  input: JoinInput,
  services: Service[],
  barbers: Barber[],
  opts: { allowOnBreak: boolean },
): { ok: true; value: JoinInput & { minutes: number; price: number } } | { ok: false; error: JoinError } {
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
  if (!isValidName(name)) return { ok: false, error: 'invalid_name' };

  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone)) return { ok: false, error: 'invalid_phone' };

  const ids = Array.isArray(input.serviceIds) ? [...new Set(input.serviceIds.map(Number))] : [];
  if (ids.length === 0) return { ok: false, error: 'invalid_services' };
  if (ids.length > MAX_SERVICES) return { ok: false, error: 'too_many_services' };
  const chosen = ids.map((id) => services.find((s) => s.id === id && s.active));
  if (chosen.some((s) => !s)) return { ok: false, error: 'invalid_services' };

  const barberId = input.barberId || null;
  if (barberId) {
    const b = barbers.find((x) => x.id === barberId);
    if (!b || !b.onDuty) return { ok: false, error: 'invalid_barber' };
    if (b.onBreak && !opts.allowOnBreak) return { ok: false, error: 'barber_on_break' };
  }

  const minutes = chosen.reduce((sum, s) => sum + s!.minutes, 0);
  const price = chosen.reduce((sum, s) => sum + s!.price, 0);
  return { ok: true, value: { name, phone, serviceIds: ids, barberId, minutes, price } };
}

export function findActiveByPhone(visits: Visit[], phone: string): Visit | undefined {
  return visits.find((v) => v.phone === phone && isActive(v));
}

export function nextTokenNo(visits: Visit[], day: string): number {
  return visits.filter((v) => v.day === day).reduce((max, v) => Math.max(max, v.tokenNo), 0) + 1;
}

// ---------- the line ----------

/** First come, first served: waiting customers in join order. */
export function waitingQueue(visits: Visit[]): Visit[] {
  return visits
    .filter((v) => v.status === 'waiting')
    .sort((a, b) => a.joinedAt - b.joinedAt || a.tokenNo - b.tokenNo);
}

/** Call next for barber X = earliest waiting customer who chose X or "Any". */
export function pickNext(visits: Visit[], barberId: string): Visit | undefined {
  return waitingQueue(visits).find((v) => v.barberPref === null || v.barberPref === barberId);
}

export function currentOf(visits: Visit[], barberId: string): Visit | undefined {
  return visits.find(
    (v) => v.assignedBarber === barberId && (v.status === 'called' || v.status === 'in_chair'),
  );
}

export type BarberState = 'off' | 'break' | 'free' | 'called' | 'in_chair';

export function barberState(b: Barber, visits: Visit[]): BarberState {
  if (!b.onDuty) return 'off';
  const cur = currentOf(visits, b.id);
  if (cur) return cur.status === 'called' ? 'called' : 'in_chair';
  return b.onBreak ? 'break' : 'free';
}

export type CallError = 'barber_unavailable' | 'barber_on_break' | 'barber_busy' | 'nobody_waiting';

export function checkCallNext(b: Barber | undefined, visits: Visit[]): { ok: true; visit: Visit } | { ok: false; error: CallError } {
  if (!b || !b.onDuty) return { ok: false, error: 'barber_unavailable' };
  if (b.onBreak) return { ok: false, error: 'barber_on_break' };
  if (currentOf(visits, b.id)) return { ok: false, error: 'barber_busy' };
  const next = pickNext(visits, b.id);
  if (!next) return { ok: false, error: 'nobody_waiting' };
  return { ok: true, visit: next };
}

export const canGoOnBreak = (b: Barber, visits: Visit[]) => !currentOf(visits, b.id);

export function canSetOffDuty(b: Barber, visits: Visit[]): boolean {
  if (currentOf(visits, b.id)) return false;
  return !visits.some((v) => v.status === 'waiting' && v.barberPref === b.id);
}

export function canMarkNoShow(v: Visit, now: number, noShowMinutes: number): boolean {
  return v.status === 'called' && v.calledAt !== null && now - v.calledAt >= noShowMinutes * MIN;
}

// ---------- waiting time ----------

export interface Estimates {
  /** raw minutes until each waiting visit is likely to start */
  byVisit: Map<string, number>;
  /** raw minutes a new "Any barber" customer would wait (null when nobody is on duty) */
  newAny: number | null;
  /** raw minutes a new customer choosing this barber would wait */
  newByBarber: Map<string, number>;
}

/**
 * Walk the line in order. Each on-duty barber has a "free at" time.
 * A customer who chose a barber waits for that barber; "Any" goes to
 * whoever is free first. Then that barber's "free at" moves forward.
 */
export function estimateWaits(barbers: Barber[], visits: Visit[], now: number): Estimates {
  const onDuty = barbers.filter((b) => b.onDuty).sort((a, b) => a.sort - b.sort);
  const freeAt = new Map<string, number>();
  for (const b of onDuty) {
    const cur = currentOf(visits, b.id);
    let t = now;
    if (cur?.status === 'in_chair') {
      t = Math.max((cur.startedAt ?? now) + cur.minutes * MIN, now + IN_CHAIR_MIN_LEFT * MIN);
    } else if (cur?.status === 'called') {
      t = now + cur.minutes * MIN;
    } else if (b.onBreak) {
      t = now + BREAK_ASSUME_MIN * MIN;
    }
    freeAt.set(b.id, t);
  }

  const earliest = (): string | null => {
    let best: string | null = null;
    for (const b of onDuty) {
      if (best === null || freeAt.get(b.id)! < freeAt.get(best)!) best = b.id;
    }
    return best;
  };

  const byVisit = new Map<string, number>();
  for (const v of waitingQueue(visits)) {
    const target = v.barberPref && freeAt.has(v.barberPref) ? v.barberPref : earliest();
    if (!target) continue;
    const start = freeAt.get(target)!;
    byVisit.set(v.id, Math.max(0, (start - now) / MIN));
    freeAt.set(target, start + v.minutes * MIN);
  }

  const any = earliest();
  const newByBarber = new Map<string, number>();
  for (const b of onDuty) newByBarber.set(b.id, Math.max(0, (freeAt.get(b.id)! - now) / MIN));
  return { byVisit, newAny: any ? Math.max(0, (freeAt.get(any)! - now) / MIN) : null, newByBarber };
}

/**
 * What we show: rounded UP to the next 5 min, never 0 while someone is ahead.
 * 0 means "Any moment now" (you're first and a barber is free).
 */
export function displayWait(rawMinutes: number | null | undefined, peopleAhead: number): number | null {
  if (rawMinutes === null || rawMinutes === undefined) return null;
  let m = Math.ceil(rawMinutes / 5) * 5;
  if (peopleAhead > 0 && m < 5) m = 5;
  return m;
}

export const isGetReady = (displayMinutes: number | null, position: number) =>
  position <= 2 || (displayMinutes !== null && displayMinutes <= GET_READY_MIN);

// ---------- privacy ----------

/** TV and public lists show "Kunal S." — never full names or phone numbers. */
export function displayName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export const tokenLabel = (n: number) => `S-${n}`;

// ---------- stats ----------

export function todayStats(visits: Visit[]) {
  const called = visits.filter((v) => v.calledAt !== null);
  const avgWait = called.length
    ? Math.round(called.reduce((s, v) => s + (v.calledAt! - v.joinedAt), 0) / called.length / MIN)
    : 0;
  return {
    served: visits.filter((v) => v.status === 'done').length,
    avgWait,
    noShows: visits.filter((v) => v.status === 'no_show').length,
    cancelled: visits.filter((v) => v.status === 'cancelled').length,
  };
}
