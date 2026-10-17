import { z } from 'zod';
import { extractJson, type LlmClient } from './client';
import { reconcileBill, type ParsedBill } from '../parser/swiggyEmail';

const SYSTEM = `You read the text of a food-delivery bill ("BILL DETAILS" table) and return its contents as JSON only, no prose:
{"items":[{"name":string,"qty":number,"price":number}],"charges":[{"label":string,"amount":number}],"total":number,"paymentMethod":string|null}
- items are the dishes. price is the line amount printed next to the dish, in rupees.
- charges are everything else (packaging, fees, taxes, delivery, discounts). Use a negative amount for discounts. "FREE" is 0.
- total is the final amount paid.
Copy numbers exactly as printed. Do not invent items.`;

const BillSchema = z.object({
  items: z.array(z.object({ name: z.string().min(1), qty: z.number().int().positive(), price: z.number().nonnegative() })).min(1),
  charges: z.array(z.object({ label: z.string().min(1), amount: z.number() })),
  total: z.number().nonnegative(),
  paymentMethod: z.string().nullable().optional(),
});

/**
 * Fallback for layouts the rules parser does not recognise. Only the bill table text is sent, so no
 * names or addresses leave the server. The result must still reconcile with the printed total.
 */
export async function extractBillWithLlm(llm: LlmClient, billText: string): Promise<ParsedBill | null> {
  let parsed;
  try {
    parsed = BillSchema.parse(extractJson(await llm.complete(SYSTEM, billText)));
  } catch {
    return null;
  }
  return reconcileBill({
    items: parsed.items,
    charges: parsed.charges,
    total: parsed.total,
    paymentMethod: parsed.paymentMethod ?? undefined,
  });
}
