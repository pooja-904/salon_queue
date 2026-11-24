// A soft two-note chime made with Web Audio (no sound file needed).
// Browsers only allow sound after the person taps something once, so
// screens call unlockSound() from a button press.
let ctx: AudioContext | null = null;

export function unlockSound() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* no audio available */
  }
}

export const soundReady = () => !!ctx && ctx.state === 'running';

export function chime() {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  [
    [880, 0],
    [1318.5, 0.22],
  ].forEach(([freq, at]) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.35, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.9);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(now + at);
    osc.stop(now + at + 1);
  });
}

export function vibrate() {
  try {
    navigator.vibrate?.([300, 120, 300, 120, 500]);
  } catch {
    /* not supported (e.g. iPhone) */
  }
}
