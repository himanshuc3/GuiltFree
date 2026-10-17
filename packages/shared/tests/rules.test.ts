import { describe, expect, it } from 'vitest';
import { computeStatus, periodWindow, type Order } from '../src';

const order = (id: string, deliveredAt: string, total = 200, kcal: number | null = 500): Order => ({
  orderId: id,
  restaurant: 'R',
  items: [{ name: 'x', qty: 1, price: total }],
  charges: [],
  total,
  deliveredAt,
  kcalTotal: kcal ?? undefined,
  parsedBy: 'rules',
  messageId: id,
});

describe('periodWindow (IST)', () => {
  it('starts the week on Monday 00:00 IST', () => {
    // Thu 15 Oct 2026 10:44 UTC = 16:14 IST
    const { start, end } = periodWindow(new Date('2026-10-15T10:44:00Z'), 'week');
    expect(start.toISOString()).toBe('2026-10-11T18:30:00.000Z'); // Mon 12 Oct 00:00 IST
    expect(end.toISOString()).toBe('2026-10-18T18:30:00.000Z'); // Mon 19 Oct 00:00 IST
  });

  it('treats Sunday 23:59 IST as the previous week and Monday 00:00 IST as the next', () => {
    const sundayLate = periodWindow(new Date('2026-10-18T18:29:00Z'), 'week'); // Sun 23:59 IST
    const mondayStart = periodWindow(new Date('2026-10-18T18:30:00Z'), 'week'); // Mon 00:00 IST
    expect(sundayLate.start.toISOString()).toBe('2026-10-11T18:30:00.000Z');
    expect(mondayStart.start.toISOString()).toBe('2026-10-18T18:30:00.000Z');
  });

  it('uses the IST calendar day, not the UTC one, near midnight', () => {
    // 2026-10-31 20:00 UTC is already 1 Nov 01:30 IST
    const { start, end } = periodWindow(new Date('2026-10-31T20:00:00Z'), 'month');
    expect(start.toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-11-30T18:30:00.000Z');
  });

  it('rolls the month over the year boundary', () => {
    const { end } = periodWindow(new Date('2026-12-10T00:00:00Z'), 'month');
    expect(end.toISOString()).toBe('2026-12-31T18:30:00.000Z');
  });
});

describe('computeStatus', () => {
  const now = new Date('2026-10-17T06:00:00Z');
  const limits = { weekly: { orders: 3, spend: 1000, kcal: 2000 }, monthly: {} };

  it('reports no limits as level none and never blocks', () => {
    const s = computeStatus([order('a', '2026-10-15T10:44:00Z')], { limits: { weekly: {}, monthly: {} } }, now);
    expect(s.limitReached).toBe(false);
    expect(s.week.level).toBe('none');
    expect(s.week.orderCount).toBe(1);
  });

  it('counts only orders inside the window', () => {
    const orders = [
      order('this-week', '2026-10-15T10:44:00Z'),
      order('last-week', '2026-10-11T18:29:00Z'), // Sun 23:59 IST
      order('next-week', '2026-10-18T18:30:00Z'),
    ];
    const s = computeStatus(orders, { limits }, now);
    expect(s.week.orderCount).toBe(1);
  });

  it('warns at 80% and reaches at 100% of a limit', () => {
    const base = { limits: { weekly: { orders: 5 }, monthly: {} } };
    const four = ['a', 'b', 'c', 'd'].map((id) => order(id, '2026-10-14T10:00:00Z'));
    expect(computeStatus(four, base, now).week.metrics[0].level).toBe('warn');
    const five = [...four, order('e', '2026-10-14T11:00:00Z')];
    const s = computeStatus(five, base, now);
    expect(s.week.metrics[0].level).toBe('reached');
    expect(s.limitReached).toBe(true);
    expect(s.reasons[0]).toMatch(/Weekly orders limit reached \(5\/5\)/);
    expect(s.resetsAt).toBe('2026-10-18T18:30:00.000Z');
  });

  it('reaches on spend or kcal independently of order count', () => {
    const s = computeStatus([order('a', '2026-10-14T10:00:00Z', 1200, 2500)], { limits }, now);
    const byMetric = Object.fromEntries(s.week.metrics.map((m) => [m.metric, m.level]));
    expect(byMetric).toEqual({ orders: 'ok', spend: 'reached', kcal: 'reached' });
    expect(s.reasons).toHaveLength(2);
  });

  it('flags orders without calorie estimates instead of silently counting zero', () => {
    const s = computeStatus([order('a', '2026-10-14T10:00:00Z', 200, null)], { limits }, now);
    expect(s.week.unestimatedOrders).toBe(1);
    expect(s.week.metrics.find((m) => m.metric === 'kcal')!.used).toBe(0);
  });

  it('uses the earliest reset when week and month limits are both reached', () => {
    const s = computeStatus(
      [order('a', '2026-10-14T10:00:00Z')],
      { limits: { weekly: { orders: 1 }, monthly: { orders: 1 } } },
      now,
    );
    expect(s.resetsAt).toBe('2026-10-18T18:30:00.000Z');
  });
});
