# Bootstrap beta checklist

The beta promise is one complete household loop:

`Add food → monitor expiry → choose a reviewed recipe → plan it → buy missing food → confirm eating or waste`

## Automated gates

- [x] TypeScript compilation passes.
- [x] Dietary rules remove redundant dislikes and hard-filter incompatible recipes.
- [x] Catalogue recipes use structured ingredients for pantry matching and shopping derivation.
- [x] AI recipe fallback saves one private `user_recipes` row rather than duplicating a legacy meal.
- [x] Planned-meal confirmation writes calories, inventory transitions and plan status atomically.
- [x] A partial unique index prevents a planned meal being confirmed twice.
- [x] Legacy meal-memory sharing is disabled; discoverability requires editorial approval.
- [x] Three four-recipe starter packs pass offline structural validation.
- [x] Full typecheck, lint, unit, production-build, dependency-audit and Chromium browser suites pass in [GitHub Actions run 32976853048](https://github.com/sjwin92/kitchen-companion-ai/actions/runs/32976853048).
- [ ] Database pgTAP suite passes against a fresh local Supabase reset.
- [ ] Supabase security/performance advisors have no release-blocking findings.

The remaining database gates require a new Kitchen Companion staging project. The connected Supabase account currently exposes only unrelated projects, and the local Docker daemon is not running, so no legacy or unrelated database has been modified.

## Human gates

- [ ] Test-cook all 12 starter recipes.
- [ ] Check ingredient quantities, timings, servings and instructions.
- [ ] Check dietary and allergen tags.
- [ ] Check nutrition estimates and retain the estimate disclaimer.
- [ ] Record rights confirmation and the complete review checklist in `/admin/catalogue`.
- [ ] Test camera permission, Nutrition Scan, account export and account deletion on deployed HTTPS.
- [ ] Confirm no real user, creator or retailer name appears without permission.

## Rollout

1. Deploy staging and run the complete loop with two test accounts, including cross-user access checks.
2. Deploy beta and invite five testers.
3. Fix all loop-blocking defects; review error and AI-spend telemetry.
4. Expand to 25 testers.
5. After 48 stable hours, open the beta link while retaining an invitation pause switch.

Creator packs, payments, affiliate applications, direct supermarket baskets and physical cards do not block this launch.
