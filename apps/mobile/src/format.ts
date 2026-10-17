import type { Level, Metric } from '@guiltfree/shared';

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const IST = 'Asia/Kolkata';

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, weekday: 'long', day: 'numeric', month: 'short' });
}

export const METRIC_LABEL: Record<Metric, string> = { orders: 'Orders', spend: 'Spend', kcal: 'Calories' };

export function formatMetric(metric: Metric, value: number): string {
  if (metric === 'spend') return inr(value);
  if (metric === 'kcal') return `${Math.round(value).toLocaleString('en-IN')} kcal`;
  return String(Math.round(value));
}

export const LEVEL_COLOR: Record<Level, string> = {
  none: '#9aa0a6',
  ok: '#1ba672',
  warn: '#e8a317',
  reached: '#d93025',
};
