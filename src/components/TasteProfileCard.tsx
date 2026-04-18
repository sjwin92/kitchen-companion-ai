import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useSmartRecommendations } from '@/hooks/useSmartRecommendations';
import { Sparkles, ChefHat, Heart, Ban, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProfileSummary {
  topCuisines: string[];
  favouriteSlot: string | null;
  cookedThisWeek: number;
  topRatedTitle: string | null;
  avoidedCount: number;
}

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks',
};

export default function TasteProfileCard() {
  const { session, preferences } = useApp();
  const { loadSignals } = useSmartRecommendations();
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      const userId = session.user.id;
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [signals, logsRes, ratingsRes, libRes] = await Promise.all([
        loadSignals(),
        supabase.from('meal_log').select('logged_at')
          .eq('user_id', userId).gte('logged_at', oneWeekAgo),
        supabase.from('meal_ratings').select('title, rating')
          .eq('user_id', userId).gte('rating', 4)
          .order('created_at', { ascending: false }).limit(1),
        supabase.from('meal_library').select('cuisine')
          .eq('user_id', userId).not('cuisine', 'is', null).limit(100),
      ]);

      if (cancelled) return;

      // Top cuisines from library + preferences
      const cuisineCounts: Record<string, number> = {};
      (libRes.data || []).forEach((r: any) => {
        if (r.cuisine) cuisineCounts[r.cuisine] = (cuisineCounts[r.cuisine] || 0) + 1;
      });
      preferences.preferredCuisines.forEach(c => {
        cuisineCounts[c] = (cuisineCounts[c] || 0) + 5; // weight stated preferences
      });
      const topCuisines = Object.entries(cuisineCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);

      // Favourite slot: most planned
      const slotCounts: Record<string, number> = {};
      Object.entries(signals?.mealSlotPreferences || {}).forEach(([slot, titles]) => {
        slotCounts[slot] = titles.length;
      });
      const favouriteSlot = Object.entries(slotCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      const avoidedCount =
        preferences.dislikedIngredients.length +
        preferences.allergies.length +
        (signals?.avoidedIngredients.length || 0);

      setSummary({
        topCuisines,
        favouriteSlot,
        cookedThisWeek: logsRes.data?.length || 0,
        topRatedTitle: ratingsRes.data?.[0]?.title || null,
        avoidedCount,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="glass-card p-5 animate-pulse">
        <div className="h-3 w-24 bg-muted rounded mb-3" />
        <div className="h-4 w-3/4 bg-muted rounded mb-2" />
        <div className="h-4 w-1/2 bg-muted rounded" />
      </div>
    );
  }

  if (!summary) return null;

  const hasAnySignal =
    summary.topCuisines.length > 0 ||
    summary.favouriteSlot ||
    summary.cookedThisWeek > 0 ||
    summary.topRatedTitle;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="section-title">Your Taste Profile</p>
      </div>

      {!hasAnySignal ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Cook a few meals and rate them — we'll start learning what you love.
        </p>
      ) : (
        <div className="space-y-3 text-xs">
          {summary.topCuisines.length > 0 && (
            <div className="flex items-start gap-2">
              <ChefHat className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground">You lean towards</p>
                <p className="font-bold">{summary.topCuisines.join(' · ')}</p>
              </div>
            </div>
          )}

          {summary.favouriteSlot && (
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground">Most planned slot</p>
                <p className="font-bold">{SLOT_LABELS[summary.favouriteSlot] ?? summary.favouriteSlot}</p>
              </div>
            </div>
          )}

          {summary.topRatedTitle && (
            <div className="flex items-start gap-2">
              <Heart className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0 fill-primary" />
              <div>
                <p className="text-muted-foreground">Recent 4★+</p>
                <p className="font-bold truncate">{summary.topRatedTitle}</p>
              </div>
            </div>
          )}

          {summary.cookedThisWeek > 0 && (
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground">Cooked this week</p>
                <p className="font-bold">{summary.cookedThisWeek} meal{summary.cookedThisWeek === 1 ? '' : 's'}</p>
              </div>
            </div>
          )}

          {summary.avoidedCount > 0 && (
            <div className="flex items-start gap-2">
              <Ban className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-muted-foreground">Avoiding</p>
                <p className="font-bold">{summary.avoidedCount} ingredient{summary.avoidedCount === 1 ? '' : 's'}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
