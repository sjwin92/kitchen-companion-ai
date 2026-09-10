import { authenticate, errorResponse, guardRequest, json } from "../_shared/kitchen-ai.ts";

const EXPORT_TABLES = [
  "profiles",
  "food_items",
  "inventory_events",
  "shopping_list",
  "meal_plans",
  "meal_log",
  "waste_log",
  "favorite_recipes",
  "meal_library",
  "staple_meals",
  "meal_ratings",
  "meal_feedback",
  "meal_slot_settings",
  "recipe_memory",
  "user_recipes",
  "recipe_submissions",
  "recipe_book_access",
  "receipt_reconciliations",
  "user_interactions",
  "notification_preferences",
] as const;

Deno.serve(async (req) => {
  const guarded = guardRequest(req);
  if (guarded) return guarded;

  try {
    const { user, userClient } = await authenticate(req);
    const entries = await Promise.all(EXPORT_TABLES.map(async (table) => {
      const { data, error } = await userClient.from(table).select("*");
      if (error) throw error;
      return [table, data ?? []] as const;
    }));

    const { data: subscriptions, error: subscriptionError } = await userClient
      .from("push_subscriptions")
      .select("id,enabled,created_at,updated_at,last_error");
    if (subscriptionError) throw subscriptionError;

    return json(req, {
      schema_version: 1,
      exported_at: new Date().toISOString(),
      account: { user_id: user.id, email: user.email ?? null },
      data: {
        ...Object.fromEntries(entries),
        push_subscriptions: subscriptions ?? [],
      },
    });
  } catch (error) {
    return errorResponse(req, error, "Account export failed");
  }
});
