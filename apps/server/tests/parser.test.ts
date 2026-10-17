import { describe, expect, it } from 'vitest';
import { parseAmount, parseJourneyTime, parseSwiggyDelivered, reconcileBill } from '../src/parser/swiggyEmail';
import { billHtml, fixture } from './helpers';

const emailDate = new Date('2026-10-15T10:44:34Z');

describe('parseSwiggyDelivered on the real (redacted) fixture', () => {
  const { html, meta } = fixture('swiggy-delivered-1');
  const result = parseSwiggyDelivered(html, new Date(meta.date));

  it('parses', () => expect(result.ok).toBe(true));

  it('extracts the order', () => {
    if (!result.ok) throw new Error('unreachable');
    expect(result.order).toMatchObject({
      orderId: '251027100172577',
      restaurant: 'KC restaurant',
      total: 232,
      paymentMethod: 'Credit/Debit card',
      savings: 40,
      parsedBy: 'rules',
      deliveredAt: '2026-10-15T10:44:34.000Z',
      restaurantAt: '2026-10-15T09:45:00.000Z', // 3:15 PM IST
    });
    expect(result.order.items).toEqual([{ name: 'Paneer Momos', qty: 1, price: 193.6 }]);
    expect(result.order.charges).toEqual([
      { label: 'Restaurant Packaging', amount: 10 },
      { label: 'Platform fee with GST', amount: 17.98 },
      { label: 'Delivery Fee (FREE with Swiggy One) | 4.0 kms', amount: 0 },
      { label: 'Taxes', amount: 10.18 },
    ]);
  });

  it('never leaks the customer name or address into the result', () => {
    expect(JSON.stringify(result)).not.toMatch(/Test User|Example Street/);
  });
});

describe('synthetic multi-item fixtures', () => {
  for (const n of [2, 3, 4]) {
    it(`parses swiggy-delivered-${n}`, () => {
      const { html, meta } = fixture(`swiggy-delivered-${n}`);
      const r = parseSwiggyDelivered(html, new Date(meta.date));
      expect(r.ok).toBe(true);
    });
  }

  it('reads quantities and line totals', () => {
    const { html, meta } = fixture('swiggy-delivered-2');
    const r = parseSwiggyDelivered(html, new Date(meta.date));
    if (!r.ok) throw new Error('unreachable');
    expect(r.order.items).toEqual([
      { name: 'Chicken Biryani', qty: 2, price: 520 },
      { name: 'Raita', qty: 1, price: 40 },
    ]);
  });
});

describe('layout handling', () => {
  it('rejects emails with no bill table', () => {
    expect(parseSwiggyDelivered('<html><body>Hello</body></html>', emailDate)).toEqual({
      ok: false,
      reason: 'not_a_swiggy_bill',
    });
  });

  it('hands off the multi-restaurant layout to the fallback with meta and bill text only', () => {
    const html = billHtml({
      grouped: true,
      items: [['Burger x1', '₹200']],
      charges: [['Taxes', '₹10']],
      total: ['Paid Via UPI', '₹210'],
    });
    const r = parseSwiggyDelivered(html, emailDate);
    expect(r).toMatchObject({ ok: false, reason: 'layout_unrecognized', meta: { orderId: '999' } });
    if (r.ok) throw new Error('unreachable');
    expect(r.billText).toContain('Burger x1');
    expect(r.billText).not.toMatch(/Someone|Some Address/);
  });

  it('flags a bill that does not add up instead of guessing', () => {
    const html = billHtml({
      items: [['Burger x1', '₹200']],
      charges: [['Taxes', '₹10']],
      total: ['Paid Via UPI', '₹999'],
    });
    expect(parseSwiggyDelivered(html, emailDate)).toMatchObject({ ok: false, reason: 'sum_mismatch' });
  });

  it('accepts a bill with no charges section', () => {
    const html = billHtml({ items: [['Tea x1', '₹30']], total: ['Paid Via UPI', '₹30'] });
    const r = parseSwiggyDelivered(html, emailDate);
    expect(r.ok).toBe(true);
  });

  it('treats a positive discount line as a deduction', () => {
    const html = billHtml({
      items: [['Pasta x1', '₹300']],
      charges: [['Coupon discount', '₹50'], ['Taxes', '₹15']],
      total: ['Paid Via UPI', '₹265'],
    });
    const r = parseSwiggyDelivered(html, emailDate);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.charges[0].amount).toBe(-50);
  });

  it('falls back to unit-price reading when the line total interpretation does not reconcile', () => {
    // 2 x ₹100 printed as the unit price; total is 200 + 10 tax.
    const html = billHtml({
      items: [['Samosa x2', '₹100']],
      charges: [['Taxes', '₹10']],
      total: ['Paid Via UPI', '₹210'],
    });
    const r = parseSwiggyDelivered(html, emailDate);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.items[0].price).toBe(200);
  });
});

describe('helpers', () => {
  it('parses amounts', () => {
    expect(parseAmount('₹1,234.50')).toBe(1234.5);
    expect(parseAmount('FREE')).toBe(0);
    expect(parseAmount('-₹20')).toBe(-20);
    expect(parseAmount('abc')).toBeNull();
  });

  it('dates journey times in IST using the email year', () => {
    expect(parseJourneyTime('Oct 15, 3:15 PM', emailDate)?.toISOString()).toBe('2026-10-15T09:45:00.000Z');
    expect(parseJourneyTime('Oct 15, 12:05 AM', emailDate)?.toISOString()).toBe('2026-10-14T18:35:00.000Z');
  });

  it('does not date a December journey in the future when the email arrives in January', () => {
    const jan1 = new Date('2027-01-01T01:00:00Z');
    expect(parseJourneyTime('Dec 31, 11:30 PM', jan1)?.toISOString()).toBe('2026-12-31T18:00:00.000Z');
  });

  it('reconcileBill returns null when nothing adds up', () => {
    expect(reconcileBill({ items: [{ name: 'a', qty: 1, price: 10 }], charges: [], total: 50 })).toBeNull();
  });
});
