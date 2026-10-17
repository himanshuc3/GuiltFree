import * as cheerio from 'cheerio';
import { istParts, istToDate, type Charge, type Order } from '@guiltfree/shared';

export interface BillItem {
  name: string;
  qty: number;
  /** Line total as printed on the bill. */
  price: number;
}

export interface ParsedBill {
  items: BillItem[];
  charges: Charge[];
  total: number;
  paymentMethod?: string;
}

export interface OrderMeta {
  orderId: string;
  restaurant: string;
  restaurantAt?: string;
  savings?: number;
}

export type ParsedOrder = Omit<Order, 'messageId' | 'kcalTotal'>;

export type ParseResult =
  | { ok: true; order: ParsedOrder }
  | {
      ok: false;
      reason: 'not_a_swiggy_bill' | 'layout_unrecognized' | 'sum_mismatch';
      /** Present when the order id and restaurant could be read, so an LLM can still extract the bill. */
      meta?: OrderMeta;
      /** Text of the bill table only. It contains no names or addresses. */
      billText?: string;
    };

const TIME_RE = /^[A-Za-z]{3} \d{1,2}, \d{1,2}:\d{2} ?[AP]M$/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DISCOUNT_RE = /discount|coupon|savings|offer|cashback/i;
/** Printed amounts are rounded to the rupee; allow that much slack. */
const SUM_TOLERANCE = 1.01;

export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (/^free$/i.test(t)) return 0;
  const m = /^(-)?\s*₹?\s*(-)?\s*([\d,]+(?:\.\d+)?)$/.exec(t);
  if (!m) return null;
  const n = Number(m[3].replace(/,/g, ''));
  return m[1] || m[2] ? -n : n;
}

/** Parses "Oct 15, 3:15 PM" (IST, no year). The year comes from the email date. */
export function parseJourneyTime(text: string, emailDate: Date): Date | null {
  const m = /^([A-Za-z]{3}) (\d{1,2}), (\d{1,2}):(\d{2}) ?([AP]M)$/i.exec(text.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  const hour = (Number(m[3]) % 12) + (m[5].toUpperCase() === 'PM' ? 12 : 0);
  const at = (year: number) => istToDate(year, month, Number(m[2]), hour, Number(m[4]));
  let d = at(istParts(emailDate).year);
  // A December order delivered on 1 Jan must not be dated in the future.
  if (d.getTime() > emailDate.getTime() + 36 * 3600 * 1000) d = at(istParts(emailDate).year - 1);
  return d;
}

function splitItemLabel(label: string): { name: string; qty: number } {
  const m = /^(.*\S)\s+x\s*(\d+)$/i.exec(label.trim());
  return m ? { name: m[1], qty: Number(m[2]) } : { name: label.trim(), qty: 1 };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Items plus charges must add up to the total. For qty > 1 the printed amount may be either the
 * line total or the unit price; try both and keep whichever reconciles. Returns null when neither does.
 */
export function reconcileBill(bill: ParsedBill): ParsedBill | null {
  const chargeSum = bill.charges.reduce((s, c) => s + c.amount, 0);
  const matches = (items: BillItem[]) =>
    Math.abs(items.reduce((s, i) => s + i.price, 0) + chargeSum - bill.total) <= SUM_TOLERANCE;

  if (matches(bill.items)) return bill;
  if (bill.items.some((i) => i.qty > 1)) {
    const asUnit = bill.items.map((i) => ({ ...i, price: round2(i.price * i.qty) }));
    if (matches(asUnit)) return { ...bill, items: asUnit };
  }
  return null;
}

function extractMeta($: cheerio.CheerioAPI, emailDate: Date): OrderMeta | null {
  const orderId = /Order ID:\s*(\d+)/.exec($('body').text())?.[1];
  const anchors = $('p').filter((_, el) => TIME_RE.test($(el).text().trim()));
  if (!orderId || anchors.length === 0) return null;

  // Each journey stop is a div of three <p>: name, address, time. The first stop is the restaurant.
  const stop = $(anchors.get(0)).parent().children('p');
  const restaurant = stop.eq(0).text().trim();
  if (!restaurant) return null;

  const at = parseJourneyTime($(anchors.get(0)).text(), emailDate);
  const saved = /₹\s*([\d.,]+)\s+saved on this order/i.exec($('body').text());
  return {
    orderId,
    restaurant,
    restaurantAt: at?.toISOString(),
    savings: saved ? Number(saved[1].replace(/,/g, '')) : undefined,
  };
}

function findBillTable($: cheerio.CheerioAPI) {
  const header = $('div, td, p')
    .filter((_, el) => $(el).children().length === 0 && $(el).text().trim() === 'BILL DETAILS')
    .first();
  return header.length ? header.closest('table') : null;
}

type Row = { label: string; amount: number };

/** Splits the bill table into sections separated by empty divider rows. Null if any row is unexpected. */
function readSections($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): Row[][] | null {
  const sections: Row[][] = [[]];
  for (const tr of table.children('tbody').children('tr').toArray()) {
    const cells = $(tr).children('td');
    const text = $(tr).text().replace(/\s+/g, ' ').trim();
    if (text === 'BILL DETAILS') continue;
    if (text === '') {
      sections.push([]);
      continue;
    }
    if (cells.length !== 3) return null; // e.g. the multi-restaurant layout's group headers
    const label = cells.eq(0).text().replace(/\s+/g, ' ').trim();
    const amount = parseAmount(cells.eq(2).text());
    if (!label || amount === null) return null;
    sections[sections.length - 1].push({ label, amount });
  }
  return sections.filter((s) => s.length > 0);
}

export function parseSwiggyDelivered(html: string, emailDate: Date): ParseResult {
  const $ = cheerio.load(html);
  const table = findBillTable($);
  const meta = extractMeta($, emailDate);
  if (!table || !table.length) return { ok: false, reason: 'not_a_swiggy_bill' };

  const billText = table.text().replace(/\s+/g, ' ').trim();
  const fail = (reason: 'layout_unrecognized' | 'sum_mismatch') => ({
    ok: false as const,
    reason,
    meta: meta ?? undefined,
    billText,
  });
  if (!meta) return fail('layout_unrecognized');

  const sections = readSections($, table);
  // items | [charges] | total
  if (!sections || sections.length < 2 || sections.length > 3) return fail('layout_unrecognized');
  const totalRows = sections[sections.length - 1];
  if (totalRows.length !== 1) return fail('layout_unrecognized');

  const items: BillItem[] = sections[0].map((r) => ({ ...splitItemLabel(r.label), price: r.amount }));
  const charges: Charge[] = (sections.length === 3 ? sections[1] : []).map((r) => ({
    label: r.label,
    amount: DISCOUNT_RE.test(r.label) && r.amount > 0 ? -r.amount : r.amount,
  }));
  const totalRow = totalRows[0];
  const paid = /^paid via\s+(.+)$/i.exec(totalRow.label);

  const bill = reconcileBill({
    items,
    charges,
    total: totalRow.amount,
    paymentMethod: paid ? paid[1] : totalRow.label,
  });
  if (!bill) return fail('sum_mismatch');
  return { ok: true, order: buildOrder(meta, bill, emailDate, 'rules') };
}

export function buildOrder(
  meta: OrderMeta,
  bill: ParsedBill,
  emailDate: Date,
  parsedBy: 'rules' | 'llm',
): ParsedOrder {
  return {
    orderId: meta.orderId,
    restaurant: meta.restaurant,
    items: bill.items,
    charges: bill.charges,
    total: bill.total,
    paymentMethod: bill.paymentMethod,
    savings: meta.savings,
    restaurantAt: meta.restaurantAt,
    deliveredAt: emailDate.toISOString(),
    parsedBy,
  };
}
