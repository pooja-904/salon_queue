import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { PublicState, StaffState } from './types';

// One shared public socket for the whole app; staff screens open their own
// socket with the PIN so they also receive names and phone numbers.
let publicSocket: Socket | null = null;
let lastPublic: PublicState | null = null;
let clockOffset = 0; // server time - device time

function getPublicSocket() {
  if (!publicSocket) {
    publicSocket = io({ transports: ['websocket', 'polling'] });
    publicSocket.on('state', (s: PublicState) => {
      lastPublic = s;
      clockOffset = s.now - Date.now();
    });
  }
  return publicSocket;
}

/** Device time corrected to the server's clock (for countdowns). */
export const serverNow = () => Date.now() + clockOffset;

export function useLiveState(): PublicState | null {
  const [state, setState] = useState<PublicState | null>(lastPublic);
  useEffect(() => {
    const s = getPublicSocket();
    const on = (next: PublicState) => setState(next);
    s.on('state', on);
    if (lastPublic) setState(lastPublic);
    return () => {
      s.off('state', on);
    };
  }, []);
  return state;
}

export function useConnected(socket?: Socket | null) {
  const s = socket ?? getPublicSocket();
  const [connected, setConnected] = useState(s.connected);
  useEffect(() => {
    const up = () => setConnected(true);
    const down = () => setConnected(false);
    s.on('connect', up);
    s.on('disconnect', down);
    setConnected(s.connected);
    return () => {
      s.off('connect', up);
      s.off('disconnect', down);
    };
  }, [s]);
  return connected;
}

/** Calls `fn` every time the public state changes (used to refetch own data). */
export function useOnStateChange(fn: () => void) {
  useEffect(() => {
    const s = getPublicSocket();
    s.on('state', fn);
    return () => {
      s.off('state', fn);
    };
  }, [fn]);
}

export function useStaffState(pin: string | null) {
  const [state, setState] = useState<StaffState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  useEffect(() => {
    if (!pin) return;
    const s = io({ auth: { pin }, transports: ['websocket', 'polling'] });
    s.on('staff', (next: StaffState) => {
      clockOffset = next.now - Date.now();
      setState(next);
    });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [pin]);
  return { state, socket };
}

/** Re-renders every `ms` so countdowns and "x min ago" stay fresh. */
export function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return serverNow();
}
