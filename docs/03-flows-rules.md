# Salon Queue – Flows & Rules

## Flow: remote customer
1. Scans QR / opens Home -> Join -> picks Haircut + 'Any barber' -> gets S-14, 6th
2. Watches My Status from home; at about 15 min left gets 'Start coming'
3. Receptionist taps Call next on Amit's card -> S-14 is 'Called'
4. Customer's phone: 'It's your turn! Go to Amit' + 10 min countdown; TV flashes S-14
5. Amit taps Start, then Done -> S-14 leaves the queue

## Flow: walk-in
Receptionist taps + Add walk-in -> name, phone, services, barber -> joins the
same queue at the end (first come, first served).

## Flow: no-show
Called but not here -> receptionist can call their phone. After 10 min they
can mark No-show. If the customer comes later, receptionist taps Re-add ->
new token at the END.

## Flow: barber break
Ravi turns on 'On break' -> he can't be called. Customers who chose Ravi see
'Ravi is on break' and keep their place. 'Any' customers go to other barbers.

## Rules
- Statuses: Waiting -> Called -> In chair -> Done. Never backwards.
  Waiting -> Cancelled.  Called -> No-show.
- Status changes are checked on the server; wrong moves are rejected.
- Tokens S-1, S-2... start again from S-1 every day.
- First come, first served. Online and walk-in customers are in the same line.
- Call next for barber X picks the earliest customer who chose X or 'Any'.
- A customer who chose Ravi is never given to another barber.
- A barber has only one customer (called or in chair) at a time.
- Barber on break can't be called. He can't go on break while a customer is
  called or in his chair.
- A barber can't be marked off duty while people are waiting for him.
- 1 to 3 services per customer.
- Phone: 10 digits starting with 6-9. One active spot per phone number.
- Online joining closes 30 min before closing time (or when the owner closes it).
  Walk-ins are still allowed.
- Service turned off -> hidden from Join (people already in line keep it).
- No SMS or OTP. The phone number is only used to stop duplicates, to find your
  spot again, and for reception to call you.
- TV shows first name + last initial only, never phone numbers.
- Reception, barber and admin screens need the staff PIN.

## Waiting time
'Total minutes ahead ÷ barbers' is wrong when people choose a barber, so the
app goes through the line in order:
- Each barber has a 'free at' time: now if free, start time + service minutes
  if busy, now + service minutes if someone is called, now + 15 min if on break.
- A customer who chose a barber waits for that barber. 'Any' goes to whoever
  is free first. Then that barber's 'free at' moves forward by the customer's
  service minutes.
- Round up to the next 5 min. Never show 0 min if someone is ahead
  ('Any moment now' when you're first and a barber is free).
- Recalculate on every change and every minute.

## Test checklist
[ ] Join with 2 services -> correct total time and price shown
[ ] 4th service can't be selected -> 'You can pick up to 3 services'
[ ] Phone with 9 digits or starting with 5 -> error shown
[ ] Same phone joins twice -> shown existing spot, no duplicate
[ ] Call next for Amit skips a customer who chose Ravi
[ ] 'Any barber' customer can be called by any barber
[ ] Call next -> customer's phone shows 'It's your turn' within 5 s
[ ] Start/Done on Barber View updates Reception and TV within 5 s
[ ] No-show only after 10 min; Re-add -> new token at the end
[ ] Barber on break can't be called; his customers see 'Ravi is on break'
[ ] Estimated wait never shows 0 min with people ahead, and goes down as customers finish
[ ] Close online queue -> Join button disabled with message; walk-in still works
[ ] Service turned off -> disappears from Join
[ ] Language toggle switches all labels to Gujarati
[ ] Staff screens ask for PIN; wrong PIN rejected
[ ] Refresh any screen -> same data still there
[ ] Phone, tablet and TV windows all stay in sync
[ ] TV shows 'Kunal S.', never a phone number
