# Prompts

All prompts used for this project, in order, including the ones that didn't work the first time.
Agent: Claude (Anthropic).

## Planning and docs

1. Study the Salon Queue Management handout and the canteen lab prompts. Summarise what the lab actually needs and list anything that is unclear or missing in the handout. Don't write code yet.

2. Research the best-selling salon and queue apps (Great Clips Online Check-In, Waitwhile, Qminder, Squire, Zenoti, Booksy and Indian walk-in apps) and also order trackers like Domino's. Review their UI/UX and features with me and suggest what we should copy for our salon queue.
   *(Result: a list of about 18 features. Too much for a 2–3 hour lab, because grading checks that the app matches our own docs.)*

3. The handout only gives sample features. Keep the 6 must-have features and 7 screens from the sample and add only 4 cheap improvements: wait time per barber on Join, a progress tracker and countdown on My Status, short names and a QR on the TV, and a staff PIN plus closing time in settings.

4. We can't send SMS. Explain how the phone number is used and how customers get alerted.

5. Suggest a tech stack that keeps phone, tablet and TV in sync and still works when the TA opens the link weeks later. Compare Vercel + Supabase, Render and Railway.

6. Write docs/01-brief.md, docs/02-screens.md, docs/03-flows-rules.md and AGENTS.md for this scope. Fix the gaps in the handout: closing time setting, staff PIN, waiting time per barber, daily token reset.

7. Rewrite the four docs in the same plain style as the handout samples: short lines, -> arrows, quoted labels and [ Buttons ].

## Theme

8. Charcoal + gold looks bad. Make three different theme directions on a design canvas (My Status, It's your turn, TV) and let me pick.

9. I like the navy and white one, but the stripes look bad. Remove them.

10. Add something to make it look more professional.

11. It still doesn't look premium. It looks cheap.
    *(Result: option D – a wallet-pass token card, light large numbers, soft shadows and a frosted-glass TV. Approved.)*

12. Update the docs with theme D: navy + white, the pass card on My Status, a navy "It's your turn" screen and the dark glass TV.

## Build

13. Step 1 only. Set up React + Vite + TypeScript + Tailwind for the client and Express + Socket.IO + SQLite for the server. Put all queue rules in server/src/rules.ts with tests for every rule in docs/03-flows-rules.md. The server checks every action and sends the full queue to every screen. Add the theme D colours and the EN/GU language files. List changed files and test commands.

14. Build Screen 1 (Home) and Screen 2 (Join Queue) from docs/02-screens.md. Join must validate the name and a 10-digit phone starting with 6–9, block a 4th service, and show the total time, price and expected wait live. Same phone twice -> show the existing spot.

15. Build Screen 3 (My Status): the navy pass card with token, position, est. wait and barber, the progress bar, a "Start coming" banner at 15 min or 2nd in line, a cancel pop-up, and "Ravi is on break". When called, show the full navy "It's your turn" screen with a 10:00 countdown ring, a chime and vibration.

16. Build the Reception Dashboard (Screen 4) for a 10-inch tablet in landscape: barber cards with Call next showing who it will call, Call phone and No-show (only after 10 min), the waiting list with waited time and est. wait (amber after 60 min), Add walk-in, and a Today tab with Re-add for no-shows. Protect it with the staff PIN.

17. Build Barber View (Screen 5) and the Waiting Area TV (Screen 6). The barber gets one huge Start/Done button and an Available/On break toggle (blocked while busy). The TV is 1920x1080 scaled to fit: barber rows, the calling row turns white and glows with a chime, Up next with "Kunal S." names only, a real QR code, and English and Gujarati together.

18. Build Owner Settings (Screen 7): open/close online joining, closing time, services (EN/GU name, minutes, price, on/off), barbers on duty, today's stats, and a door QR with Print.

## Verify and fix

19. Run the full test checklist in docs/03-flows-rules.md in real browser windows (phone, tablet, TV) and take screenshots of every screen. Report PASS/FAIL for each item.
    *(Result: 20/20 checks passed. Call next reached the customer's phone in about 0.1 s.)*

20. Bug: in Gujarati the small labels are broken apart ("ત મા રો ટો ક ન") and the token digits switch font. Expected: Gujarati joined normally and digits in the same font as English. Explain the cause, then fix it.
    *(Cause: letter-spacing on the uppercase labels and a CSS rule that forced the Gujarati font onto everything.)*

21. Bug: on Join, the red phone error stays after I fix the number. Expected: it disappears as soon as I edit the field.

22. On "It's your turn", the bottom text and "Tap to turn on sound" wrap badly. Put them on their own lines, centred.

23. The animations are missing, and that kills the premium feel. Add purposeful motion following the motion guide: screens rise in with a short stagger, numbers roll when they change (tokens, waits, positions, clock), list rows slide in and out and glide on reorder (reception and TV), a sliding pill on the language and tab switches, springy toggles, dialogs and toasts that ease in, and a short choreographed entrance for "It's your turn" (token blurs into focus). Keep it fast and respect "reduce motion".

24. Online joining is switched on in /admin, but Home still says it's closed. Why?
    *(Cause: not a bug – it was 11 PM and online joining stops 30 min before the 9 PM closing time. Fix: Home, Join and Admin now say why it's closed.)*

## Deploy

25. Prepare this app for deployment on Railway: one service with a Dockerfile, a volume for the SQLite file, and the health check at /api/health. Put the live link at the very top of README.md and the staff PIN right below it.
