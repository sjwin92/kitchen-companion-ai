import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AppCapability, CapabilityStatus } from '@/types';

function validCapability(value: unknown): value is CapabilityStatus {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.capability === 'string'
    && typeof item.available === 'boolean'
    && typeof item.reason === 'string';
}

export function useCapabilities() {
  const query = useQuery({
    queryKey: ['capability-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('capability-status');
      if (error) throw error;
      const capabilities = (data as { capabilities?: unknown } | null)?.capabilities;
      if (!Array.isArray(capabilities) || !capabilities.every(validCapability)) throw new Error('Invalid capability response');
      return capabilities;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const getCapability = (capability: AppCapability) => query.data?.find(item => item.capability === capability);
  return { ...query, getCapability };
}
