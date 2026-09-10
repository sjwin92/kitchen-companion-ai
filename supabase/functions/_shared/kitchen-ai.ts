import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const DEFAULT_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function allowedOrigins() {
  return [...DEFAULT_ORIGINS, ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean)];
}

export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins().includes(origin) ? origin : DEFAULT_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

export function guardRequest(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins().includes(origin)) return json(req, { error: "Origin not allowed" }, 403);
  return null;
}

export async function authenticate(req: Request): Promise<{
  user: User;
  userClient: SupabaseClient;
  serviceClient: SupabaseClient;
}> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Server configuration is incomplete");
  }
  const authorization = req.headers.get("authorization");
  if (!authorization) throw new HttpError(401, "Authentication required");
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new HttpError(401, "Authentication required");
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  return { user, userClient, serviceClient };
}

export async function consumeQuota(serviceClient: SupabaseClient, userId: string, usageKind: "vision" | "text" | "image") {
  const { data: allowed, error: quotaError } = await serviceClient.rpc("consume_ai_quota", {
    p_user_id: userId,
    p_usage_kind: usageKind,
  });
  if (quotaError) throw quotaError;
  if (!allowed) throw new HttpError(429, `Daily ${usageKind} AI limit reached`);
}

export async function authenticateAndQuota(req: Request, usageKind: "vision" | "text" | "image") {
  const clients = await authenticate(req);
  await consumeQuota(clients.serviceClient, clients.user.id, usageKind);
  return clients;
}

export type AiCapability =
  | "inventory_vision"
  | "receipt_extraction"
  | "expiry_extraction"
  | "nutrition_estimate"
  | "private_recipe_draft"
  | "catalogue_enrichment";

export type AiProvider = "gemini" | "openai" | "deepseek";

export interface AiUsageSummary {
  inputTokens: number;
  outputTokens: number;
  estimatedCostGbp: number;
  actualCostGbp: number;
}

export interface StructuredAiResult<T = unknown> {
  data: T;
  provider: AiProvider;
  model: string;
  confidence: number | null;
  provenance: "vision_estimate" | "ai_assisted" | "catalogue_enrichment";
  usage: AiUsageSummary;
}

async function safetyIdentifier(userId: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function openAiOutputText(payload: Record<string, unknown>): string | null {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
    }
  }
  return null;
}

function geminiOutputText(payload: Record<string, unknown>): string | null {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const content = (candidate as { content?: { parts?: unknown[] } }).content;
    for (const part of Array.isArray(content?.parts) ? content.parts : []) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

function aiRoute(capability: AiCapability): { provider: AiProvider; model: string } {
  if (capability === "catalogue_enrichment") {
    return { provider: "deepseek", model: Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-v4-flash" };
  }
  return { provider: "gemini", model: Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite" };
}

function configuredNumber(name: string, fallback: number) {
  const parsed = Number(Deno.env.get(name));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function reservationCost(capability: AiCapability) {
  return capability === "private_recipe_draft" || capability === "catalogue_enrichment"
    ? configuredNumber("AI_TEXT_RESERVATION_GBP", 0.006)
    : configuredNumber("AI_VISION_RESERVATION_GBP", 0.003);
}

function actualCostGbp(provider: AiProvider, inputTokens: number, outputTokens: number, reserved: number) {
  const usdToGbp = configuredNumber("AI_USD_TO_GBP", 0.78);
  if (provider === "gemini") {
    const inputRate = configuredNumber("GEMINI_INPUT_USD_PER_MILLION", 0.30);
    const outputRate = configuredNumber("GEMINI_OUTPUT_USD_PER_MILLION", 2.50);
    return ((inputTokens * inputRate + outputTokens * outputRate) / 1_000_000) * usdToGbp;
  }
  if (provider === "deepseek") {
    const inputRate = configuredNumber("DEEPSEEK_INPUT_USD_PER_MILLION", 0.28);
    const outputRate = configuredNumber("DEEPSEEK_OUTPUT_USD_PER_MILLION", 0.56);
    return ((inputTokens * inputRate + outputTokens * outputRate) / 1_000_000) * usdToGbp;
  }
  return reserved;
}

function provenanceFor(capability: AiCapability): StructuredAiResult["provenance"] {
  if (capability === "catalogue_enrichment") return "catalogue_enrichment";
  if (capability === "private_recipe_draft") return "ai_assisted";
  return "vision_estimate";
}

async function reserveUsage(
  serviceClient: SupabaseClient,
  userId: string,
  capability: AiCapability,
  provider: AiProvider,
  model: string,
  estimatedCostGbp: number,
) {
  const { data, error } = await serviceClient.rpc("reserve_ai_budget", {
    p_user_id: userId,
    p_capability: capability,
    p_provider: provider,
    p_model: model,
    p_estimated_cost_gbp: estimatedCostGbp,
  });
  if (error) {
    const message = error.message.includes("budget") || error.message.includes("allowance")
      ? error.message
      : "AI budget could not be checked";
    throw new HttpError(429, message);
  }
  return String(data);
}

async function completeUsage(
  serviceClient: SupabaseClient,
  eventId: string,
  status: "succeeded" | "failed" | "uncertain",
  usage: { inputTokens?: number; outputTokens?: number; actualCostGbp?: number; requestId?: string | null; errorCode?: string | null },
) {
  const { error } = await serviceClient.rpc("complete_ai_usage", {
    p_event_id: eventId,
    p_status: status,
    p_input_tokens: usage.inputTokens ?? 0,
    p_output_tokens: usage.outputTokens ?? 0,
    p_actual_cost_gbp: usage.actualCostGbp ?? null,
    p_provider_request_id: usage.requestId ?? null,
    p_error_code: usage.errorCode ?? null,
  });
  if (error) console.error("AI usage ledger completion failed", { eventId, status, message: error.message });
}

export function validateImageDataUrl(value: unknown) {
  if (typeof value !== "string") throw new HttpError(400, "No image provided");
  if (!/^data:image\/(jpeg|png|webp);base64,/i.test(value)) throw new HttpError(415, "Unsupported image type");
  if (value.length > 14_000_000) throw new HttpError(413, "Image is too large");
  return value;
}

export async function structuredResponse(options: {
  userId: string;
  serviceClient: SupabaseClient;
  capability: AiCapability;
  instructions: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  imageDataUrl?: string;
  maxOutputTokens?: number;
}): Promise<StructuredAiResult> {
  const preferred = aiRoute(options.capability);
  const fallbackEnabled = Deno.env.get("AI_OPENAI_FALLBACK_ENABLED") === "true";
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const deepSeekKey = Deno.env.get("DEEPSEEK_API_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  let provider = preferred.provider;
  let model = preferred.model;
  if ((provider === "gemini" && !geminiKey) || (provider === "deepseek" && !deepSeekKey)) {
    if (!fallbackEnabled || !openAiKey) throw new HttpError(503, "AI capture is temporarily unavailable; use manual entry instead");
    provider = "openai";
    model = options.imageDataUrl ? "gpt-5.6-terra" : "gpt-5.6-luna";
  }

  const estimatedCostGbp = reservationCost(options.capability);
  const eventId = await reserveUsage(options.serviceClient, options.userId, options.capability, provider, model, estimatedCostGbp);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response | null = null;
  let requestStarted = false;
  try {
    if (provider === "gemini") {
      const parts: Array<Record<string, unknown>> = [{ text: `${options.instructions}\n\n${options.prompt}` }];
      if (options.imageDataUrl) {
        const match = options.imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
        if (!match) throw new HttpError(415, "Unsupported image type");
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
      requestStarted = true;
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: controller.signal,
        headers: { "x-goog-api-key": geminiKey!, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: options.schema,
            maxOutputTokens: options.maxOutputTokens ?? 1800,
            thinkingConfig: { thinkingLevel: "MINIMAL" },
          },
        }),
      });
    } else if (provider === "deepseek") {
      requestStarted = true;
      response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${deepSeekKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: options.instructions },
            { role: "user", content: options.prompt },
          ],
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          max_tokens: options.maxOutputTokens ?? 1800,
        }),
      });
    } else {
      const content: Array<Record<string, unknown>> = [{ type: "input_text", text: options.prompt }];
      if (options.imageDataUrl) content.push({ type: "input_image", image_url: options.imageDataUrl, detail: "high" });
      requestStarted = true;
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          store: false,
          safety_identifier: await safetyIdentifier(options.userId),
          instructions: options.instructions,
          input: [{ role: "user", content }],
          text: { format: { type: "json_schema", name: options.schemaName, strict: true, schema: options.schema } },
          max_output_tokens: options.maxOutputTokens ?? 1800,
        }),
      });
    }
  } catch (error) {
    await completeUsage(options.serviceClient, eventId, requestStarted ? "uncertain" : "failed", {
      errorCode: error instanceof Error ? error.name : "request_failed",
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response) throw new Error("AI request did not start");
  if (!response.ok) {
    const providerError = await response.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
    const errorCode = providerError.error?.code ?? providerError.error?.type ?? "unknown";
    await completeUsage(options.serviceClient, eventId, "failed", { requestId: response.headers.get("x-request-id") ?? response.headers.get("x-goog-request-id"), errorCode });
    console.error("AI request failed", { provider, status: response.status, errorCode, schema: options.schemaName });
    if (errorCode === "credit_balance_exhausted" || errorCode === "insufficient_quota") {
      throw new HttpError(503, "AI features are temporarily unavailable");
    }
    if (response.status === 429) throw new HttpError(429, "AI is busy. Try again shortly.");
    throw new Error("AI request failed");
  }
  let payload: Record<string, unknown>;
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch (error) {
    await completeUsage(options.serviceClient, eventId, "uncertain", { errorCode: "invalid_provider_response" });
    throw error;
  }
  const text = provider === "gemini"
    ? geminiOutputText(payload)
    : provider === "deepseek"
    ? ((payload.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content ?? null)
    : openAiOutputText(payload);
  if (!text) {
    await completeUsage(options.serviceClient, eventId, "uncertain", { errorCode: "empty_structured_output" });
    throw new Error("AI returned no structured result");
  }
  const usageMetadata = (payload.usageMetadata ?? payload.usage ?? {}) as Record<string, unknown>;
  const inputTokens = Number(usageMetadata.promptTokenCount ?? usageMetadata.input_tokens ?? usageMetadata.prompt_tokens ?? 0);
  const outputTokens = Number(usageMetadata.candidatesTokenCount ?? usageMetadata.output_tokens ?? usageMetadata.completion_tokens ?? 0);
  const costGbp = actualCostGbp(provider, inputTokens, outputTokens, estimatedCostGbp);
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch (error) {
    await completeUsage(options.serviceClient, eventId, "uncertain", { errorCode: "invalid_json" });
    throw error;
  }
  await completeUsage(options.serviceClient, eventId, "succeeded", {
    inputTokens,
    outputTokens,
    actualCostGbp: costGbp,
    requestId: response.headers.get("x-request-id") ?? response.headers.get("x-goog-request-id"),
  });
  const confidence = data && typeof data === "object" && typeof (data as { confidence?: unknown }).confidence === "number"
    ? Math.max(0, Math.min(1, (data as { confidence: number }).confidence))
    : null;
  return {
    data,
    provider,
    model,
    confidence,
    provenance: provenanceFor(options.capability),
    usage: { inputTokens, outputTokens, estimatedCostGbp, actualCostGbp: costGbp },
  };
}

export function errorResponse(req: Request, error: unknown, fallback: string) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error && error.name === "AbortError"
    ? "Request timed out. Try a clearer photo."
    : error instanceof Error
    ? error.message
    : fallback;
  console.error(fallback, { message, status });
  return json(req, { error: message }, status);
}
