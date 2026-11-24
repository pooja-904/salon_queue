import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { openDb } from './db.js';
import { AppError, Store } from './store.js';

const PORT = Number(process.env.PORT ?? 3000);
const STAFF_PIN = process.env.STAFF_PIN ?? '2468';
const NO_SHOW_MINUTES = Number(process.env.NO_SHOW_MINUTES ?? 10);

const store = new Store(openDb(), { noShowMinutes: NO_SHOW_MINUTES });
const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: true } });

app.use(express.json({ limit: '20kb' }));

// ---------- live updates ----------

function broadcast() {
  io.emit('state', store.publicState());
  io.to('staff').emit('staff', store.staffState());
}

io.on('connection', (socket) => {
  socket.emit('state', store.publicState());
  if (socket.handshake.auth?.pin === STAFF_PIN) {
    socket.join('staff');
    socket.emit('staff', store.staffState());
  }
});

// Waiting times move with the clock, so refresh everyone every 30 s.
setInterval(broadcast, 30_000).unref();

// ---------- helpers ----------

type Handler = (req: Request, res: Response) => unknown;
const route = (fn: Handler, mutates = true) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = fn(req, res);
    if (mutates) broadcast();
    if (!res.headersSent) res.json(out ?? { ok: true });
  } catch (err) {
    next(err);
  }
};

const staffOnly = (req: Request, _res: Response, next: NextFunction) => {
  if (req.get('x-staff-pin') !== STAFF_PIN) return next(new AppError('unauthorized', 401));
  next();
};

const joinBody = (b: Record<string, unknown>) => ({
  name: String(b.name ?? ''),
  phone: String(b.phone ?? ''),
  serviceIds: Array.isArray(b.serviceIds) ? (b.serviceIds as number[]) : [],
  barberId: b.barberId ? String(b.barberId) : null,
});

// ---------- public API ----------

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.get('/api/state', route(() => store.publicState(), false));
app.post('/api/visits', route((req) => store.join(joinBody(req.body ?? {}), 'online')));
app.get('/api/visits/lookup', route((req) => store.findByPhone(String(req.query.phone ?? '')), false));
app.get('/api/visits/:id', route((req) => store.visitView(req.params.id), false));
app.post('/api/visits/:id/cancel', route((req) => {
  const v = store.visit(req.params.id);
  if (v && v.status !== 'waiting') throw new AppError('bad_transition', 409);
  store.cancel(req.params.id);
}));

// ---------- staff API (PIN) ----------

const staff = express.Router();
staff.use(staffOnly);
staff.post('/login', route(() => ({ ok: true }), false));
staff.get('/state', route(() => store.staffState(), false));
staff.post('/walkin', route((req) => store.join(joinBody(req.body ?? {}), 'walkin')));
staff.post('/barbers/:id/call-next', route((req) => store.callNext(req.params.id)));
staff.post('/barbers/:id/break', route((req) => store.setBreak(req.params.id, Boolean(req.body?.onBreak))));
staff.patch('/barbers/:id', route((req) => store.updateBarber(req.params.id, req.body ?? {})));
staff.post('/barbers', route((req) => store.addBarber(req.body?.name)));
staff.post('/visits/:id/start', route((req) => store.start(req.params.id)));
staff.post('/visits/:id/done', route((req) => store.done(req.params.id)));
staff.post('/visits/:id/no-show', route((req) => store.noShow(req.params.id)));
staff.post('/visits/:id/cancel', route((req) => store.cancel(req.params.id)));
staff.post('/visits/:id/readd', route((req) => store.readd(req.params.id)));
staff.post('/services', route((req) => store.saveService(req.body ?? {})));
staff.patch('/services/:id', route((req) => store.saveService({ ...(req.body ?? {}), id: Number(req.params.id) })));
staff.patch('/settings', route((req) => store.updateSettings(req.body ?? {})));
app.use('/api/staff', staff);

app.use('/api', (_req, _res, next) => next(new AppError('not_found', 404)));

// ---------- client (production build) ----------

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ---------- errors ----------

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) return res.status(err.status).json({ error: err.code, ...err.extra });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

http.listen(PORT, () => {
  console.log(`Salon Queue server on http://localhost:${PORT}`);
});
