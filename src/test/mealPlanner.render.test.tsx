import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MealPlanner from '@/pages/MealPlanner';

const addPlan = vi.fn();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    preferences: { planningStyle: 'pick-myself', lunchboxCount: 0 },
    inventory: [],
  }),
}));

vi.mock('@/hooks/useMealPlans', () => ({
  useMealPlans: () => ({
    plans: [],
    loading: false,
    error: null,
    addPlan,
    batchAddPlans: vi.fn(),
    removePlan: vi.fn(),
    movePlan: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFavorites', () => ({ useFavorites: () => ({ favorites: [] }) }));
vi.mock('@/hooks/useMealDragDrop', () => ({
  useMealDragDrop: () => ({
    draggingPlanId: null,
    dragOverTarget: null,
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleTouchStart: vi.fn(),
    handleTouchMove: vi.fn(),
    handleTouchEnd: vi.fn(),
  }),
}));
vi.mock('@/hooks/useMealSlotSettings', () => ({ useMealSlotSettings: () => ({ getSlotSettings: vi.fn() }) }));
vi.mock('@/hooks/useMealRatings', () => ({
  useMealRatings: () => ({ fetchRatings: vi.fn(), addRating: vi.fn(), getRatingForRecipe: vi.fn() }),
}));
vi.mock('@/hooks/useAutoPlan', () => ({
  useAutoPlan: () => ({
    generatePlan: vi.fn(),
    generateSlot: vi.fn(),
    generating: false,
    generatingSlot: null,
    draft: [],
    clearDraft: vi.fn(),
  }),
}));
vi.mock('@/hooks/useGroceryGenerator', () => ({ useGroceryGenerator: () => ({ generate: vi.fn(), generating: false }) }));
vi.mock('@/hooks/useInteractions', () => ({ useInteractions: () => ({ track: vi.fn() }) }));
vi.mock('@/components/AddMealDialog', () => ({ default: () => null }));
vi.mock('@/components/PlanningModeSelector', () => ({ default: () => <div>Planning mode</div> }));
vi.mock('@/components/GuidedSuggestions', () => ({ default: () => null }));
vi.mock('@/components/MealRatingDialog', () => ({ default: () => null }));

describe('MealPlanner', () => {
  beforeEach(() => addPlan.mockReset());

  it('renders the weekly slots without a runtime reference error', () => {
    render(
      <MemoryRouter initialEntries={['/meal-planner']}>
        <MealPlanner />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Meal Planning' })).toBeInTheDocument();
    expect(screen.getAllByText('Breakfast')).toHaveLength(7);
    expect(screen.getAllByText('Lunch')).toHaveLength(7);
    expect(screen.getAllByText('Dinner')).toHaveLength(7);
  });
});
