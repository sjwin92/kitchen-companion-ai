import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBasketCompare } from '@/hooks/useBasketCompare';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke } },
}));

const response = {
  retailers: [{
    retailer: 'grocer-a',
    retailer_name: 'Grocer A',
    total: 2.5,
    items: [{
      ingredient: 'oats',
      product_name: 'Porridge oats',
      price: 2.5,
      unit_price: 0.25,
      unit: '100g',
      url: 'https://example.com/oats',
      image_url: null,
    }],
    not_found: [],
    matched_count: 1,
    requested_count: 1,
    is_complete: true,
    availability: 'available',
    total_is_comparable: true,
    errors: [],
    calculation_mode: 'one_pack',
    coverage_issues: [],
  }],
};

describe('useBasketCompare', () => {
  beforeEach(() => invoke.mockReset());

  it('invokes the authenticated pricing function and stores valid baskets', async () => {
    invoke.mockResolvedValue({ data: response, error: null });
    const { result } = renderHook(() => useBasketCompare());

    await act(() => result.current.compare(['oats']));

    expect(invoke).toHaveBeenCalledWith('compare-prices', { body: { ingredients: ['oats'] } });
    expect(result.current.baskets).toEqual(response.retailers);
    expect(result.current.error).toBeNull();
  });

  it('rejects malformed provider data instead of crashing the shopping list', async () => {
    invoke.mockResolvedValue({ data: { retailers: [{ total: 'cheap' }] }, error: null });
    const { result } = renderHook(() => useBasketCompare());

    await act(() => result.current.compare(['oats']));

    expect(result.current.baskets).toEqual([]);
    expect(result.current.error).toBe('Could not fetch price comparison');
  });

  it('shows the safe message returned by the server function', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Live supermarket prices are temporarily unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
    invoke.mockResolvedValue({ data: null, error: { context: errorResponse } });
    const { result } = renderHook(() => useBasketCompare());

    await act(() => result.current.compare(['oats']));
    await waitFor(() => expect(result.current.error).toBe('Live supermarket prices are temporarily unavailable'));
    expect(result.current.baskets).toEqual([]);
  });
});
