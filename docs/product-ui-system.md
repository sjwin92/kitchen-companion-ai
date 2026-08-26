# Kitchen Companion product and UI system

Kitchen Companion is one connected kitchen loop, not a bundle of AI tools:

```text
add food → monitor expiry → choose recipes → plan meals → buy missing items → record consumption or waste
```

## Product nouns

Use these terms consistently in navigation, UI copy, analytics and code:

- **Recipe** — a reusable set of ingredients and instructions. A recipe can be saved, added to a plan or included in a recipe book.
- **Recipe book** — a curated collection from Kitchen Companion or a creator. This is the collectable “recipe pack” product.
- **Meal** — one scheduled or completed instance of a recipe, such as Tuesday dinner. Meals belong in the planner, history and calorie log.
- **Food item** — a quantity in the user’s fridge, freezer or pantry. It has freshness and lifecycle state.
- **Shopping item** — something the user intends to buy. It can be derived from planned recipes and reconciled back into inventory.

Do not call a recipe a meal until it has been planned or recorded. Do not present generated drafts alongside reviewed public recipes without a clear provenance label.

## Primary navigation

- **Home** — today’s priorities and the kitchen loop.
- **Inventory** — food the household owns and its expiry state.
- **Recipes** — individual recipes ranked for the current kitchen. Recipe books and saved recipes are linked from here.
- **Plan** — scheduled meal instances.
- **Shop** — missing items, basket comparison and purchase reconciliation.

Settings, waste, nutrition history and editorial tools are secondary destinations rather than primary tabs.

## Recipe presentation

The standard recipe card contains, in order:

1. food image or a restrained illustrated fallback;
2. urgent “use soon” context when relevant;
3. save control;
4. time and pantry coverage;
5. recipe title;
6. pantry-match percentage and one plain-language reason.

The whole card opens the recipe, while save remains a separate explicit action. A heart means save; a plus is reserved for adding something to a plan, list or inventory.

Recipe-book cards behave like collectable covers: creator first, collection title, short promise and access state. Recipe rows inside a book are denser than discovery cards but use the same artwork fallback and metadata order.

## Visual quality rules

- Prefer solid, calm surfaces and clear borders over universal glass, gradients and glow.
- Only interactive cards lift on hover. Static information must not pretend to be clickable.
- Use one emoji as a useful fallback or category cue; never decorate every label with one.
- Use sparkle icons only for explicitly generative actions. Pantry matching and catalogue ranking are ordinary product behaviour.
- Empty states explain what is happening and provide a next action. Never leave a primary route looking unfinished.
- Keep provenance visible: reviewed catalogue, creator recipe, external recipe or private generated draft.
- Avoid claims such as “cheapest”, “best” or “healthy” unless the underlying data supports them.

## Catalogue states

Public catalogue content passes through:

```text
draft → rights cleared → structured → test cooked → nutrition/allergen checked → approved → published
```

An in-review collection may be previewed honestly, but its recipe cards remain unavailable until approval. User-generated or AI-assisted recipes stay private unless they complete the same editorial path.
