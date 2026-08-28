# Kitchen Companion production-beta readiness

Updated: 28 August 2026

## Automated foundation

- Cloudflare Pages is the canonical host and deployment is gated by TypeScript, zero-warning lint, unit tests, the 200-recipe catalogue check, the media manifest, desktop/mobile Playwright, a fresh Supabase reset and pgTAP.
- The complete public catalogue is 200 founder-approved `editorial_reviewed` recipes. Approval does not claim that a recipe was test-kitchen verified.
- Public discovery and planning use Supabase catalogue recipes. Dietary and allergen conflicts are removed before ranking; AI drafting is a private, optional fallback.
- Authentication remains invite-only. Password recovery returns to the requesting deployment and optional Turnstile support is wired into sign-in, signup and recovery.
- Administrator catalogue operations require TOTP AAL2 and execute only through the authenticated Edge boundary.
- Account export is a versioned Edge response and omits push endpoint/key material. Account deletion removes private meal photos, revokes the session and deletes the Auth user before reporting success.
- Meal-photo retention runs independently of push notifications and writes a server-only cleanup audit.
- AI spend counts `reserved`, `succeeded` and `uncertain` requests. Vision is capped at £7, text at £2, private drafting stops at £9 total and no reservation may pass £10.
- Pricing is optional, schema-validated and timeout-bounded. Manual shopping continues when the free FASTAPI deployment is asleep or unavailable.
- Security headers, responsive recipe WebP variants, image dimensions, lazy loading, route-focus restoration and AA contrast checks are in place.
- A nightly encrypted logical-backup workflow, hourly route/retention health check and a local restore-verification script are committed.
- A completely fresh local Supabase database builds all 200 recipes and passes 76 pgTAP checks.

## Release-blocking work still in progress

- The media gate now verifies exactly 200 unique, visually reviewed recipe artworks with original/card/detail assets. Every commissioned image records AI-art provenance, remains `editorial_reviewed`, and is checked for title, ingredient and dietary consistency; no artwork implies test-kitchen verification.
- The broader real-backend Playwright loop still needs authenticated test-account fixtures for shopping, consumption/waste, calorie updates, export and deletion. The current suite covers public auth/recovery, navigation, mobile overflow, keyboard access and axe checks.

## Founder/dashboard gates

These require an account, external credential, legal decision or real device and cannot be completed safely from repository code alone.

1. Set Supabase Auth Site URL to `https://kitchen-companion-beta.pages.dev` and retain the branch preview plus both `/reset-password` URLs in the redirect allow-list.
2. Create a free Cloudflare Turnstile widget. Set `VITE_TURNSTILE_SITE_KEY` in GitHub/Cloudflare and its secret in Supabase Auth CAPTCHA settings; test accessible retry on mobile and desktop.
3. Configure Resend SMTP and a verified sender/domain in Supabase. The built-in Supabase mailer is not suitable for public beta delivery.
4. Set Sentry DSN/release variables and verify one deliberate redacted error in preview and production.
5. Store `SUPABASE_DB_URL` and an age public recipient as GitHub secrets. Keep the age private recovery key outside GitHub, download one backup and run `scripts/verify-backup-restore.sh` before invitations.
6. Enable TOTP for the founder administrator. Supabase leaked-password protection is a paid-plan feature; on the free plan retain the app's stronger password rules and Turnstile, and reconsider the dashboard feature only if the plan changes.
7. Confirm final UK privacy/terms wording, legal identity and public support address.
8. Run the real-device acceptance loop with two isolated accounts: add food → expiry → recipe → plan → missing shopping → purchase → consume/waste → calories. Include vegan, vegetarian, allergy, barcode and provider-failure paths.
9. Keep creator packs private until written recipe and media permission is recorded. Payments, payouts and automated outreach remain Phase 3.

## Rollout

Use the founder plus two isolated test accounts, then five invited testers for 48 hours, then 25 testers for seven stable days. Pause invitations for cross-user leakage, dietary/allergen failures, unauthorized content, inventory writes without confirmation, broken recovery, false provenance, budget bypass or unrecoverable loss.
