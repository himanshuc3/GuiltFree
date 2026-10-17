import { z } from 'zod';

export const OrderItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().positive(),
  /** Line total in INR, as shown on the bill. */
  price: z.number().nonnegative(),
  kcalPerUnit: z.number().nonnegative().optional(),
  kcalSource: z.enum(['llm', 'mock', 'cache']).optional(),
});

export const ChargeSchema = z.object({
  label: z.string().min(1),
  /** Negative for discounts. */
  amount: z.number(),
});

export const OrderSchema = z.object({
  orderId: z.string().min(1),
  restaurant: z.string().min(1),
  items: z.array(OrderItemSchema).min(1),
  charges: z.array(ChargeSchema),
  total: z.number().nonnegative(),
  paymentMethod: z.string().optional(),
  savings: z.number().nonnegative().optional(),
  restaurantAt: z.string().datetime().optional(),
  /** When the delivery email was sent. This is the instant the order counts against budgets. */
  deliveredAt: z.string().datetime(),
  /** Estimated; undefined until calorie estimation has succeeded. */
  kcalTotal: z.number().nonnegative().optional(),
  parsedBy: z.enum(['rules', 'llm']),
  messageId: z.string().min(1),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;
export type Charge = z.infer<typeof ChargeSchema>;
export type Order = z.infer<typeof OrderSchema>;

export const LimitsSchema = z.object({
  orders: z.number().int().positive().optional(),
  spend: z.number().positive().optional(),
  kcal: z.number().positive().optional(),
});
export type Limits = z.infer<typeof LimitsSchema>;

export const SettingsSchema = z.object({
  limits: z.object({ weekly: LimitsSchema, monthly: LimitsSchema }),
  /** Orders delivered before this instant are ignored (no historical backfill). */
  trackingSince: z.string().datetime(),
});
export type Settings = z.infer<typeof SettingsSchema>;

/** Each provided period replaces the stored one wholesale. */
export const LimitsUpdateSchema = z.object({
  weekly: LimitsSchema.optional(),
  monthly: LimitsSchema.optional(),
});
export type LimitsUpdate = z.infer<typeof LimitsUpdateSchema>;
