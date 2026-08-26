import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import KitchenLoop from '@/components/KitchenLoop';
import TopNav from '@/components/TopNav';

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

describe('app navigation', () => {
  it('opens recipe discovery from the primary Recipes destination', () => {
    render(<MemoryRouter><TopNav /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Recipes' })).toHaveAttribute('href', '/meals');
    expect(screen.getByRole('link', { name: 'Open account settings' })).toHaveAttribute('href', '/settings');
  });

  it('turns the header search control into working navigation', () => {
    render(
      <MemoryRouter>
        <TopNav />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search Kitchen Companion' }));
    fireEvent.change(screen.getByPlaceholderText('Where do you want to go?'), { target: { value: 'recipe shelf' } });
    fireEvent.click(screen.getByText('Recipe books'));

    expect(screen.getByTestId('location')).toHaveTextContent('/recipe-books');
  });

  it('exposes every stage of the kitchen loop as a real destination', () => {
    render(
      <MemoryRouter>
        <KitchenLoop inventoryCount={8} expiringCount={2} todayPlanCount={1} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Add food/ })).toHaveAttribute('href', '/add-food');
    expect(screen.getByRole('link', { name: /Use soon/ })).toHaveAttribute('href', '/use-soon');
    expect(screen.getByRole('link', { name: /Plan meals/ })).toHaveAttribute('href', '/meal-planner');
    expect(screen.getByRole('link', { name: /Buy missing/ })).toHaveAttribute('href', '/shopping-list');
    expect(screen.getByRole('link', { name: /Record/ })).toHaveAttribute('href', '/record');
    expect(screen.getByText('2 need attention')).toBeInTheDocument();
  });
});
