import { z } from "npm:zod@3.25.76";
import { authenticateAndQuota, errorResponse, guardRequest, json, structuredResponse, validateImageDataUrl } from "../_shared/kitchen-ai.ts";

const itemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.string().min(1).max(80),
  location: z.enum(["fridge", "freezer", "cupboard"]),
  daysUntilExpiry: z.number().int().min(0).max(3650),
  confidence: z.number().min(0).max(1),
});
const resultSchema = z.object({ items: z.array(itemSchema).max(80) });
const jsonSchema = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: {
    items: {
      type: "array", maxItems: 80, items: {
        type: "object", additionalProperties: false,
        required: ["name", "quantity", "location", "daysUntilExpiry", "confidence"],
        properties: {
          name: { type: "string" }, quantity: { type: "string" },
          location: { type: "string", enum: ["fridge", "freezer", "cupboard"] },
          daysUntilExpiry: { type: "integer", minimum: 0, maximum: 3650 },
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
    const { user, userClient } = await authenticateAndQuota(req, "vision");
    const body = await req.json() as Record<string, unknown>;
    const imageDataUrl = validateImageDataUrl(body.imageBase64);
    const mode = body.mode === "fridge" ? "fridge" : "receipt";
    const forcedLocation = ["fridge", "freezer", "cupboard"].includes(String(body.storageLocation))
      ? String(body.storageLocation)
      : null;
    const { data: profile } = await userClient
      .from("profiles")
      .select("dietary_preferences,allergies")
      .single();
    const prompt = JSON.stringify({
      mode,
      task: mode === "fridge"
        ? "Identify clearly visible food items in this kitchen storage photo."
        : "Extract food purchase lines from this grocery receipt.",
      forced_storage_location: forcedLocation,
      dietary_context_for_avoiding_unsupported_guesses: profile?.dietary_preferences ?? [],
      allergies_for_avoiding_unsupported_guesses: profile?.allergies ?? [],
      rules: [
        "Include only food items visible or legible with reasonable confidence; do not guess.",
        "Use clean common product names and skip store totals, tax, discounts, and non-food lines.",
        "Estimate quantity and storage location. Cupboard is the default for shelf-stable food.",
        "daysUntilExpiry is an estimate unless a clear date is visible.",
        "Return a confidence from 0 to 1 for each identification.",
      ],
    });
    const parsed = resultSchema.parse(await structuredResponse({
      userId: user.id,
      model: "gpt-5.6-terra",
      instructions: "You are Kitchen Companion's conservative inventory scanner. Accuracy is more important than item count.",
      prompt,
      imageDataUrl,
      schemaName: "inventory_scan",
      schema: jsonSchema,
      maxOutputTokens: 2200,
    }));
    const dateAdded = new Date().toISOString().slice(0, 10);
    return json(req, {
      items: parsed.items.map((item) => ({
        ...item,
        location: forcedLocation ?? item.location,
        dateAdded,
        status: item.daysUntilExpiry <= 2 ? "use-today" : item.daysUntilExpiry <= 5 ? "use-soon" : "okay",
        provenance: mode === "receipt" ? "receipt_estimate" : "vision_estimate",
      })),
    });
  } catch (error) {
    return errorResponse(req, error, "Inventory scan failed");
  }
});
