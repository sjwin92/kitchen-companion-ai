export type StorageLocation = 'fridge' | 'freezer' | 'cupboard';

export type FreshnessStatus = 'use-today' | 'use-soon' | 'okay';

export interface FoodItem {
  id: string;
  name: string;
  quantity: string;
  location: StorageLocation;
  dateAdded: string;
  daysUntilExpiry: number;
  expiryDate?: string;
  status: FreshnessStatus;
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
}
