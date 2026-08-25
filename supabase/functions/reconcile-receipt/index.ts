import { z } from "npm:zod@3.25.76";
import { authenticateAndQuota, errorResponse, guardRequest, json, structuredResponse, validateImageDataUrl } from "../_shared/kitchen-ai.ts";

const resultSchema = z.object({
  retailer: z.string().max(120),
  total: z.number().min(0).max(100000),
  receipt_date: z.string().max(10),
  items: z.array(z.object({
    name: z.string().min(1).max(160),
    price: z.number().min(0).max(100000),
    quantity: z.number().min(0).max(10000),
    confidence: z.number().min(0).max(1),
  })).max(200),
});
const jsonSchema = {
  type: "object", additionalProperties: false, required: ["retailer", "total", "receipt_date", "items"],
  properties: {
    retailer: { type: "string" }, total: { type: "number", minimum: 0, maximum: 100000 }, receipt_date: { type: "string" },
    items: { type: "array", maxItems: 200, items: {
      type: "object", additionalProperties: false, required: ["name", "price", "quantity", "confidence"],
      properties: {
        name: { type: "string" }, price: { type: "number", minimum: 0, maximum: 100000 },
        quantity: { type: "number", minimum: 0, maximum: 10000 }, confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    } },
  },
};

Deno.serve(async (req) => {
  const guarded = guardRequest(req);
  if (guarded) return guarded;
  try {
    const { user } = await authenticateAndQuota(req, "vision");
    const body = await req.json() as Record<string, unknown>;
    const imageDataUrl = validateImageDataUrl(body.imageBase64);
    const parsed = resultSchema.parse(await structuredResponse({
      userId: user.id,
      model: "gpt-5.6-terra",
      instructions: "You are a conservative UK grocery receipt parser. Transcribe only legible purchase information.",
      prompt: JSON.stringify({
        task: "Extract grocery line items, final GBP total, retailer, and receipt date.",
        rules: [
          "Clean common retailer abbreviations without inventing a different product.",
          "Skip totals, subtotals, VAT, savings, discounts, store details, and payment method from items.",
          "Use 0 for an illegible individual price or total.",
          "Use an empty string for unknown retailer or receipt date. Dates use YYYY-MM-DD.",
        ],
      }),
      imageDataUrl,
      schemaName: "receipt_reconciliation",
      schema: jsonSchema,
      maxOutputTokens: 2600,
    }));
    return json(req, {
      retailer: parsed.retailer || null,
      total: parsed.total,
      receipt_date: parsed.receipt_date || null,
      items: parsed.items,
      provenance: "vision_estimate",
    });
  } catch (error) {
    return errorResponse(req, error, "Receipt reconciliation failed");
  }
});
