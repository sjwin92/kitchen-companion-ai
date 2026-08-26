# Public beta runbook

This runbook is the release gate for a bootstrap beta. Start with five testers, expand to 25, then open the beta link after a 48-hour stability check. Staging and beta remain separate Supabase projects; legacy projects are out of scope.

## 1. Accounts and spend

- Use the Supabase free plan while the beta remains within its limits; do not add paid infrastructure to the critical path.
- Add OpenAI API credit and set a conservative project budget/alert. ChatGPT billing does not fund API usage.
- Create a Sentry project and keep its data collection minimal; no meal photos, prompts, food details or account exports belong in error events.
- Confirm a privacy/contact mailbox to use as the VAPID subject and public support address.

## 2. Staging deployment

1. Create `kitchen-companion-staging` and link the CLI to its project ref.
2. Run `npx supabase db push` and confirm the Before User Created hook is `pg-functions://postgres/private/hook_require_beta_invite`.
3. Generate VAPID keys and set server secrets: `OPENAI_API_KEY`, `ALLOWED_ORIGINS`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
4. Deploy `scan-receipt`, `scan-expiry`, `product-info`, `reconcile-receipt`, `generate-recipe`, `log-meal`, `send-expiry-reminders` and `delete-account`.
5. Deploy the web app to its staging Vercel URL with `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY` and `VITE_SENTRY_DSN`.
6. Set `ALLOWED_ORIGINS` to the exact staging origin. Do not use `*`.
7. Schedule `send-expiry-reminders` hourly using a secret `Authorization: Bearer <service-role-key>` header. The job also removes private meal photos after their 90-day deadline.

## 3. Catalogue and invitations

- Import rights-cleared recipe drafts with `npm run catalogue:import -- /absolute/path/to/catalogue.json`.
- Use `/admin/catalogue` with an account whose `app_metadata.role` is `admin` to record human reviews.
- Launch with three coherent Kitchen Companion mini-packs containing at least 12 total recipes. Do not count a recipe until its exact content version has an approved `recipe_reviews` record.
- Create one-time, email-bound codes with `npm run beta:invite -- person@example.com 7`; share codes privately.
- Creator content requires written permission for recipe text, images and media links. The creator pilot file is a research/approval queue, not authorisation to publish or contact.

## 4. Release rehearsal

For each environment, verify:

- invitation rejects the wrong email/code and succeeds once;
- add manually, barcode lookup and receipt scan create editable food records;
- expiry states and web-push link to the correct “use soon” screen;
- reviewed catalogue suggestions rank pantry/expiry fit and AI appears only as an explicit fallback;
- planning creates dated meals; grocery generation aggregates quantities and increases undersized existing entries;
- checked shopping items move to inventory once;
- eaten/wasted actions update inventory history once;
- Nutrition Scan uploads privately, shows editable ranges/provenance and consumes only confirmed ingredients;
- export downloads expected account tables; deletion removes meal photos and the auth account;
- password reset, mobile navigation, empty/error/loading states and direct route reloads work;
- Sentry receives a synthetic redacted error without user or food data.

Camera permission, notification permission, export download and account deletion require explicit human testing in the deployed HTTPS build. Never click delete on a real beta account as a casual smoke test.

## 5. Rollout and stop conditions

Roll out to 5 internal testers, then 25 invited testers. After 48 stable hours, open the beta link while retaining the ability to pause new invitations. Review feedback and error/AI usage after each stage. Stop invitations for any cross-user data exposure, duplicate consumption/waste transition, broken account deletion, unexpected AI spend, nutrition presented as medical certainty, or unlicensed recipe/media publication.

The beta is ready to open when the complete kitchen loop passes, the 12 starter recipes are genuinely reviewed, and the stop conditions above are clear. A larger catalogue, creator packs, payments and direct retailer baskets are post-launch iterations.
