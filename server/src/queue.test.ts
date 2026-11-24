import { describe, expect, it } from 'vitest';
import { openDb } from './db.js';
import { AppError, Store } from './store.js';
import * as R from './rules.js';

// 2026-11-24 12:00 IST (salon open, online joining open until 20:30)
const NOON_IST = Date.UTC(2026, 10, 24, 6, 30);
const MIN = 60_000;

function setup(start = NOON_IST) {
  let t = start;
  const store = new Store(openDb(':memory:'), { now: () => t, noShowMinutes: 10 });
  const tick = (minutes: number) => (t += minutes * MIN);
  const join = (name: string, phone: string, serviceIds: number[], barberId: string | null = null, source: 'online' | 'walkin' = 'online') => {
    const r = store.join({ name, phone, serviceIds, barberId }, source);
    tick(1); // keep join order stable
    return r;
  };
  return { store, tick, join };
}

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as AppError).code;
  }
  return 'no error';
};

describe('joining', () => {
  it('2 services -> correct total time and price', () => {
    const { store, join } = setup();
    const { id } = join('Kunal Shah', '9876543210', [1, 2]); // Haircut 30/150 + Beard trim 15/80
    const v = store.visitView(id);
    expect(v.minutes).toBe(45);
    expect(v.price).toBe(230);
    expect(v.token).toBe('S-1');
  });

  it('a 4th service is rejected', () => {
    const { store } = setup();
    expect(code(() => store.join({ name: 'Kunal', phone: '9876543210', serviceIds: [1, 2, 3, 4], barberId: null }, 'online'))).toBe('too_many_services');
  });

  it('phone must be 10 digits starting with 6-9', () => {
    const { store } = setup();
    expect(code(() => store.join({ name: 'Kunal', phone: '987654321', serviceIds: [1], barberId: null }, 'online'))).toBe('invalid_phone');
    expect(code(() => store.join({ name: 'Kunal', phone: '5876543210', serviceIds: [1], barberId: null }, 'online'))).toBe('invalid_phone');
    expect(code(() => store.join({ name: 'K', phone: '9876543210', serviceIds: [1], barberId: null }, 'online'))).toBe('invalid_name');
  });

  it('same phone joins twice -> existing spot, no duplicate', () => {
    const { store, join } = setup();
    const first = join('Kunal Shah', '9876543210', [1]);
    let err: AppError | undefined;
    try {
      store.join({ name: 'Kunal Shah', phone: '98765 43210', serviceIds: [2], barberId: null }, 'online');
    } catch (e) {
      err = e as AppError;
    }
    expect(err?.code).toBe('duplicate');
    expect(err?.extra.visitId).toBe(first.id);
    expect(store.visitsToday()).toHaveLength(1);
  });

  it('closed online queue blocks online joins but not walk-ins', () => {
    const { store, join } = setup();
    store.updateSettings({ queueOpen: false });
    expect(code(() => store.join({ name: 'Kunal', phone: '9876543210', serviceIds: [1], barberId: null }, 'online'))).toBe('queue_closed');
    expect(join('Kunal', '9876543210', [1], null, 'walkin').token).toBe('S-1');
  });

  it('online joining stops 30 min before closing time', () => {
    const at2031 = Date.UTC(2026, 10, 24, 15, 1); // 20:31 IST, closing 21:00
    const { store } = setup(at2031);
    expect(store.onlineOpen()).toBe(false);
    const at2029 = Date.UTC(2026, 10, 24, 14, 59);
    expect(setup(at2029).store.onlineOpen()).toBe(true);
  });

  it('a service switched off cannot be chosen', () => {
    const { store } = setup();
    store.saveService({ id: 4, nameEn: 'Hair spa', nameGu: 'હેર સ્પા', minutes: 45, price: 400, active: false });
    expect(store.publicState().services.some((s) => s.id === 4)).toBe(false);
    expect(code(() => store.join({ name: 'Kunal', phone: '9876543210', serviceIds: [4], barberId: null }, 'online'))).toBe('invalid_services');
  });

  it('tokens start again from S-1 every day', () => {
    const { store, join, tick } = setup();
    join('Kunal', '9876543210', [1]);
    join('Neha', '9876543211', [1]);
    tick(24 * 60);
    expect(join('Arjun', '9876543212', [1]).token).toBe('S-1');
    expect(store.visitsToday()).toHaveLength(1);
  });
});

describe('calling the next customer', () => {
  it('Call next for Amit skips a customer who chose Ravi', () => {
    const { store, join } = setup();
    join('Ravi Fan', '9000000001', [1], 'ravi');
    const any = join('Any One', '9000000002', [1]);
    expect(store.callNext('amit').token).toBe(any.token);
  });

  it('an "Any barber" customer can be called by any barber', () => {
    const { store, join } = setup();
    join('Any One', '9000000002', [1]);
    expect(store.callNext('imran').token).toBe('S-1');
  });

  it('a barber has only one customer at a time', () => {
    const { store, join } = setup();
    join('A One', '9000000001', [1]);
    join('B Two', '9000000002', [1]);
    store.callNext('ravi');
    expect(code(() => store.callNext('ravi'))).toBe('barber_busy');
  });

  it('a barber on break cannot be called and keeps his customers', () => {
    const { store, join } = setup();
    const v = join('Ravi Fan', '9000000001', [1], 'ravi');
    store.setBreak('ravi', true);
    expect(code(() => store.callNext('ravi'))).toBe('barber_on_break');
    expect(code(() => store.callNext('amit'))).toBe('nobody_waiting');
    expect(store.visitView(v.id).barberPref?.onBreak).toBe(true);
    expect(store.visitView(v.id).position).toBe(1);
  });

  it('cannot go on break with a customer called', () => {
    const { store, join } = setup();
    join('A One', '9000000001', [1]);
    store.callNext('ravi');
    expect(code(() => store.setBreak('ravi', true))).toBe('barber_busy');
  });

  it('cannot set a barber off duty while people wait for him', () => {
    const { store, join } = setup();
    join('Ravi Fan', '9000000001', [1], 'ravi');
    expect(code(() => store.updateBarber('ravi', { onDuty: false }))).toBe('has_waiting');
  });
});

describe('statuses', () => {
  it('only moves forward', () => {
    expect(R.canTransition('waiting', 'called')).toBe(true);
    expect(R.canTransition('called', 'in_chair')).toBe(true);
    expect(R.canTransition('in_chair', 'done')).toBe(true);
    expect(R.canTransition('done', 'waiting')).toBe(false);
    expect(R.canTransition('in_chair', 'called')).toBe(false);
    expect(R.canTransition('called', 'cancelled')).toBe(false);
  });

  it('Start then Done; a second Done is rejected', () => {
    const { store, join } = setup();
    const v = join('A One', '9000000001', [1]);
    store.callNext('ravi');
    store.start(v.id);
    store.done(v.id);
    expect(store.visit(v.id)?.status).toBe('done');
    expect(code(() => store.done(v.id))).toBe('bad_transition');
  });

  it('no-show only after 10 min; re-add gives a new token at the end', () => {
    const { store, join, tick } = setup();
    const a = join('A One', '9000000001', [1]);
    join('B Two', '9000000002', [1]);
    store.callNext('ravi');
    tick(5);
    expect(code(() => store.noShow(a.id))).toBe('too_early_no_show');
    tick(5);
    store.noShow(a.id);
    const again = store.readd(a.id);
    expect(again.token).toBe('S-3');
    expect(store.visitView(again.id).position).toBe(2);
  });
});

describe('waiting time', () => {
  it('walks the line with barber preferences (matches the design example)', () => {
    const { store, join, tick } = setup();
    // Ravi busy (20 min left), Amit called (30 min), Imran on break (15)
    const r = join('Ravi Cust', '9000000010', [1]);
    store.callNext('ravi');
    store.start(r.id);
    tick(9); // ravi started ~10 min ago -> ~20 left
    const a = join('Amit Cust', '9000000011', [1]);
    store.callNext('amit');
    store.setBreak('imran', true);

    const neha = join('Neha K', '9000000001', [1]); // any -> imran @15
    const arjun = join('Arjun P', '9000000002', [2], 'ravi'); // ravi @~20
    const farhan = join('Farhan Q', '9000000003', [1]); // any -> amit @~30
    const kunal = join('Kunal S', '9000000004', [1, 2]); // any -> ravi @~35
    void a;
    const w = (id: string) => store.visitView(id).wait;
    expect(w(neha.id)).toBe(15);
    expect(w(arjun.id)).toBe(20);
    expect(w(farhan.id)).toBe(30);
    expect(w(kunal.id)).toBe(35);
  });

  it('never shows 0 min while someone is ahead, and goes down as customers finish', () => {
    const { store, join, tick } = setup();
    const a = join('A One', '9000000001', [2]);
    const b = join('B Two', '9000000002', [2]);
    // 3 barbers free: both could start now, but B has someone ahead
    expect(store.visitView(a.id).wait).toBe(0);
    expect(store.visitView(b.id).wait).toBe(5);

    store.updateBarber('amit', { onDuty: false });
    store.updateBarber('imran', { onDuty: false });
    const c = join('C Three', '9000000003', [1]);
    store.callNext('ravi');
    const before = store.visitView(c.id).wait!;
    store.start(a.id);
    tick(15);
    store.done(a.id);
    store.callNext('ravi');
    store.start(b.id);
    const after = store.visitView(c.id).wait!;
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  it('rounds up to the next 5 minutes', () => {
    expect(R.displayWait(11, 3)).toBe(15);
    expect(R.displayWait(0, 2)).toBe(5);
    expect(R.displayWait(0, 0)).toBe(0);
    expect(R.displayWait(null, 0)).toBe(null);
  });
});

describe('privacy', () => {
  it('public state has no phone numbers or full names', () => {
    const { store, join } = setup();
    join('Kunal Shah', '9876543210', [1]);
    const text = JSON.stringify(store.publicState());
    expect(text).not.toContain('9876543210');
    expect(text).not.toContain('Kunal Shah');
    expect(text).toContain('Kunal S.');
  });
});
