import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Onboarding from '@/pages/Onboarding';

const completeOnboarding = vi.fn(async () => undefined);
const signOut = vi.fn(async () => undefined);

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ completeOnboarding, signOut }),
}));

describe('Onboarding', () => {
  beforeEach(() => {
    completeOnboarding.mockClear();
    signOut.mockClear();
  });

  it('finishes from the final visible step and saves a vegan profile', async () => {
    render(<Onboarding />);

    fireEvent.click(screen.getByRole('button', { name: "Let's Go" }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vegan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.queryByRole('button', { name: 'Liver' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anchovies' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Blue Cheese' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Add other...'), { target: { value: 'Liver' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.queryByRole('button', { name: 'Liver ×' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    const finish = screen.getByRole('button', { name: '🎉 Start Cooking' });
    fireEvent.click(finish);

    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledOnce());
    expect(completeOnboarding).toHaveBeenCalledWith(expect.objectContaining({
      dietaryPreferences: ['Vegan'],
      dislikedIngredients: [],
    }));
  });
});
