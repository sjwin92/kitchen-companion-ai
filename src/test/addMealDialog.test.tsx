import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AddMealDialog from '@/components/AddMealDialog';

const removeItem = vi.fn(async () => undefined);
const updateItem = vi.fn(async () => undefined);

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    inventory: [{ id: 'spinach-1', name: 'Baby spinach', quantity: '200g' }],
    removeItem,
    updateItem,
    preferences: {
      dietaryPreferences: ['Vegan'],
      dislikedIngredients: [],
      allergies: [],
    },
  }),
}));

describe('AddMealDialog inventory planning', () => {
  it('does not consume stock until the planned meal is confirmed', async () => {
    const onAdd = vi.fn(async () => undefined);

    render(
      <MemoryRouter>
        <AddMealDialog
          addDialog={{ date: new Date('2026-08-26T12:00:00Z'), slot: 'dinner' }}
          onClose={() => undefined}
          onAdd={onAdd}
          favorites={[]}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Quick Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Baby spinach (200g)' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledOnce());
    expect(removeItem).not.toHaveBeenCalled();
    expect(updateItem).not.toHaveBeenCalled();
  });
});
