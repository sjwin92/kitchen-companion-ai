import type { CatalogRecipe, FoodItem, RecipeIngredient, RecipeRecommendation, UserPreferences } from '@/types';

export interface RecipeMemorySnapshot {
  recipeId: string;
  timesCooked: number;
  lastCookedAt?: string | null;
}

export interface RecommendationContext {
  recipes: CatalogRecipe[];
  inventory: FoodItem[];
  preferences: UserPreferences;
  memory?: RecipeMemorySnapshot[];
  userSeed: string;
  weekKey: string;
  limit?: number;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function tokenMatch(a: string, b: string) {
  const left = normalize(a);
  const right = normalize(b);
  return left === right || left.includes(right) || right.includes(left);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function stableNoise(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function hasHardConflict(recipe: CatalogRecipe, preferences: UserPreferences) {
  const recipeAllergens = recipe.allergenTags.map(normalize);
  if (preferences.allergies.some((allergy) => recipeAllergens.some((tag) => tokenMatch(tag, allergy)))) return true;

  const diet = preferences.dietaryPreferences.map(normalize);
  const tags = recipe.dietaryTags.map(normalize);
  const ingredientNames = recipe.ingredients.map((ingredient) => normalize(ingredient.name));
  if (diet.some((value) => value.includes('vegan') || value.includes('plant based'))) {
    const animalProducts = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'egg', 'milk', 'cheese', 'butter', 'yogurt', 'honey'];
    if (!tags.includes('vegan') || ingredientNames.some((name) => animalProducts.some((item) => tokenMatch(name, item)))) return true;
  }
  if (diet.some((value) => value.includes('vegetarian'))) {
    const meat = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'anchovy'];
    if (!tags.includes('vegetarian') || ingredientNames.some((name) => meat.some((item) => tokenMatch(name, item)))) return true;
  }
  return preferences.dislikedIngredients.some((dislike) => ingredientNames.some((name) => tokenMatch(name, dislike)));
}

function ingredientMatchesInventory(ingredient: RecipeIngredient, inventory: FoodItem[]) {
  return inventory.find((item) => tokenMatch(item.name, ingredient.normalizedName || ingredient.name));
}

export function recommendRecipes(context: RecommendationContext): RecipeRecommendation[] {
  const available = context.inventory.filter((item) => !item.lifecycleState || ['available', 'reserved'].includes(item.lifecycleState));
  const memory = new Map((context.memory ?? []).map((item) => [item.recipeId, item]));
  const maxPrep = Math.max(1, context.preferences.maxPrepTime || 60);

  return context.recipes
    .filter((recipe) => !hasHardConflict(recipe, context.preferences))
    .map((recipe) => {
      const required = recipe.ingredients.filter((ingredient) => !ingredient.optional);
      const matched = required.filter((ingredient) => ingredientMatchesInventory(ingredient, available));
      const missing = required.filter((ingredient) => !ingredientMatchesInventory(ingredient, available));
      const pantryRatio = required.length === 0 ? 1 : matched.length / required.length;
      const rescueMatches = matched.filter((ingredient) => {
        const item = ingredientMatchesInventory(ingredient, available);
        return item?.status === 'use-today' || item?.status === 'use-soon' || item?.status === 'expired';
      });
      const rescueRatio = matched.length === 0 ? 0 : rescueMatches.length / matched.length;
      const cuisineMatch = recipe.cuisineTags.some((tag) => context.preferences.preferredCuisines.some((preferred) => tokenMatch(tag, preferred)));
      const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;
      const prepFit = totalMinutes <= maxPrep ? 1 : clamp(1 - (totalMinutes - maxPrep) / maxPrep);
      const estimatedHigh = Number(recipe.estimatedCostHighGbp ?? 0);
      const budgetFit = estimatedHigh === 0 ? 0.6 : context.preferences.budgetSensitivity === 'high' ? clamp(1 - estimatedHigh / 20) : context.preferences.budgetSensitivity === 'medium' ? clamp(1 - estimatedHigh / 35) : 1;
      const prior = memory.get(recipe.id);
      const cookedRecently = prior?.lastCookedAt ? Date.now() - new Date(prior.lastCookedAt).getTime() < 14 * 86400000 : false;
      const varietyFit = cookedRecently ? 0 : clamp(1 - (prior?.timesCooked ?? 0) / 12);
      const calories = Number(recipe.nutrition.calories ?? 0);
      const targetPerMeal = context.preferences.dailyCalorieGoal > 0 ? context.preferences.dailyCalorieGoal / 3 : 667;
      const nutritionFit = calories > 0 ? clamp(1 - Math.abs(calories - targetPerMeal) / targetPerMeal) : 0.6;

      const components = {
        pantry: pantryRatio * 30,
        expiryRescue: rescueRatio * 25,
        taste: (cuisineMatch ? 1 : 0.5) * 15,
        prep: prepFit * 10,
        budget: budgetFit * 10,
        variety: varietyFit * 5,
        nutrition: nutritionFit * 5,
      };
      const score = Object.values(components).reduce((sum, value) => sum + value, 0);
      const reasons = [
        rescueMatches.length > 0 ? `Uses ${rescueMatches.length} item${rescueMatches.length === 1 ? '' : 's'} that need using soon` : null,
        pantryRatio >= 0.75 ? 'Mostly uses what you already have' : null,
        cuisineMatch ? 'Matches your preferred cuisines' : null,
        totalMinutes <= maxPrep ? `Fits your ${maxPrep}-minute time limit` : null,
      ].filter((reason): reason is string => Boolean(reason));
      return { recipe, score, reasons, components, missingIngredients: missing, noise: stableNoise(`${context.userSeed}:${context.weekKey}:${recipe.id}`) };
    })
    .sort((left, right) => right.score - left.score || right.noise - left.noise)
    .slice(0, context.limit ?? 12)
    .map(({ noise: _noise, ...recommendation }) => recommendation);
}
