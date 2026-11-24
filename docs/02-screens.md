# Salon Queue – Screens

Theme: navy + white, premium and calm (design canvas option D).
Customer and staff screens: off-white background, white rounded cards, navy text and buttons.
'It's your turn' and the TV: full dark navy with frosted-glass panels.
Big numbers (tokens, times) in a light font weight.
Motion: screens rise in softly, numbers roll when they change, list rows slide in/out,
'It's your turn' plays a short entrance (token blurs into focus). Respects 'reduce motion'.
Green = free, amber = waiting long, grey = on break. Buttons at least 44px.

Dummy data:
- Services: Haircut 30 min ₹150, Beard trim 15 min ₹80, Shave 20 min ₹100,
  Hair spa 45 min ₹400, Hair colour 40 min ₹350, Kids haircut 20 min ₹100,
  Head massage 15 min ₹120
- Barbers: Ravi, Amit, Imran (on duty), Suresh (off duty)

## Screen 1: Home  (/)   – phone
Customer checks how busy the salon is before joining.
- Salon name + logo, 'Open · Online joining till 8:30 PM' badge
- Live card: '6 people waiting · about 50 min'
- Barber chips with status and wait: Ravi (busy, ~40 min) · Amit (free) · Imran (on break)
- Big navy button [ Join Queue ] (disabled with a message when the queue is closed,
  e.g. 'Online joining stopped at 8:30 PM. Walk-ins welcome until 9:00 PM.')
- If this phone is already in line: banner 'You're in line – S-14, 3rd'
- 'Already in line? Find my spot' -> enter phone -> opens My Status
- Empty: 'No one waiting – walk right in!'

## Screen 2: Join Queue  (/join)   – phone
Customer takes a spot without going to the desk.
- Name, Phone (10 digits, starts with 6-9)
- Service cards (2 per row, multi-select, max 3): name, minutes, price
- Barber picker: 'Any barber (fastest) ~15 min' or a barber card with their own wait.
  On-break barber greyed out, off-duty barber hidden
- Sticky summary at the bottom: 'Total 45 min · ₹230 · Expected wait ~35 min'
- [ Confirm ] -> goes to My Status
- Same phone already in line -> 'You're already in line as S-14' + [ Open my status ]
- Queue closed -> message instead of the form

## Screen 3: My Status  (/status/:id)   – phone
Customer can wait anywhere and still know when to come.
- 'Hi Kunal, you're in line.'
- Navy 'pass' card: token 'S-14' large, Live dot, position '4th', est. wait '35 min',
  barber 'Ravi' or 'Any'; updates by itself
- Progress bar with steps: Joined -> Get ready -> Your turn -> In chair -> Done
- Services and total price
- Small note: 'Keep this page open – we'll alert you here'
- Wait <= 15 min or 2nd in line: banner 'Start coming to the salon'
- When called: full-screen navy 'It's your turn' + token + 'Please go to Ravi'
  + 10:00 countdown ring, chime, vibration (Android)
- Chosen barber on break: 'Ravi is on break – you keep your place'
- No-show: 'We called you but you didn't come. Please see reception.'
- Done: 'Thanks for visiting!' + [ Join again ]
- [ Cancel my spot ] (only while waiting) with a confirmation pop-up
- Offline: small 'Reconnecting...' label

## Screen 4: Reception Dashboard  (/reception)   – tablet, landscape, PIN
Receptionist sees all barbers and the whole line on one screen.
- Top: 'Waiting 6 · Longest wait 48 min', queue Open/Closed, [ + Add walk-in ]
- Left: barber cards (name, status, current customer, time left as a progress bar)
  - Free: [ Call next ] showing who it will call: 'Next: S-15 Kunal'
  - Called: 'S-14 Kunal · called 3 min ago', [ Call phone ], [ No-show ] (after 10 min)
- Right: waiting list in order: token, name, services, preferred barber,
  waiting time, estimated wait, [ Cancel ]
- Waiting > 60 min highlighted in amber
- [ + Add walk-in ] opens a quick form (name, phone, services, barber)
- 'Today' tab: done / cancelled / no-show. No-show has [ Re-add ] (new token at the end)
- On a phone the two columns stack

## Screen 5: Barber View  (/barber/:id)   – phone, PIN
Barber starts and finishes customers without walking to the desk.
- /barber shows the list of barbers to pick from
- Current customer: token, name, services, timer since start (amber if over time)
- Big buttons: [ Start ] -> [ Done ]
- 'Next for you: S-15 Kunal (Haircut)' or 'No one waiting for you'
- Toggle: Available / On break (not allowed while a customer is called or in the chair)

## Screen 6: Waiting Area TV  (/display)   – TV 1920x1080, no login
People in the salon see who's next without asking.
- Dark navy screen: logo, 'Online joining open', clock
- 'Now serving': row per barber with initial, name, status, token
  ('In chair' / 'Calling' / 'Free' / 'On break')
- 'Up next' list of 5 tokens with first name + last initial ('Kunal S.') and estimated time
- Never show phone numbers
- 'Scan to join' QR + current wait in the corner
- Barber who is calling: row turns white and glows + chime
- Footer: opening hours, barbers on duty, people waiting
- Labels in English and Gujarati together; text readable from 5 metres
- 'Click to start' on first load (browsers need a click before playing sound)

## Screen 7: Owner Settings  (/admin)   – tablet/laptop, PIN
Owner sets up the day and checks how it went.
- Queue switch: Open / Closed for online joining + closing time (picked from a list
  of evening times, so AM/PM can't be mixed up)
  (online joining stops 30 min before closing; a note explains when the switch is on
  but the cutoff time has passed)
- Services list (name EN/GU, minutes, price, on/off), add/edit
- Barbers on duty today (toggle), add barber
- Today's stats: customers served, average wait, no-shows, cancelled
- Door QR code with a Print button
