import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import type { Barber, Service, Status, Visit } from './rules.js';

// Node's built-in SQLite (no native build step). Loaded with require so the
// test runner's bundler doesn't try to resolve "node:sqlite" itself.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

export type DB = DatabaseSyncType;

export function openDb(file?: string): DB {
  const target = file ?? path.join(process.env.DATA_DIR ?? path.resolve('data'), 'salon.db');
  if (target !== ':memory:') mkdirSync(path.dirname(target), { recursive: true });
  const db = new DatabaseSync(target);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL, name_gu TEXT NOT NULL,
      minutes INTEGER NOT NULL, price INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS barbers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      on_duty INTEGER NOT NULL DEFAULT 1, on_break INTEGER NOT NULL DEFAULT 0,
      sort INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY, day TEXT NOT NULL, token_no INTEGER NOT NULL,
      name TEXT NOT NULL, phone TEXT NOT NULL,
      barber_pref TEXT, assigned_barber TEXT,
      status TEXT NOT NULL, source TEXT NOT NULL,
      joined_at INTEGER NOT NULL, called_at INTEGER, started_at INTEGER, ended_at INTEGER,
      service_ids TEXT NOT NULL, minutes INTEGER NOT NULL, price INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS visits_day ON visits(day);
  `);
  seed(db);
  return db;
}

function seed(db: DB) {
  const has = db.prepare('SELECT COUNT(*) AS n FROM services').get() as { n: number };
  if (has.n > 0) return;
  const svc = db.prepare('INSERT INTO services (name_en, name_gu, minutes, price, sort) VALUES (?, ?, ?, ?, ?)');
  [
    ['Haircut', 'હેરકટ', 30, 150],
    ['Beard trim', 'દાઢી ટ્રિમ', 15, 80],
    ['Shave', 'શેવિંગ', 20, 100],
    ['Hair spa', 'હેર સ્પા', 45, 400],
    ['Hair colour', 'હેર કલર', 40, 350],
    ['Kids haircut', 'બાળકોનો હેરકટ', 20, 100],
    ['Head massage', 'માથાની માલિશ', 15, 120],
  ].forEach(([en, gu, m, p], i) => svc.run(en, gu, m, p, i));
  const brb = db.prepare('INSERT INTO barbers (id, name, on_duty, sort) VALUES (?, ?, ?, ?)');
  [
    ['ravi', 'Ravi', 1],
    ['amit', 'Amit', 1],
    ['imran', 'Imran', 1],
    ['suresh', 'Suresh', 0],
  ].forEach(([id, name, duty], i) => brb.run(id, name, duty, i));
  const set = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  set.run('queue_open', '1');
  set.run('closing_time', process.env.DEFAULT_CLOSING_TIME ?? '21:00');
}

// ---------- row mappers ----------

type Row = Record<string, unknown>;

export const toService = (r: Row): Service => ({
  id: Number(r.id),
  nameEn: String(r.name_en),
  nameGu: String(r.name_gu),
  minutes: Number(r.minutes),
  price: Number(r.price),
  active: Number(r.active) === 1,
  sort: Number(r.sort),
});

export const toBarber = (r: Row): Barber => ({
  id: String(r.id),
  name: String(r.name),
  onDuty: Number(r.on_duty) === 1,
  onBreak: Number(r.on_break) === 1,
  sort: Number(r.sort),
});

export const toVisit = (r: Row): Visit => ({
  id: String(r.id),
  day: String(r.day),
  tokenNo: Number(r.token_no),
  name: String(r.name),
  phone: String(r.phone),
  barberPref: (r.barber_pref as string | null) ?? null,
  assignedBarber: (r.assigned_barber as string | null) ?? null,
  status: r.status as Status,
  source: r.source as Visit['source'],
  joinedAt: Number(r.joined_at),
  calledAt: r.called_at === null ? null : Number(r.called_at),
  startedAt: r.started_at === null ? null : Number(r.started_at),
  endedAt: r.ended_at === null ? null : Number(r.ended_at),
  serviceIds: JSON.parse(String(r.service_ids)),
  minutes: Number(r.minutes),
  price: Number(r.price),
});
