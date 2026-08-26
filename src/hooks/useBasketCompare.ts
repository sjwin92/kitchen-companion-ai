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
  matched_count: number;
  requested_count: number;
  is_complete: boolean;
  availability: 'available' | 'partial' | 'unavailable';
  total_is_comparable: boolean;
  errors: Array<{ ingredient: string; retailer: string; code: string; message: string }>;
  calculation_mode: 'one_pack' | 'quantity_aware';
  coverage_issues: Array<{
    ingredient: string;
    code: 'no_acceptable_variant' | 'package_size_unknown' | 'unit_incompatible';
    message: string;
    candidate_product_name: string | null;
  }>;
}

export interface BasketCompareInput {
  name: string;
  quantity: string;
}

const SUPPORTED_UNITS = new Set(['g', 'kg', 'ml', 'cl', 'l', 'each']);

function comparisonBody(inputs: Array<string | BasketCompareInput>) {
  if (inputs.every(input => typeof input !== 'string')) {
    const structured = inputs.map(input => {
      const match = input.quantity.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|cl|l|each)$/);
      return match ? { name: input.name, quantity: Number(match[1]), unit: match[2] } : null;
    });
    if (structured.every((item): item is { name: string; quantity: number; unit: string } =>
      item !== null && item.quantity > 0 && SUPPORTED_UNITS.has(item.unit)
    )) return { items: structured };
  }
  return { ingredients: inputs.map(input => typeof input === 'string' ? input : input.name) };
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

function isAdapterError(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const error = value as Record<string, unknown>;
  return typeof error.ingredient === 'string'
    && typeof error.retailer === 'string'
    && typeof error.code === 'string'
    && typeof error.message === 'string';
}

function isCoverageIssue(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const issue = value as Record<string, unknown>;
  return typeof issue.ingredient === 'string'
    && ['no_acceptable_variant', 'package_size_unknown', 'unit_incompatible'].includes(String(issue.code))
    && typeof issue.message === 'string'
    && (issue.candidate_product_name === null || typeof issue.candidate_product_name === 'string');
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
    && basket.not_found.every(item => typeof item === 'string')
    && typeof basket.matched_count === 'number'
    && Number.isInteger(basket.matched_count)
    && typeof basket.requested_count === 'number'
    && Number.isInteger(basket.requested_count)
    && typeof basket.is_complete === 'boolean'
    && ['available', 'partial', 'unavailable'].includes(String(basket.availability))
    && typeof basket.total_is_comparable === 'boolean'
    && Array.isArray(basket.errors)
    && basket.errors.every(isAdapterError)
    && Array.isArray(basket.coverage_issues)
    && basket.coverage_issues.every(isCoverageIssue)
    && ['one_pack', 'quantity_aware'].includes(String(basket.calculation_mode));
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

  const compare = useCallback(async (ingredients: Array<string | BasketCompareInput>) => {
    if (ingredients.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('compare-prices', {
        body: comparisonBody(ingredients),
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
