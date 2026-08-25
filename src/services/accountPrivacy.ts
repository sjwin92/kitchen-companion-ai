import { supabase } from '@/integrations/supabase/client';

const EXPORT_TABLES = [
  'profiles',
  'food_items',
  'inventory_events',
  'shopping_list',
  'meal_plans',
  'meal_log',
  'waste_log',
  'favorite_recipes',
  'meal_library',
  'staple_meals',
  'meal_ratings',
  'meal_feedback',
  'meal_slot_settings',
  'recipe_memory',
  'user_recipes',
  'recipe_submissions',
  'recipe_book_access',
  'receipt_reconciliations',
  'user_interactions',
  'push_subscriptions',
  'notification_preferences',
] as const;

export async function downloadAccountExport(userId: string, email?: string) {
  const entries = await Promise.all(EXPORT_TABLES.map(async (table) => {
    const { data, error } = await (supabase as any).from(table).select('*');
    if (error) throw new Error(`Could not export ${table}`);
    return [table, data ?? []] as const;
  }));

  const payload = {
    exported_at: new Date().toISOString(),
    account: { user_id: userId, email: email ?? null },
    data: Object.fromEntries(entries),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `kitchen-companion-export-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function deleteAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw error;
  if (!data?.deleted) throw new Error('Account deletion was not confirmed');
}
