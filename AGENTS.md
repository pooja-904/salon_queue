# AGENTS.md – Salon Queue Management

Queue app for a salon: customers join from their phone, see wait time and
get called; reception and barbers manage the queue; TV display.

## Read first
- docs/01-brief.md        -> features + what NOT to build
- docs/02-screens.md      -> every screen's layout and behaviour
- docs/03-flows-rules.md  -> flows, queue rules, test checklist

## Stack
React + Vite + TypeScript + Tailwind CSS (client), Express + Socket.IO (server),
SQLite for storage. Run with `npm run dev`. Tests with `npm test`.
Staff PIN comes from the STAFF_PIN environment variable.
Hosting: Railway (one service + a volume for the SQLite file).
Live link must be the first line after the title in README.md.

## How to work
- One screen or one feature per task. Don't touch other screens.
- The server checks every queue action and sends the updated queue to all screens.
- Queue rules live in ONE place (server/src/rules.ts). Reuse them everywhere.
- Theme: navy (#0B1630) + white on an off-white background (#F4F5F8),
  accent blue (#3B63B8) only for progress and glow. Fonts: Geist + Noto Sans Gujarati.
  Big numbers in light weight. Rounded cards with soft shadows.
  'It's your turn' and the TV are dark navy with frosted-glass panels.
- Motion: use the Motion library + CSS tokens in index.css (enter = decelerate, exit =
  accelerate, under 400 ms except the 'your turn' moment). Always respect reduced motion.
- All labels via the EN/GU language files; no hard-coded text.
- Never show phone numbers on the TV.
- Never add features from the 'Don't build' list.
- After each task: list changed files and how to test the change.
