import { useState, useCallback } from 'react';

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

const API_URL = import.meta.env.VITE_PRICING_API_URL as string | undefined;

export function useBasketCompare() {
  const [baskets, setBaskets] = useState<RetailerBasket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = useCallback(async (ingredients: string[]) => {
    if (!API_URL) {
      setError('Pricing API not configured');
      return;
    }
    if (ingredients.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/basket/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setBaskets(data.retailers);
    } catch (err) {
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
