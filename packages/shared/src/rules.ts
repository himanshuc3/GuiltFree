import { IST_OFFSET_MS, istParts, istToDate } from './ist';
import type { Limits, Order, Settings } from './schemas';

export type Metric = 'orders' | 'spend' | 'kcal';
export type Period = 'week' | 'month';
export type Level = 'none' | 'ok' | 'warn' | 'reached';

export interface MetricStatus {
  metric: Metric;
  used: number;
  limit: number | null;
  remaining: number | null;
  /** 0..1+ fraction of the limit used, null when no limit is set. */
  pct: number | null;
  level: Level;
}

export interface PeriodStatus {
  period: Period;
  start: string;
  end: string;
  metrics: MetricStatus[];
  level: Level;
  orderCount: number;
  /** Orders in the window with no calorie estimate yet; kcal usage is understated by these. */
  unestimatedOrders: number;
}

export interface Status {
  week: PeriodStatus;
  month: PeriodStatus;
  limitReached: boolean;
  reasons: string[];
  /** Earliest end of a period whose limit is reached, i.e. when ordering would be allowed again. */
  resetsAt: string | null;
}

export const WARN_AT = 0.8;

/** Weeks run Monday 00:00 to next Monday 00:00 IST; months run calendar month IST. */
export function periodWindow(now: Date, period: Period): { start: Date; end: Date } {
  const p = istParts(now);
  if (period === 'week') {
    const sinceMonday = (p.weekday + 6) % 7;
    return {
      start: istToDate(p.year, p.month, p.day - sinceMonday),
      end: istToDate(p.year, p.month, p.day - sinceMonday + 7),
    };
  }
  return { start: istToDate(p.year, p.month, 1), end: istToDate(p.year, p.month + 1, 1) };
}

function levelFor(used: number, limit: number | null): Level {
  if (limit === null) return 'none';
  if (used >= limit) return 'reached';
  if (used >= limit * WARN_AT) return 'warn';
  return 'ok';
}

const LEVEL_RANK: Record<Level, number> = { none: 0, ok: 1, warn: 2, reached: 3 };

function worst(levels: Level[]): Level {
  return levels.reduce<Level>((a, b) => (LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a), 'none');
}

function periodStatus(orders: Order[], limits: Limits, now: Date, period: Period): PeriodStatus {
  const { start, end } = periodWindow(now, period);
  const inWindow = orders.filter((o) => {
    const t = Date.parse(o.deliveredAt);
    return t >= start.getTime() && t < end.getTime();
  });

  const used: Record<Metric, number> = {
    orders: inWindow.length,
    spend: inWindow.reduce((s, o) => s + o.total, 0),
    kcal: inWindow.reduce((s, o) => s + (o.kcalTotal ?? 0), 0),
  };

  const metrics = (['orders', 'spend', 'kcal'] as const).map((metric): MetricStatus => {
    const limit = limits[metric] ?? null;
    return {
      metric,
      used: used[metric],
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used[metric]),
      pct: limit === null ? null : used[metric] / limit,
      level: levelFor(used[metric], limit),
    };
  });

  return {
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    metrics,
    level: worst(metrics.map((m) => m.level)),
    orderCount: inWindow.length,
    unestimatedOrders: inWindow.filter((o) => o.kcalTotal === undefined).length,
  };
}

const LABEL: Record<Metric, string> = { orders: 'orders', spend: 'spend', kcal: 'calories' };

export function computeStatus(
  orders: Order[],
  settings: Pick<Settings, 'limits'>,
  now: Date,
): Status {
  const week = periodStatus(orders, settings.limits.weekly, now, 'week');
  const month = periodStatus(orders, settings.limits.monthly, now, 'month');

  const reasons: string[] = [];
  const resets: string[] = [];
  for (const ps of [week, month]) {
    const name = ps.period === 'week' ? 'Weekly' : 'Monthly';
    for (const m of ps.metrics) {
      if (m.level === 'reached') {
        reasons.push(`${name} ${LABEL[m.metric]} limit reached (${Math.round(m.used)}/${m.limit})`);
        resets.push(ps.end);
      }
    }
  }

  return {
    week,
    month,
    limitReached: reasons.length > 0,
    reasons,
    resetsAt: resets.length ? resets.sort()[0] : null,
  };
}

export { IST_OFFSET_MS };
