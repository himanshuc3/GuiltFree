import type { LimitsUpdate, Order, StatusResponse } from '@guiltfree/shared';
import { API_KEY, API_URL } from './config';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, ...init.headers },
    });
  } catch {
    throw new Error(`Cannot reach the server at ${API_URL}. Is it running?`);
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `Server error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  status: () => request<StatusResponse>('/status'),
  orders: () => request<{ orders: Order[] }>('/orders?limit=30').then((r) => r.orders),
  sync: () => request<unknown>('/sync', { method: 'POST' }),
  saveLimits: (limits: LimitsUpdate) =>
    request<unknown>('/settings', { method: 'PUT', body: JSON.stringify({ limits }) }),
};
