# Public beta runbook

Kitchen Companion launches as an invite-only beta on Cloudflare Pages. The existing Supabase project is authoritative; local Supabase is the isolated CI environment. Payments, payouts, bulk creator outreach and unrestricted signup are not part of this release.

## Release evidence

Before merging `beta-hardening` into `main`, the required workflow must pass:

- TypeScript, zero-warning ESLint, unit tests and a production dependency audit;
- fresh `supabase db reset` and all pgTAP tests;
- Chromium and mobile WebKit journeys plus axe/keyboard checks;
- exactly 200 catalogue recipes and 200 unique responsive media mappings;
- card WebP files no larger than 120 KB and detail WebP files no larger than 300 KB;
- production build and Cloudflare preview deployment.

Never bypass a failing media, database or browser gate to create a deployment.

## Environment configuration

Client build variables:

- `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`;
- `VITE_PUBLIC_APP_URL`, `VITE_SUPPORT_EMAIL`, `VITE_SENTRY_DSN`;
- optional `VITE_TURNSTILE_SITE_KEY` and `VITE_VAPID_PUBLIC_KEY`.

Edge secrets:

- exact `ALLOWED_ORIGINS` for preview and production;
- optional Gemini/DeepSeek keys and server-configured model/cost variables;
- `AI_OPENAI_FALLBACK_ENABLED=false`;
- optional `PRICING_API_URL`, `PRICING_API_KEY`, `PRICING_TIMEOUT_MS`;
- `REMINDER_CRON_SECRET` and optional VAPID secrets.

The core beta must still work when all optional paid/provider capabilities are disabled.

## Authentication and privacy rehearsal

1. Confirm the canonical Supabase Site URL and preview/production recovery allow-list.
2. Use an email-bound one-time invite and verify the wrong email/code is rejected.
3. Confirm signup, email confirmation, restored preferences and mobile password recovery through production SMTP.
4. Confirm Turnstile has keyboard-accessible retry states before enabling it.
5. Enrol the administrator in TOTP and confirm `/admin/catalogue` requires AAL2.
6. Export a test account and confirm version `1` excludes push endpoint and authentication keys.
7. Delete a disposable account and confirm Auth, relational data, private photos and local state are gone.
8. Confirm the 90-day media cleanup works even when VAPID is absent and records a `maintenance_events` audit.

## Product loop rehearsal

With two isolated accounts, run on desktop and a real mobile device:

`add food → monitor expiry → choose recipe → plan → buy missing items → record consumption/waste → update calories`

Include vegan, vegetarian and allergen profiles; redundant dislikes; barcode confirmation; a failed scan; occupied meal swaps; optional price-provider timeout; and export/deletion isolation. No scanner or purchase flow may write inventory before explicit confirmation.

## Operations and recovery

- Verify Sentry receives a deliberate error with release/environment metadata and no email, food data, prompt or photo.
- Set `SUPABASE_DB_URL` and `BACKUP_AGE_RECIPIENT` for the nightly seven-day encrypted backup.
- Keep the age identity outside GitHub. Decrypt one artifact and validate it with `scripts/verify-backup-restore.sh` before invitations.
- Keep previous Cloudflare deployments available for frontend rollback. Database migrations stay additive; use compensating migrations and capability flags rather than destructive rollback.
- The hourly health workflow checks public routes and, when configured, retention cleanup.

## Rollout and stop conditions

Start with the founder and two isolated accounts, then five testers for 48 hours, then 25 testers for seven stable days. Widen invites only after reviewing errors, auth failures, cleanup audits and AI usage.

Stop invitations immediately for cross-user leakage, dietary/allergen failure, unauthorized media, unconfirmed inventory writes, broken recovery, false provenance, budget-cap bypass, failed backups or unrecoverable data loss.
