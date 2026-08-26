import { z } from "npm:zod@3.25.76";
import { authenticate, errorResponse, guardRequest, HttpError, json } from "../_shared/kitchen-ai.ts";

const requestSchema = z.union([
  z.object({
    ingredients: z.array(z.string().trim().min(1).max(120)).min(1).max(40),
  }).strict(),
  z.object({
    items: z.array(z.object({
      name: z.string().trim().min(1).max(120),
      quantity: z.number().finite().positive(),
      unit: z.enum(['g', 'kg', 'ml', 'cl', 'l', 'each']),
    }).strict()).min(1).max(40),
  }).strict(),
]);

const basketItemSchema = z.object({
  ingredient: z.string().min(1).max(120),
  product_name: z.string().min(1).max(240),
  price: z.coerce.number().finite().nonnegative(),
  unit_price: z.coerce.number().finite().nonnegative().nullable().optional().default(null),
  unit: z.string().max(80).nullable().optional().default(null),
  url: z.string().max(2_000).optional().default(""),
  image_url: z.string().max(2_000).nullable().optional().default(null),
}).passthrough();

const adapterErrorSchema = z.object({
  ingredient: z.string().max(120),
  retailer: z.string().max(100),
  code: z.string().max(100),
  message: z.string().max(500),
}).passthrough();

const coverageIssueSchema = z.object({
  ingredient: z.string().max(120),
  code: z.enum(["no_acceptable_variant", "package_size_unknown", "unit_incompatible"]),
  message: z.string().max(500),
  candidate_product_name: z.string().max(240).nullable().optional().default(null),
}).passthrough();

const retailerBasketSchema = z.object({
  retailer: z.string().min(1).max(100),
  retailer_name: z.string().min(1).max(120),
  total: z.coerce.number().finite().nonnegative(),
  items: z.array(basketItemSchema).max(40),
  not_found: z.array(z.string().max(120)).max(40).optional().default([]),
  matched_count: z.coerce.number().int().nonnegative().optional(),
  requested_count: z.coerce.number().int().nonnegative().optional(),
  is_complete: z.boolean().optional().default(false),
  availability: z.enum(["available", "partial", "unavailable"]).optional().default("unavailable"),
  total_is_comparable: z.boolean().optional().default(false),
  errors: z.array(adapterErrorSchema).max(40).optional().default([]),
  calculation_mode: z.enum(["one_pack", "quantity_aware"]).optional().default("one_pack"),
  coverage_issues: z.array(coverageIssueSchema).max(40).optional().default([]),
}).passthrough();

const responseSchema = z.object({
  retailers: z.array(retailerBasketSchema).max(30),
}).passthrough();

function endpointFor(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Pricing service configuration is invalid");
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Pricing service configuration is invalid");
  return parsed.pathname.endsWith('/basket/compare') ? parsed.toString() : `${trimmed}/basket/compare`;
}

function providerHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Accept": "application/json" };
  const apiKey = Deno.env.get("PRICING_API_KEY")?.trim();
  if (!apiKey) return headers;

  const headerName = Deno.env.get("PRICING_API_KEY_HEADER")?.trim() || "Authorization";
  const configuredPrefix = Deno.env.get("PRICING_API_KEY_PREFIX");
  const prefix = configuredPrefix === undefined && headerName.toLowerCase() === "authorization" ? "Bearer" : configuredPrefix?.trim();
  headers[headerName] = prefix ? `${prefix} ${apiKey}` : apiKey;
  return headers;
}

Deno.serve(async (req) => {
  const guarded = guardRequest(req);
  if (guarded) return guarded;

  try {
    await authenticate(req);
    const requestBody = requestSchema.parse(await req.json());
    const seenIngredients = new Set<string>();
    const providerBody = 'ingredients' in requestBody
      ? {
          ingredients: requestBody.ingredients.filter(value => {
            const key = value.toLocaleLowerCase();
            if (seenIngredients.has(key)) return false;
            seenIngredients.add(key);
            return true;
          }),
        }
      : { items: requestBody.items };
    const requestedCount = 'ingredients' in providerBody ? providerBody.ingredients.length : providerBody.items.length;
    const pricingApiUrl = Deno.env.get("PRICING_API_URL") ?? Deno.env.get("VITE_PRICING_API_URL");
    if (!pricingApiUrl) throw new HttpError(503, "Live supermarket prices are temporarily unavailable");

    const controller = new AbortController();
    // Free beta hosting can need extra time for its first request after sleeping.
    const timeout = setTimeout(() => controller.abort(), 70_000);
    let response: Response;
    try {
      response = await fetch(endpointFor(pricingApiUrl), {
        method: "POST",
        signal: controller.signal,
        headers: providerHeaders(),
        body: JSON.stringify(providerBody),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error("Pricing provider request failed", { status: response.status, requestId: response.headers.get("x-request-id") });
      if (response.status === 429) throw new HttpError(429, "Price comparison is busy. Try again shortly.");
      throw new HttpError(502, "Live supermarket prices could not be loaded");
    }

    const result = responseSchema.parse(await response.json());
    const retailers = result.retailers
      .map(basket => ({
        retailer: basket.retailer,
        retailer_name: basket.retailer_name,
        total: basket.total,
        items: basket.items.map(item => ({
          ingredient: item.ingredient,
          product_name: item.product_name,
          price: item.price,
          unit_price: item.unit_price,
          unit: item.unit,
          url: item.url,
          image_url: item.image_url,
        })),
        not_found: basket.not_found,
        matched_count: basket.matched_count ?? basket.items.length,
        requested_count: basket.requested_count ?? requestedCount,
        is_complete: basket.is_complete,
        availability: basket.availability,
        total_is_comparable: basket.total_is_comparable,
        errors: basket.errors,
        calculation_mode: basket.calculation_mode,
        coverage_issues: basket.coverage_issues,
      }))
      .sort((a, b) => {
        if (a.total_is_comparable !== b.total_is_comparable) return a.total_is_comparable ? -1 : 1;
        if (a.total_is_comparable && b.total_is_comparable) return a.total - b.total;
        if (a.items.length === 0 && b.items.length > 0) return 1;
        if (b.items.length === 0 && a.items.length > 0) return -1;
        return b.matched_count - a.matched_count;
      });

    return json(req, { retailers });
  } catch (error) {
    if (error instanceof z.ZodError) return json(req, { error: "Pricing request or provider response was invalid" }, 422);
    if (error instanceof Error && error.name === "AbortError") return json(req, { error: "Price comparison timed out. Try again." }, 504);
    return errorResponse(req, error, "Price comparison failed");
  }
});
