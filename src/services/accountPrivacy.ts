import { supabase } from '@/integrations/supabase/client';

export async function downloadAccountExport() {
  const { data: payload, error } = await supabase.functions.invoke('account-export', { body: {} });
  if (error || !payload?.data || payload.schema_version !== 1) {
    throw new Error('Could not prepare your account export');
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `kitchen-companion-export-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function deleteAccount() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw error;
  if (!data?.deleted) throw new Error('Account deletion was not confirmed');
  await supabase.auth.signOut({ scope: 'local' });
  if (user?.id) localStorage.removeItem(`mealplan-draft:${user.id}`);
  localStorage.removeItem('theme');
}
