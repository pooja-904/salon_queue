import type { TFn } from '../i18n/i18n';

export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** "20:30" -> "8:30 PM" */
export function hhmmTo12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function clockTime(ms: number) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(ms))
    .toUpperCase();
}

export function longDate(ms: number) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ms));
}

/** 581 seconds -> "9:41" */
export function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const minutesSince = (from: number, now: number) => Math.max(0, Math.floor((now - from) / 60000));

/** Wait text: "Any moment now" / "about 35 min" */
export function waitText(t: TFn, wait: number | null) {
  if (wait === null) return '–';
  return wait === 0 ? t('common.anyMoment') : t('common.aboutMin', { n: wait });
}

export const initial = (name: string) => name.trim().charAt(0).toUpperCase();
