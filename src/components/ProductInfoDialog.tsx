import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Leaf, Flame, Droplets, Clock, Users, ChefHat } from 'lucide-react';

interface ProductInfo {
  name: string;
  emoji: string;
  tagline: string;
  benefits: string[];
  nutrients: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
  };
  serving_size: string;
  vitamins: string[];
  category: string;
  // Recipe fields (when includeRecipe=true)
  ingredients?: string[];
  instructions?: string[];
  prep_time?: string;
  cook_time?: string;
  servings?: number;
}

interface ProductInfoDialogProps {
  productName: string | null;
  onClose: () => void;
  /** When true, request a full recipe (ingredients + instructions) */
  includeRecipe?: boolean;
}

// Simple in-memory cache
const infoCache = new Map<string, ProductInfo>();

export default function ProductInfoDialog({ productName, onClose, includeRecipe = false }: ProductInfoDialogProps) {
  const [info, setInfo] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNutrition, setShowNutrition] = useState(false);

  useEffect(() => {
    if (!productName) return;

    const key = `${productName.toLowerCase().trim()}-${includeRecipe ? 'recipe' : 'info'}`;
    if (infoCache.has(key)) {
      setInfo(infoCache.get(key)!);
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    setShowNutrition(false);

    supabase.functions
      .invoke('product-info', { body: { productName, includeRecipe } })
      .then(({ data, error: fnError }) => {
        if (fnError || data?.error) {
          setError('Could not load info');
        } else {
          infoCache.set(key, data);
          setInfo(data);
        }
      })
      .finally(() => setLoading(false));
  }, [productName, includeRecipe]);

  const handleClose = () => {
    setInfo(null);
    setError(null);
    setShowNutrition(false);
    onClose();
  };

  const n = info?.nutrients;
  const totalMacro = (n?.protein_g ?? 0) + (n?.carbs_g ?? 0) + (n?.fat_g ?? 0);
  const proteinPct = totalMacro ? Math.round(((n?.protein_g ?? 0) / totalMacro) * 100) : 0;
  const carbsPct = totalMacro ? Math.round(((n?.carbs_g ?? 0) / totalMacro) * 100) : 0;
  const fatPct = totalMacro ? Math.round(((n?.fat_g ?? 0) / totalMacro) * 100) : 0;

  const hasRecipe = info?.ingredients && info.ingredients.length > 0 && info?.instructions && info.instructions.length > 0;

  return (
    <Dialog open={!!productName} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {info?.emoji && <span className="text-xl">{info.emoji}</span>}
            {info?.name ?? productName ?? 'Loading…'}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {includeRecipe ? 'Generating recipe…' : 'Looking up nutrition info…'}
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center py-6">{error}</p>
        )}

        {info && (
          <div className="space-y-4">
            {/* Tagline */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-accent/50 border border-border/40">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">{info.tagline}</p>
            </div>

            {/* Recipe section */}
            {hasRecipe && (
              <>
                {/* Timing badges */}
                <div className="flex flex-wrap gap-2">
                  {info.prep_time && (
                    <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted border border-border">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span>Prep: {info.prep_time}</span>
                    </div>
                  )}
                  {info.cook_time && (
                    <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted border border-border">
                      <Flame className="w-3 h-3 text-orange-500" />
                      <span>Cook: {info.cook_time}</span>
                    </div>
                  )}
                  {info.servings && (
                    <div className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted border border-border">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span>Serves {info.servings}</span>
                    </div>
                  )}
                </div>

                {/* Ingredients */}
                <div className="space-y-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ingredients</p>
                  <div className="bg-muted/40 rounded-xl border border-border/40 p-3 space-y-1.5">
                    {info.ingredients!.map((ing, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span>{ing}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <ChefHat className="w-3 h-3" /> Instructions
                  </p>
                  <div className="space-y-3">
                    {info.instructions!.map((step, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-sm leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Toggle nutrition */}
                <button
                  onClick={() => setShowNutrition(prev => !prev)}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  {showNutrition ? 'Hide nutrition' : 'Show nutrition info'}
                </button>
              </>
            )}

            {/* Nutrition section — always shown if no recipe, toggle if recipe exists */}
            {(!hasRecipe || showNutrition) && (
              <>
                {/* Calorie card */}
                <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex items-center justify-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-2xl font-bold text-foreground">{n?.calories}</span>
                    <span className="text-sm text-muted-foreground">kcal</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">per {info.serving_size}</p>
                </div>

                {/* Macro bars */}
                <div className="space-y-2">
                  <div className="flex gap-1 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 rounded-l-full" style={{ width: `${proteinPct}%` }} />
                    <div className="bg-amber-500" style={{ width: `${carbsPct}%` }} />
                    <div className="bg-rose-400 rounded-r-full" style={{ width: `${fatPct}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{n?.protein_g}g</p>
                      <p className="text-[10px] text-muted-foreground">Protein</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{n?.carbs_g}g</p>
                      <p className="text-[10px] text-muted-foreground">Carbs</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-rose-500">{n?.fat_g}g</p>
                      <p className="text-[10px] text-muted-foreground">Fat</p>
                    </div>
                  </div>
                  <div className="flex justify-center gap-4 text-[10px] text-muted-foreground">
                    <span><Droplets className="w-3 h-3 inline mr-0.5" />Fiber: {n?.fiber_g}g</span>
                    <span>Sugar: {n?.sugar_g}g</span>
                  </div>
                </div>

                {/* Benefits */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Key Benefits</p>
                  <div className="space-y-1">
                    {info.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vitamins */}
                {info.vitamins.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {info.vitamins.map(v => (
                      <Badge key={v} variant="secondary" className="text-[10px] font-normal">
                        {v}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
