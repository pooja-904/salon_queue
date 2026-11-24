import { randomBytes } from 'node:crypto';
import type { DB } from './db.js';
import { toBarber, toService, toVisit } from './db.js';
import * as R from './rules.js';
import type { Barber, Service, Status, Visit } from './rules.js';

export class AppError extends Error {
  constructor(public code: string, public status = 400, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

export interface StoreOptions {
  now?: () => number;
  noShowMinutes?: number;
  timeZone?: string;
}

const SALON_NAME = 'Kesh Studio';

export class Store {
  private now: () => number;
  readonly noShowMinutes: number;
  private tz: string;

  constructor(private db: DB, opts: StoreOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.noShowMinutes = opts.noShowMinutes ?? 10;
    this.tz = opts.timeZone ?? 'Asia/Kolkata';
  }

  // ---------- reads ----------

  today() {
    return R.localParts(this.now(), this.tz).day;
  }

  services(): Service[] {
    return (this.db.prepare('SELECT * FROM services ORDER BY sort, id').all() as Record<string, unknown>[]).map(toService);
  }

  barbers(): Barber[] {
    return (this.db.prepare('SELECT * FROM barbers ORDER BY sort, name').all() as Record<string, unknown>[]).map(toBarber);
  }

  visitsToday(): Visit[] {
    return (this.db.prepare('SELECT * FROM visits WHERE day = ? ORDER BY joined_at').all(this.today()) as Record<string, unknown>[]).map(toVisit);
  }

  visit(id: string): Visit | undefined {
    const r = this.db.prepare('SELECT * FROM visits WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return r ? toVisit(r) : undefined;
  }

  settings() {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { queueOpen: map.queue_open === '1', closingTime: map.closing_time ?? '21:00' };
  }

  onlineOpen() {
    const s = this.settings();
    return R.onlineJoiningOpen(s.queueOpen, s.closingTime, R.localParts(this.now(), this.tz).minutes);
  }

  // ---------- snapshots ----------

  /** Safe for everyone (customers, TV): no phone numbers, no full names, no visit ids. */
  publicState() {
    const now = this.now();
    const visits = this.visitsToday();
    const barbers = this.barbers();
    const services = this.services();
    const s = this.settings();
    const est = R.estimateWaits(barbers, visits, now);
    const queue = R.waitingQueue(visits);
    const svcName = (ids: number[]) => ids.map((id) => services.find((x) => x.id === id)).filter(Boolean) as Service[];

    return {
      now,
      salon: {
        name: SALON_NAME,
        queueOpen: s.queueOpen,
        closingTime: s.closingTime,
        onlineUntil: R.onlineUntil(s.closingTime),
        onlineOpen: this.onlineOpen(),
        // Why online joining is closed: switched off by the owner, or past the cutoff time.
        closedReason: this.onlineOpen() ? null : s.queueOpen ? ('time' as const) : ('owner' as const),
      },
      noShowMinutes: this.noShowMinutes,
      services: services.filter((x) => x.active).map(({ id, nameEn, nameGu, minutes, price }) => ({ id, nameEn, nameGu, minutes, price })),
      barbers: barbers
        .filter((b) => b.onDuty)
        .map((b) => {
          const cur = R.currentOf(visits, b.id);
          return {
            id: b.id,
            name: b.name,
            onBreak: b.onBreak,
            state: R.barberState(b, visits),
            waitNew: R.displayWait(est.newByBarber.get(b.id), queue.length),
            current: cur
              ? {
                  token: R.tokenLabel(cur.tokenNo),
                  displayName: R.displayName(cur.name),
                  status: cur.status,
                  calledAt: cur.calledAt,
                  startedAt: cur.startedAt,
                  minutes: cur.minutes,
                  services: svcName(cur.serviceIds).map((x) => ({ nameEn: x.nameEn, nameGu: x.nameGu })),
                }
              : null,
          };
        }),
      queue: queue.map((v, i) => ({
        token: R.tokenLabel(v.tokenNo),
        displayName: R.displayName(v.name),
        barberPref: v.barberPref,
        position: i + 1,
        wait: R.displayWait(est.byVisit.get(v.id), i),
      })),
      waitingCount: queue.length,
      waitNewAny: R.displayWait(est.newAny, queue.length),
    };
  }

  /** Staff only (behind the PIN): includes names, phones and today's history. */
  staffState() {
    const now = this.now();
    const visits = this.visitsToday();
    const barbers = this.barbers();
    const est = R.estimateWaits(barbers, visits, now);
    const queue = R.waitingQueue(visits);
    const position = new Map(queue.map((v, i) => [v.id, i + 1]));
    return {
      ...this.publicState(),
      allServices: this.services(),
      allBarbers: barbers.map((b) => ({ ...b, state: R.barberState(b, visits), next: R.pickNext(visits, b.id)?.id ?? null })),
      visits: visits.map((v) => ({
        ...v,
        token: R.tokenLabel(v.tokenNo),
        position: position.get(v.id) ?? null,
        wait: position.has(v.id) ? R.displayWait(est.byVisit.get(v.id), position.get(v.id)! - 1) : null,
        canNoShow: R.canMarkNoShow(v, now, this.noShowMinutes),
      })),
      stats: R.todayStats(visits),
    };
  }

  /** What a customer sees on their own status page. */
  visitView(id: string) {
    const v = this.visit(id);
    if (!v || v.day !== this.today()) throw new AppError('not_found', 404);
    const now = this.now();
    const visits = this.visitsToday();
    const barbers = this.barbers();
    const services = this.services();
    const queue = R.waitingQueue(visits);
    const idx = queue.findIndex((x) => x.id === v.id);
    const est = R.estimateWaits(barbers, visits, now);
    const wait = idx >= 0 ? R.displayWait(est.byVisit.get(v.id), idx) : null;
    const pref = v.barberPref ? barbers.find((b) => b.id === v.barberPref) : undefined;
    const assigned = v.assignedBarber ? barbers.find((b) => b.id === v.assignedBarber) : undefined;
    return {
      id: v.id,
      token: R.tokenLabel(v.tokenNo),
      name: v.name,
      firstName: v.name.split(' ')[0],
      status: v.status,
      barberPref: pref ? { id: pref.id, name: pref.name, onBreak: pref.onBreak } : null,
      assignedBarber: assigned ? { id: assigned.id, name: assigned.name } : null,
      services: v.serviceIds
        .map((sid) => services.find((x) => x.id === sid))
        .filter(Boolean)
        .map((x) => ({ nameEn: x!.nameEn, nameGu: x!.nameGu, minutes: x!.minutes, price: x!.price })),
      minutes: v.minutes,
      price: v.price,
      joinedAt: v.joinedAt,
      calledAt: v.calledAt,
      startedAt: v.startedAt,
      position: idx >= 0 ? idx + 1 : null,
      wait,
      getReady: idx >= 0 && R.isGetReady(wait, idx + 1),
      noShowMinutes: this.noShowMinutes,
      now,
    };
  }

  // ---------- actions ----------

  join(input: R.JoinInput, source: 'online' | 'walkin') {
    if (source === 'online' && !this.onlineOpen()) throw new AppError('queue_closed', 409);
    const result = R.validateJoin(input, this.services(), this.barbers(), { allowOnBreak: source === 'walkin' });
    if (!result.ok) throw new AppError(result.error, 422);
    const visits = this.visitsToday();
    const dup = R.findActiveByPhone(visits, result.value.phone);
    if (dup) throw new AppError('duplicate', 409, { visitId: dup.id, token: R.tokenLabel(dup.tokenNo) });
    return this.insertVisit(result.value, source, visits);
  }

  private insertVisit(
    v: { name: string; phone: string; serviceIds: number[]; barberId: string | null; minutes: number; price: number },
    source: 'online' | 'walkin',
    visits: Visit[],
  ) {
    const id = randomBytes(9).toString('base64url');
    const day = this.today();
    const tokenNo = R.nextTokenNo(visits, day);
    this.db
      .prepare(
        `INSERT INTO visits (id, day, token_no, name, phone, barber_pref, status, source, joined_at, service_ids, minutes, price)
         VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?, ?)`,
      )
      .run(id, day, tokenNo, v.name, v.phone, v.barberId, source, this.now(), JSON.stringify(v.serviceIds), v.minutes, v.price);
    return { id, token: R.tokenLabel(tokenNo) };
  }

  findByPhone(raw: string) {
    const phone = R.normalizePhone(raw);
    if (!R.isValidPhone(phone)) throw new AppError('invalid_phone', 422);
    const v = R.findActiveByPhone(this.visitsToday(), phone);
    if (!v) throw new AppError('not_found', 404);
    return { id: v.id, token: R.tokenLabel(v.tokenNo) };
  }

  private setStatus(v: Visit, to: Status, fields: Record<string, unknown> = {}) {
    if (!R.canTransition(v.status, to)) throw new AppError('bad_transition', 409, { from: v.status, to });
    const cols = Object.keys(fields);
    const sql = `UPDATE visits SET status = ?${cols.map((c) => `, ${c} = ?`).join('')} WHERE id = ? AND status = ?`;
    const res = this.db.prepare(sql).run(to, ...(Object.values(fields) as (string | number | null)[]), v.id, v.status);
    if (Number(res.changes) !== 1) throw new AppError('bad_transition', 409);
  }

  private mustVisit(id: string) {
    const v = this.visit(id);
    if (!v || v.day !== this.today()) throw new AppError('not_found', 404);
    return v;
  }

  cancel(id: string) {
    const v = this.mustVisit(id);
    this.setStatus(v, 'cancelled', { ended_at: this.now() });
  }

  callNext(barberId: string) {
    const visits = this.visitsToday();
    const b = this.barbers().find((x) => x.id === barberId);
    const check = R.checkCallNext(b, visits);
    if (!check.ok) throw new AppError(check.error, 409);
    this.setStatus(check.visit, 'called', { called_at: this.now(), assigned_barber: barberId });
    return { token: R.tokenLabel(check.visit.tokenNo) };
  }

  start(id: string) {
    const v = this.mustVisit(id);
    this.setStatus(v, 'in_chair', { started_at: this.now() });
  }

  done(id: string) {
    const v = this.mustVisit(id);
    this.setStatus(v, 'done', { ended_at: this.now() });
  }

  noShow(id: string) {
    const v = this.mustVisit(id);
    if (v.status === 'called' && !R.canMarkNoShow(v, this.now(), this.noShowMinutes)) {
      throw new AppError('too_early_no_show', 409);
    }
    this.setStatus(v, 'no_show', { ended_at: this.now() });
  }

  /** A no-show who turns up later goes to the END with a new token. */
  readd(id: string) {
    const v = this.mustVisit(id);
    if (v.status !== 'no_show') throw new AppError('bad_transition', 409);
    const visits = this.visitsToday();
    if (R.findActiveByPhone(visits, v.phone)) throw new AppError('duplicate', 409);
    const barbers = this.barbers();
    const pref = v.barberPref && barbers.find((b) => b.id === v.barberPref && b.onDuty) ? v.barberPref : null;
    return this.insertVisit(
      { name: v.name, phone: v.phone, serviceIds: v.serviceIds, barberId: pref, minutes: v.minutes, price: v.price },
      v.source,
      visits,
    );
  }

  setBreak(barberId: string, onBreak: boolean) {
    const b = this.barbers().find((x) => x.id === barberId);
    if (!b || !b.onDuty) throw new AppError('barber_unavailable', 404);
    if (onBreak && !R.canGoOnBreak(b, this.visitsToday())) throw new AppError('barber_busy', 409);
    this.db.prepare('UPDATE barbers SET on_break = ? WHERE id = ?').run(onBreak ? 1 : 0, barberId);
  }

  updateBarber(barberId: string, patch: { onDuty?: boolean; name?: string }) {
    const b = this.barbers().find((x) => x.id === barberId);
    if (!b) throw new AppError('not_found', 404);
    if (patch.onDuty === false && b.onDuty && !R.canSetOffDuty(b, this.visitsToday())) {
      throw new AppError('has_waiting', 409);
    }
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!R.isValidName(name)) throw new AppError('invalid_name', 422);
      this.db.prepare('UPDATE barbers SET name = ? WHERE id = ?').run(name, barberId);
    }
    if (patch.onDuty !== undefined) {
      this.db.prepare('UPDATE barbers SET on_duty = ?, on_break = 0 WHERE id = ?').run(patch.onDuty ? 1 : 0, barberId);
    }
  }

  addBarber(nameRaw: string) {
    const name = String(nameRaw ?? '').trim();
    if (!R.isValidName(name)) throw new AppError('invalid_name', 422);
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'barber';
    let id = base;
    for (let i = 2; this.barbers().some((b) => b.id === id); i++) id = `${base}-${i}`;
    const sort = this.barbers().length;
    this.db.prepare('INSERT INTO barbers (id, name, on_duty, sort) VALUES (?, ?, 1, ?)').run(id, name, sort);
    return { id };
  }

  saveService(input: { id?: number; nameEn: string; nameGu: string; minutes: number; price: number; active?: boolean }) {
    const nameEn = String(input.nameEn ?? '').trim();
    const nameGu = String(input.nameGu ?? '').trim();
    const minutes = Math.round(Number(input.minutes));
    const price = Math.round(Number(input.price));
    if (nameEn.length < 2 || nameEn.length > 40 || nameGu.length < 1 || nameGu.length > 40) throw new AppError('invalid_service', 422);
    if (!(minutes >= 5 && minutes <= 240) || !(price >= 0 && price <= 100000)) throw new AppError('invalid_service', 422);
    const active = input.active === undefined ? 1 : input.active ? 1 : 0;
    if (input.id) {
      const res = this.db
        .prepare('UPDATE services SET name_en = ?, name_gu = ?, minutes = ?, price = ?, active = ? WHERE id = ?')
        .run(nameEn, nameGu, minutes, price, active, input.id);
      if (Number(res.changes) !== 1) throw new AppError('not_found', 404);
      return { id: input.id };
    }
    const sort = this.services().length;
    const res = this.db
      .prepare('INSERT INTO services (name_en, name_gu, minutes, price, active, sort) VALUES (?, ?, ?, ?, ?, ?)')
      .run(nameEn, nameGu, minutes, price, active, sort);
    return { id: Number(res.lastInsertRowid) };
  }

  updateSettings(patch: { queueOpen?: boolean; closingTime?: string }) {
    if (patch.queueOpen !== undefined) {
      this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('queue_open', ?)").run(patch.queueOpen ? '1' : '0');
    }
    if (patch.closingTime !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.closingTime)) throw new AppError('invalid_time', 422);
      this.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('closing_time', ?)").run(patch.closingTime);
    }
  }
}
