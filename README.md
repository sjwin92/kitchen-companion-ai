# Kitchen Companion

Kitchen Companion is an invite-only household food app that closes the loop between inventory, expiry, recipe discovery, meal planning, shopping, consumption, nutrition guidance and waste.

The beta is catalogue-first: reviewed recipes and creator recipe books are reused and ranked deterministically. AI is a supporting feature for Nutrition Scan, receipt/storage capture and explicit recipe creation; it is not the product or the default source of every meal.

## Product loop

`Add food → monitor expiry → choose or plan meals → buy missing items → confirm consumption or waste → improve future recommendations`

Recipe books are designed as a future collectable content layer: creators, editions, media links, attribution, versioning and access records exist now. Payments and a marketplace do not.

## Local development

Requirements: Node.js 22+, npm 10+, Supabase CLI 2.109+ and Docker for the local Supabase stack.

1. Copy `.env.example` to `.env.local` and provide the staging project's public Supabase values.
2. Keep `OPENAI_API_KEY` server-only. For deployed Edge Functions, set it with Supabase secrets; never prefix it with `VITE_`.
3. Install and verify:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Start the app with `npm run dev`. Run browser tests with `npm run test:e2e`.

## Supabase environments

Use separate `kitchen-companion-staging` and `kitchen-companion-beta` projects. Do not link or modify the legacy Lovable project.

Each project must:

- apply all migrations;
- enable the Before User Created Auth hook at `pg-functions://postgres/private/hook_require_beta_invite`;
- set `OPENAI_API_KEY` and `ALLOWED_ORIGINS` as Edge Function secrets;
- keep `meal-photos` private and schedule deletion of images whose `meal_log.image_delete_after` has passed;
- use explicit Data API grants and RLS policies from migrations.

## AI defaults

- Nutrition/receipt/storage vision: `gpt-5.6-terra`
- Explicit text recipe assistance: `gpt-5.6-luna`
- Editorial image generation: `gpt-image-2`
- Daily limits: 20 vision, 20 text and 5 image requests per user

Nutrition estimates show ranges, confidence and provenance and require user confirmation. They are guidance, not medical advice.

## Public-beta gates

- 12 original, human-reviewed starter recipes across three useful mini-packs
- cross-user RLS tests and atomic transition tests pass
- typecheck, lint, unit, browser and production build pass
- no critical/high production dependency advisories
- private-image retention and account export/deletion are verified
- staged rollout: 5 users, then 25, then open beta after a 48-hour stability check

Operational guides:

- [`docs/public-beta-runbook.md`](docs/public-beta-runbook.md)
- [`docs/catalogue-operations.md`](docs/catalogue-operations.md)
- [`docs/creator-partner-pilot.md`](docs/creator-partner-pilot.md)
