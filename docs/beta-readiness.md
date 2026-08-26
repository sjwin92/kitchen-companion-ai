# Kitchen Companion beta readiness

Updated: 26 August 2026

## Automated work complete

- Premium navigation, dashboard, calorie visibility and recipe-card art direction are implemented.
- Password-recovery redirects preserve the GitHub Pages base path.
- Privacy, beta terms and support pages are available before sign-in and from Settings.
- Existing profiles remain authoritative after sign-in; onboarding is only shown when `onboarding_complete` is false.
- Dietary exclusions are applied to onboarding, settings, catalogue search and recommendations before scoring.
- Normal discovery, search and planning use approved Supabase catalogue recipes. Legacy providers only resolve previously saved records.
- The 12 bootstrap recipes are private drafts. Drafts cannot claim a verification tier; approval creates an immutable version snapshot.
- Basket comparison accepts proved quantities and units, falls back safely to name-only comparison, and never writes purchases to inventory before confirmation.
- AI capture is provider-neutral, confirmation-first and protected by daily quotas plus a £7 vision / £2 text / £1 reserve monthly allocation and £10 hard ceiling.
- All public tables have RLS. Anonymous recommendation access is revoked and admin publication functions contain explicit administrator checks.
- Supabase migrations and the updated `generate-recipe` and `compare-prices` Edge Functions are deployed to project `fwtbsjzgiiwgcavtohoc`.
- The isolated release check passes 41 Vitest tests, TypeScript, the production build and three Chromium journeys. ESLint has no errors (legacy warnings remain).

## Founder/manual release gates

These items require a human account, legal judgement, content evidence or billing decision. They must not be marked complete by automation.

1. **Recover the founder account.** Use **Forgot password** on the sign-in screen, open the email, choose a new unique password, then sign in and confirm the existing profile and preferences reappear. Do not reuse any password previously pasted into a chat.
2. **Deploy the free pricing service.** In Render, create a Blueprint from `sjwin92/FASTAPI` using its committed `render.yaml`. Keep the free plan, `DATABASE_REQUIRED=false` and restricted sources disabled. Generate a long random `BASKET_API_KEY`. Copy the resulting HTTPS base URL and key into Supabase Edge Function secrets as `PRICING_API_URL` and `PRICING_API_KEY`; leave the default Bearer header settings.
3. **Configure AI providers only when billing is capped.** Add `GEMINI_API_KEY` for user image/text capture and `DEEPSEEK_API_KEY` for non-personal catalogue enrichment. Confirm UK billing and provider-side spending alerts. Leave `AI_OPENAI_FALLBACK_ENABLED=false` unless an emergency fallback is deliberately approved.
4. **Configure public operations.** Set GitHub Actions variables `VITE_SUPPORT_EMAIL` and `VITE_SENTRY_DSN`. Verify Sentry receives a deliberately triggered, redacted test error. Finalise the support response process.
5. **Harden Supabase Auth in the dashboard.** Enable leaked-password protection and at least one suitable MFA option. Confirm the production redirect allow-list contains the GitHub Pages URL and its `/reset-password` path.
6. **Review the 12 starter recipes.** In `/admin/catalogue`, check every quantity, dietary/allergen tag, rights record, nutrition source, instruction and media right. Test-cook where the draft notes require it. Only then approve a recipe and confirm an immutable version was created. Approve the three books only after their recipes and assets are cleared.
7. **Legal/founder review.** Replace beta placeholders with the final business identity/contact details and obtain appropriate UK privacy/terms review before open invitations.
8. **Creator packs.** Obtain written permission before importing creator recipes or media. Record agreement, recipe-level permission, attribution and media rights. Approve every outreach message before it is sent; no outreach is automated.
9. **Real-device acceptance.** With two separate test accounts, complete: add food → monitor expiry → choose an approved recipe → plan → derive and compare missing items → confirm purchases → record consumption or waste. Include vegan, vegetarian and allergy profiles, a blurry photo, an unreadable date and a failed provider. Confirm no scan changes inventory before confirmation and no account can see another account's data.
10. **Progressive invitation.** Start with five testers. Expand to 25 only after the complete loop passes. Pause invites for data leakage, dietary/allergen failures, unauthorised content, false provenance or budget-cap failures.

## Phase 2 catalogue milestones

- Phase 2.1: approve the 12 existing starter drafts and the three internal books.
- Phase 2.2: reach 100 reviewed recipes and three permissioned creator packs.
- Phase 2 completion: reach 1,000 reviewed recipes and ten permissioned creator packs.

The product can enter a controlled five-person beta before the 1,000-recipe operational milestone, but not before the manual release gates above are satisfied.
