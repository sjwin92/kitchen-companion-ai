import { describe, expect, it } from 'vitest';
import { AppError, appError, errorMessage } from '@/lib/appError';
import { mealDestination } from '@/lib/mealDestination';
import { mealPlanDraftKey } from '@/hooks/useAutoPlan';

describe('public beta hardening contracts', () => {
  it('opens canonical records as recipes and custom records in the plan drawer', () => {
    expect(mealDestination({ id: 'plan-1', recipe_id: 'recipe-1', planKind: 'catalogue' }))
      .toBe('/recipe/recipe-1');
    expect(mealDestination({ id: 'plan-2', recipe_id: 'user-recipe-1', planKind: 'user_recipe' }))
      .toBe('/recipe/user-recipe-1');
    expect(mealDestination({ id: 'plan-3', recipe_id: 'custom-1', planKind: 'custom' }))
      .toBe('/meal-planner?plan=plan-3');
    expect(mealDestination({ id: 'plan-4', recipe_id: 'inventory-1', planKind: 'inventory' }))
      .toBe('/meal-planner?plan=plan-4');
  });

  it('isolates auto-plan drafts by user', () => {
    expect(mealPlanDraftKey('user-a')).toBe('mealplan-draft:user-a');
    expect(mealPlanDraftKey('user-a')).not.toBe(mealPlanDraftKey('user-b'));
  });

  it('preserves safe, retryable mutation errors for the UI', () => {
    const error = appError(new Error('database detail'), 'Your change was not saved.', { code: 'NETWORK' });
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('NETWORK');
    expect(error.retryable).toBe(true);
    expect(errorMessage(error, 'fallback')).toBe('Your change was not saved.');
  });
});
