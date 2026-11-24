export type VisitStatus = 'waiting' | 'called' | 'in_chair' | 'done' | 'cancelled' | 'no_show';
export type BarberState = 'off' | 'break' | 'free' | 'called' | 'in_chair';

export interface PublicService {
  id: number;
  nameEn: string;
  nameGu: string;
  minutes: number;
  price: number;
}

export interface PublicBarber {
  id: string;
  name: string;
  onBreak: boolean;
  state: BarberState;
  waitNew: number | null;
  current: null | {
    token: string;
    displayName: string;
    status: VisitStatus;
    calledAt: number | null;
    startedAt: number | null;
    minutes: number;
    services: { nameEn: string; nameGu: string }[];
  };
}

export interface PublicState {
  now: number;
  salon: { name: string; queueOpen: boolean; closingTime: string; onlineUntil: string; onlineOpen: boolean; closedReason: null | 'owner' | 'time' };
  noShowMinutes: number;
  services: PublicService[];
  barbers: PublicBarber[];
  queue: { token: string; displayName: string; barberPref: string | null; position: number; wait: number | null }[];
  waitingCount: number;
  waitNewAny: number | null;
}

export interface StaffVisit {
  id: string;
  token: string;
  tokenNo: number;
  name: string;
  phone: string;
  barberPref: string | null;
  assignedBarber: string | null;
  status: VisitStatus;
  source: 'online' | 'walkin';
  joinedAt: number;
  calledAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
  serviceIds: number[];
  minutes: number;
  price: number;
  position: number | null;
  wait: number | null;
  canNoShow: boolean;
}

export interface StaffState extends PublicState {
  allServices: (PublicService & { active: boolean; sort: number })[];
  allBarbers: { id: string; name: string; onDuty: boolean; onBreak: boolean; sort: number; state: BarberState; next: string | null }[];
  visits: StaffVisit[];
  stats: { served: number; avgWait: number; noShows: number; cancelled: number };
}

export interface VisitView {
  id: string;
  token: string;
  name: string;
  firstName: string;
  status: VisitStatus;
  barberPref: { id: string; name: string; onBreak: boolean } | null;
  assignedBarber: { id: string; name: string } | null;
  services: { nameEn: string; nameGu: string; minutes: number; price: number }[];
  minutes: number;
  price: number;
  joinedAt: number;
  calledAt: number | null;
  startedAt: number | null;
  position: number | null;
  wait: number | null;
  getReady: boolean;
  noShowMinutes: number;
  now: number;
}
