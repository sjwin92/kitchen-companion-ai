import { describe, expect, it } from 'vitest';
import { recommendRecipes } from '@/lib/recommendationEngine';
import type { CatalogRecipe, FoodItem, UserPreferences } from '@/types';

const preferences: UserPreferences = {
  householdSize: 2, dietaryPreferences: [], cookingTime: '30 min', maxPrepTime: 45,
  dailyCalorieGoal: 2000, dislikedIngredients: [], onboardingComplete: true, displayName: '',
  preferredCuisines: ['Italian'], budgetSensitivity: 'high', cookingConfidence: 'intermediate',
  primaryGoal: 'reduce-waste', planningStyle: 'help-choose', allergies: [], monthlyBudgetGbp: 400, lunchboxCount: 0,
};

const inventory: FoodItem[] = [
  { id: '1', name: 'Tomato', quantity: '4', location: 'fridge', dateAdded: '2026-08-20', daysUntilExpiry: 1, status: 'use-today', lifecycleState: 'available' },
  { id: '2', name: 'Pasta', quantity: '500g', location: 'cupboard', dateAdded: '2026-08-20', daysUntilExpiry: 90, status: 'okay', lifecycleState: 'available' },
];

function recipe(overrides: Partial<CatalogRecipe> = {}): CatalogRecipe {
  return {
    id: 'r1', slug: 'tomato-pasta', title: 'Tomato Pasta', description: null, creatorId: null,
    servings: 2, prepMinutes: 10, cookMinutes: 20, dietaryTags: ['vegan'], allergenTags: ['gluten'],
    cuisineTags: ['Italian'], mealTypes: ['dinner'], nutrition: { calories: 650 },
    estimatedCostLowGbp: 3, estimatedCostHighGbp: 5,
    ingredients: [
      { id: 'i1', name: 'Tomato', normalizedName: 'tomato', quantity: 4, unit: 'each', optional: false, aisle: 'Produce' },
      { id: 'i2', name: 'Pasta', normalizedName: 'pasta', quantity: 250, unit: 'g', optional: false, aisle: 'Pantry' },
    ], instructions: ['Cook and serve.'], imagePath: null, youtubeUrl: null, audioUrl: null,
    creatorName: null, sourceType: 'original', ...overrides,
  };
}

describe('recommendRecipes', () => {
  it('prioritises pantry coverage and expiry rescue', () => {
    const result = recommendRecipes({ recipes: [recipe(), recipe({ id: 'r2', slug: 'rice', title: 'Rice bowl', ingredients: [] })], inventory, preferences, userSeed: 'u1', weekKey: '2026-W35' });
    expect(result[0].recipe.id).toBe('r1');
    expect(result[0].components.pantry).toBe(30);
    expect(result[0].components.expiryRescue).toBeGreaterThan(0);
  });

  it('hard-filters allergens and dietary conflicts', () => {
    const result = recommendRecipes({ recipes: [recipe()], inventory, preferences: { ...preferences, allergies: ['gluten'] }, userSeed: 'u1', weekKey: '2026-W35' });
    expect(result).toHaveLength(0);
  });

  it('is deterministic for the same user and week', () => {
    const recipes = [recipe(), recipe({ id: 'r2', slug: 'second', title: 'Second' })];
    const input = { recipes, inventory, preferences, userSeed: 'u1', weekKey: '2026-W35' };
    expect(recommendRecipes(input).map((item) => item.recipe.id)).toEqual(recommendRecipes(input).map((item) => item.recipe.id));
  });
});
