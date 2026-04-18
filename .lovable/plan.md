
The user is asking for high-level product improvement ideas, not an implementation task. This is a research/discussion question, so no plan tag needed — but per the system rules I should still keep my response inside one since they asked an open question that could lead to building.

Looking at the current state: the app already has deep features (meal library lifecycle, AI generation w/ images, learning loop, shopping derivation, slot settings, nutrition tracking, waste tracking, activation checklist). Recent friction points from chat: AI credit exhaustion errors, missing images on plan cards, confusing settings toggles, sliders not reaching max.

Highest-leverage improvements I'd recommend, grouped by impact:

**1. Reliability & trust (highest priority)**
- Graceful AI failure handling: when credits exhaust or model returns empty, show a friendly toast ("AI is busy, try again in a moment") instead of red error. Add automatic retry with backoff on the generate-recipe and generate-plan functions.
- Image generation fallback: if Gemini image fails, use a deterministic food-emoji card or a curated stock image keyed by category — never a blank tile.
- Loading skeletons on every async surface (planner cells, recipe dialog, suggestions grid) so the app feels instant.

**2. Close the learning loop visibly**
- "Why we suggested this" chip on every recommended meal (e.g. "Uses spinach expiring in 2 days", "Matches your 4★ ratings", "Quick — under 20 min"). Signal data already exists in `useSmartRecommendations`.
- Weekly "Taste profile" card on dashboard summarising what the AI has learned (top cuisines, avoided ingredients, favourite slot times).

**3. Reduce planning friction**
- One-tap "Plan my week" from dashboard that runs auto-plan + derives shopping list + shows a single confirmation sheet.
- Drag-to-swap meals between days/slots in the planner (hook exists: `useMealDragDrop`).
- "Cook tonight" shortcut: surfaces the highest pantry-match meal for the current slot in one tap.

**4. Shopping & cost intelligence**
- Show estimated basket cost on the shopping list using `ingredient_prices` (table exists, underused).
- Group shopping list by aisle/category for in-store efficiency.
- "Swap to cheaper alternative" suggestion per line item.

**5. Engagement & retention**
- Streaks: cooked-meal streak, zero-waste streak, on-plan streak — surfaced in TopNav.
- Weekly recap email/notification: "You saved £X, prevented Y kg waste, tried Z new recipes."
- Share a recipe card (PNG export) — turns the app into a growth loop.

**6. Quick polish wins**
- Empty states with a clear CTA on every page (Favorites, Shopping, History).
- Pull-to-refresh on mobile lists.
- Offline read-only mode for the current week's plan + shopping list (sw.js exists).

I'll present these as a prioritised menu so the user can pick the direction.
