import { load } from './storage';

export class ApiError extends Error {
  constructor(public code: string, public status: number, public data: Record<string, unknown> = {}) {
    super(code);
  }
}

async function request<T>(method: string, url: string, body?: unknown, staff = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (staff) headers['x-staff-pin'] = load('sq.pin') ?? '';
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('network', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'server_error', res.status, data);
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
};

export const staffApi = {
  get: <T>(url: string) => request<T>('GET', `/api/staff${url}`, undefined, true),
  post: <T>(url: string, body?: unknown) => request<T>('POST', `/api/staff${url}`, body ?? {}, true),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', `/api/staff${url}`, body ?? {}, true),
};

export const errorKey = (e: unknown) => `err.${e instanceof ApiError ? e.code : 'server_error'}`;
