# Salon Queue Management System

**Live demo:** https://client-production-618a66b1.up.railway.app/
**Hosted on:** Railway (one service – frontend, backend and SQLite on a volume)
**Staff PIN for reception / barber / admin screens:** `2468`

## About
A walk-in queue for a salon (demo salon: Kesh Studio). Customers join from their
phone, see their live position and wait time, and get a full-screen "It's your turn"
alert. Reception runs the queue from a tablet, barbers start and finish customers from
their phone, and a TV in the waiting area shows who is in the chair and who is next.
English and Gujarati on every screen.

Project docs: [brief](docs/01-brief.md) · [screens](docs/02-screens.md) ·
[flows & rules](docs/03-flows-rules.md) · [AGENTS.md](AGENTS.md) · [prompts](prompts.md)

## Screens
| Screen | Path | Device |
|---|---|---|
| Home | `/` | phone |
| Join Queue | `/join` | phone |
| My Status / It's your turn | `/status/:id` | phone |
| Reception Dashboard | `/reception` | tablet (PIN) |
| Barber View | `/barber` → `/barber/ravi` | phone (PIN) |
| Waiting Area TV | `/display` | TV 1920×1080 |
| Owner Settings | `/admin` | tablet / laptop (PIN) |

**Quick demo:** open `/display` on a laptop, `/reception` in a second window and `/`
on your phone. Join from the phone, tap **Call next** on reception, and watch the phone
and TV update.

## Stack
- **Client:** React + Vite + TypeScript + Tailwind CSS, Socket.IO client
- **Server:** Node 22 + Express + Socket.IO, Node's built-in SQLite
- **Queue rules:** one file, `server/src/rules.ts`, covered by tests in `server/src/queue.test.ts`
- The server checks every action and broadcasts the whole queue to every screen,
  so phone, tablet and TV stay in sync (usually well under a second).

## Run locally
Needs Node 22.13 or newer.

```bash
npm install
npm run dev        # client http://localhost:5173, server http://localhost:3000
npm test           # queue rule tests
npm run build && npm start   # production build on http://localhost:3000
```

## Run with Docker
Same image Railway builds:

```bash
docker compose up --build    # http://localhost:3000, data kept in the "salon-data" volume
```

## Deploy (Railway)
1. Push this repo to GitHub.
2. Railway → **New Project → Deploy from GitHub repo** → pick the repo. It builds with the `Dockerfile`.
3. In the service: **Settings → Volumes → Add volume**, mount path `/data` (keeps the SQLite file across restarts).
4. **Variables:** `STAFF_PIN=2468` (optional – that is the default).
5. **Settings → Networking → Generate domain**, then paste the link at the top of this README.

### Environment variables
| Name | Default | What it does |
|---|---|---|
| `PORT` | `3000` | Port (Railway sets this) |
| `DATA_DIR` | `/data` in Docker, `./data` locally | Where the SQLite file lives |
| `STAFF_PIN` | `2468` | PIN for reception, barber and admin screens |
| `NO_SHOW_MINUTES` | `10` | Minutes after calling before No-show unlocks (set `1` for a quick demo) |
| `DEFAULT_CLOSING_TIME` | `21:00` | Closing time on first start (can be changed in `/admin`) |

## Testing tips
- Online joining stops 30 minutes before closing time. Testing late at night? Open
  `/admin`, set a later closing time, and the Join button comes back.
- Sound needs one tap first (browser rule): the Confirm button on Join does this for
  customers, and the TV shows "Click to start the display".

## Known limitations
- No SMS, WhatsApp or OTP (out of scope in the brief), so customers keep the status page
  open to be alerted. Vibration works on Android only.
- Phone numbers are not verified.
- One salon only. The staff PIN is shared by everyone on staff.
