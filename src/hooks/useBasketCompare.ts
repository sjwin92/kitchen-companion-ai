import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BasketItem {
  ingredient: string;
  product_name: string;
  price: number;
  unit_price: number | null;
  unit: string | null;
  url: string;
  image_url: string | null;
}

export interface RetailerBasket {
  retailer: string;
  retailer_name: string;
  total: number;
  items: BasketItem[];
  not_found: string[];
}

function isBasketItem(value: unknown): value is BasketItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.ingredient === 'string'
    && typeof item.product_name === 'string'
    && typeof item.price === 'number'
    && Number.isFinite(item.price)
    && (item.unit_price === null || (typeof item.unit_price === 'number' && Number.isFinite(item.unit_price)))
    && (item.unit === null || typeof item.unit === 'string')
    && typeof item.url === 'string'
    && (item.image_url === null || typeof item.image_url === 'string');
}

function isRetailerBasket(value: unknown): value is RetailerBasket {
  if (!value || typeof value !== 'object') return false;
  const basket = value as Record<string, unknown>;
  return typeof basket.retailer === 'string'
    && typeof basket.retailer_name === 'string'
    && typeof basket.total === 'number'
    && Number.isFinite(basket.total)
    && Array.isArray(basket.items)
    && basket.items.every(isBasketItem)
    && Array.isArray(basket.not_found)
    && basket.not_found.every(item => typeof item === 'string');
}

export function parseBasketComparison(value: unknown): RetailerBasket[] | null {
  if (!value || typeof value !== 'object') return null;
  const retailers = (value as { retailers?: unknown }).retailers;
  return Array.isArray(retailers) && retailers.every(isRetailerBasket) ? retailers : null;
}

async function functionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === 'object') {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: unknown } | null;
      if (typeof payload?.error === 'string') return payload.error;
    }
  }
  return 'Could not fetch price comparison';
}

export function useBasketCompare() {
  const [baskets, setBaskets] = useState<RetailerBasket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = useCallback(async (ingredients: string[]) => {
    if (ingredients.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('compare-prices', {
        body: { ingredients },
      });
      if (invokeError) {
        setError(await functionErrorMessage(invokeError));
        setBaskets([]);
        return;
      }
      const parsed = parseBasketComparison(data);
      if (!parsed) throw new Error('Invalid pricing response');
      setBaskets(parsed);
    } catch {
      setError('Could not fetch price comparison');
      setBaskets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setBaskets([]);
    setError(null);
  }, []);

  return { baskets, loading, error, compare, clear };
}
