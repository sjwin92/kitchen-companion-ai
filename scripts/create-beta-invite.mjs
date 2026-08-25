import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2]?.trim().toLowerCase();
const days = Number(process.argv[3] ?? 7);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email) throw new Error('Usage: npm run beta:invite -- person@example.com [days]');
if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('Expiry days must be an integer from 1 to 30');
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Keep the service-role key server-only.');
}

const code = `KC-${randomBytes(9).toString('base64url').toUpperCase()}`;
const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { error } = await supabase.rpc('create_beta_invite', {
  p_email: email,
  p_code: code,
  p_expires_at: expiresAt,
});
if (error) throw error;

console.log(`Invite for ${email}`);
console.log(`Code: ${code}`);
console.log(`Expires: ${expiresAt}`);
console.log('The database stores only the code hash. Share the code through a private channel.');
