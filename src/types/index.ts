export type StorageLocation = 'fridge' | 'freezer' | 'cupboard';

export type FreshnessStatus = 'unknown' | 'expired' | 'use-today' | 'use-soon' | 'okay';
export type InventoryLifecycle = 'available' | 'reserved' | 'consumed' | 'wasted' | 'discarded';
export type DataProvenance = 'actual' | 'user' | 'barcode' | 'receipt_estimate' | 'vision_estimate';

export interface FoodItem {
  id: string;
  name: string;
  quantity: string;
  location: StorageLocation;
  dateAdded: string;
  daysUntilExpiry: number;
  expiryDate?: string;
  status: FreshnessStatus;
  quantityValue?: number;
  unit?: string;
  lifecycleState?: InventoryLifecycle;
  provenance?: DataProvenance;
  confidence?: number;
}

export interface MealSuggestion {
  id: string;
  title: string;
  description: string;
  prepTime: string;
  ingredients: string[];
  measures?: string[];
  image?: string;
  instructions?: string;
  category?: string;
  area?: string;
  youtubeUrl?: string;
  servings?: number;
  nutrition?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  };
  provenance?: 'catalogue' | 'ai_assisted' | 'external';
}

export type PlanningStyle = 'pick-myself' | 'help-choose' | 'do-it-for-me';
export type BudgetSensitivity = 'low' | 'medium' | 'high';
export type CookingConfidence = 'beginner' | 'intermediate' | 'advanced' | 'master';
export type PrimaryGoal = 'save-time' | 'eat-healthier' | 'reduce-waste' | 'family-friendly' | 'variety';

export interface UserPreferences {
  householdSize: number;
  dietaryPreferences: string[];
  cookingTime: string;
  maxPrepTime: number;
  dailyCalorieGoal: number;
  dislikedIngredients: string[];
  onboardingComplete: boolean;
  displayName: string;
  preferredCuisines: string[];
  budgetSensitivity: BudgetSensitivity;
  cookingConfidence: CookingConfidence;
  primaryGoal: PrimaryGoal;
  planningStyle: PlanningStyle;
  allergies: string[];
  monthlyBudgetGbp: number | null;
  lunchboxCount: number;
}

export interface NutritionRange {
  low: number;
  high: number;
}

export interface NutritionEstimate {
  title: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ranges: {
    calories: NutritionRange;
    protein_g: NutritionRange;
    carbs_g: NutritionRange;
    fat_g: NutritionRange;
  };
  confidence: number;
  ingredients: Array<{ name: string; amount: string; confidence: number }>;
  matched_inventory_ids: string[];
  notes: string[];
  model: string;
  provenance: 'vision_estimate' | 'catalog_estimate' | 'user_estimate';
  image_path: string | null;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number | null;
  unit: string | null;
  optional: boolean;
  aisle: string | null;
}

export interface CatalogRecipe {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  creatorId: string | null;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  dietaryTags: string[];
  allergenTags: string[];
  cuisineTags: string[];
  mealTypes: string[];
  nutrition: Record<string, number>;
  estimatedCostLowGbp: number | null;
  estimatedCostHighGbp: number | null;
  ingredients: RecipeIngredient[];
  instructions: string[];
  imagePath: string | null;
  youtubeUrl: string | null;
  audioUrl: string | null;
  creatorName: string | null;
  sourceType: 'original' | 'creator' | 'user_submission' | 'ai_assisted';
}

export interface RecipeBook {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  creatorId: string | null;
  coverPath: string | null;
  contentVersion: number;
  accessModel: 'included' | 'invite' | 'purchase_future';
}

export interface RecipeRecommendation {
  recipe: CatalogRecipe;
  score: number;
  reasons: string[];
  components: {
    pantry: number;
    expiryRescue: number;
    taste: number;
    prep: number;
    budget: number;
    variety: number;
    nutrition: number;
  };
  missingIngredients: RecipeIngredient[];
}
