import type { MealPlanKind } from '@/hooks/useMealPlans';

export interface MealDestinationInput {
  id: string;
  recipe_id: string;
  planKind: MealPlanKind;
}

export function mealDestination(plan: MealDestinationInput) {
  if (plan.planKind === 'catalogue' || plan.planKind === 'user_recipe') {
    return `/recipe/${plan.recipe_id}`;
  }
  return `/meal-planner?plan=${plan.id}`;
}
