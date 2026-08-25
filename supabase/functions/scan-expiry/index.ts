import { z } from "npm:zod@3.25.76";
import { authenticateAndQuota, errorResponse, guardRequest, json, structuredResponse, validateImageDataUrl } from "../_shared/kitchen-ai.ts";

const resultSchema = z.object({
  results: z.array(z.object({
    itemName: z.string().min(1).max(120),
    expiryDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
    dateType: z.enum(["use_by", "best_before", "expiry", "unknown"]),
    confidence: z.number().min(0).max(1),
  })).max(40),
});
const jsonSchema = {
  type: "object", additionalProperties: false, required: ["results"],
  properties: {
    results: {
      type: "array", maxItems: 40, items: {
        type: "object", additionalProperties: false,
        required: ["itemName", "expiryDate", "dateType", "confidence"],
        properties: {
          itemName: { type: "string" },
          expiryDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          dateType: { type: "string", enum: ["use_by", "best_before", "expiry", "unknown"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  const guarded = guardRequest(req);
  if (guarded) return guarded;
  try {
    const { user } = await authenticateAndQuota(req, "vision");
    const body = await req.json() as Record<string, unknown>;
    const imageDataUrl = validateImageDataUrl(body.imageBase64);
    const itemNames = Array.isArray(body.itemNames)
      ? body.itemNames.filter((name): name is string => typeof name === "string").slice(0, 80)
      : [];
    const parsed = resultSchema.parse(await structuredResponse({
      userId: user.id,
      model: "gpt-5.6-terra",
      instructions: "You extract only clearly legible food date labels. Never invent or infer an unreadable date.",
      prompt: JSON.stringify({
        task: "Extract visible use-by, best-before, or expiry dates and match them to products.",
        known_item_names: itemNames,
        today: new Date().toISOString().slice(0, 10),
        rules: [
          "Return dates in YYYY-MM-DD.",
          "For month/year labels without a day, use the final calendar day of that month.",
          "Omit any unreadable or ambiguous date.",
        ],
      }),
      imageDataUrl,
      schemaName: "expiry_scan",
      schema: jsonSchema,
      maxOutputTokens: 1200,
    }));
    const validResults = parsed.results.filter((result) => !Number.isNaN(Date.parse(`${result.expiryDate}T00:00:00Z`)));
    return json(req, { results: validResults });
  } catch (error) {
    return errorResponse(req, error, "Expiry scan failed");
  }
});
