import { z } from "zod";
import type { ActionPayload, ActionType } from "./types";

export const refundSchema = z.object({
  orderId: z.string().min(1),
  customerRef: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: z.literal("INR"),
  reason: z.string().min(1),
});
export const messageSchema = z.object({
  channel: z.enum(["whatsapp", "email"]),
  toMasked: z.string().min(1),
  templateId: z.string().min(1),
  body: z.string().min(1),
});
export const addressSchema = z.object({
  orderId: z.string().min(1),
  currentAddress: z.string().min(1),
  newAddress: z.string().min(1),
});
export const exportSchema = z.object({
  reportType: z.enum(["customer-orders", "refunds"]),
  rowCount: z.number().int().positive(),
  includesPII: z.boolean(),
  deliverTo: z.string().min(1),
});

export function validatePayload(type: ActionType, payload: unknown): ActionPayload {
  if (type === "refund.issue") return refundSchema.parse(payload);

  if (type === "message.send") return messageSchema.parse(payload);

  if (type === "order.address.change") return addressSchema.parse(payload);

  return exportSchema.parse(payload);
}

export function summarizeAction(type: ActionType, payload: ActionPayload): string {
  if (type === "refund.issue") {
    const item = refundSchema.parse(payload);
    return `Refund ₹${(item.amountMinor / 100).toLocaleString("en-IN")} for ${item.orderId}`;
  }

  if (type === "message.send") {
    const item = messageSchema.parse(payload);
    return `Send ${item.channel} message to ${item.toMasked}`;
  }

  if (type === "order.address.change") {
    const item = addressSchema.parse(payload);
    return `Change delivery address for ${item.orderId}`;
  }

  const item = exportSchema.parse(payload);

  return `Export ${item.rowCount} ${item.reportType} rows to ${item.deliverTo}`;
}
