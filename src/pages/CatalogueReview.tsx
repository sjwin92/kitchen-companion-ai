import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type ReviewDecision = 'approved' | 'changes_requested' | 'rejected';
type ReviewCheck = 'recipe_tested' | 'ingredient_quantities_checked' | 'allergens_checked' | 'rights_confirmed' | 'nutrition_source_checked';
type DraftRecipe = {
  id: string;
  title: string;
  description: string | null;
  content_version: number;
  review_status: string;
  rights_basis: string;
  rights_notes: string | null;
  source_url: string | null;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  instructions: Array<string | { text?: string }>;
  allergen_tags: string[];
  nutrition: Record<string, number>;
  recipe_ingredients: Array<{ id: string; position: number; name: string; quantity: number | null; unit: string | null; preparation: string | null }>;
};

const REVIEW_CHECKS: Array<{ id: ReviewCheck; label: string }> = [
  { id: 'recipe_tested', label: 'I cooked and tested this content version' },
  { id: 'ingredient_quantities_checked', label: 'Ingredient quantities and units are complete and correct' },
  { id: 'allergens_checked', label: 'Allergens and dietary tags are checked' },
  { id: 'rights_confirmed', label: 'Publishing and media rights are documented' },
  { id: 'nutrition_source_checked', label: 'Nutrition evidence is checked, or nutrition is intentionally blank' },
];

const db = supabase as unknown as SupabaseClient;

export default function CatalogueReview() {
  const { session } = useApp();
  const isAdmin = session?.user.app_metadata?.role === 'admin';
  const [recipes, setRecipes] = useState<DraftRecipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<ReviewCheck, boolean>>({
    recipe_tested: false,
    ingredient_quantities_checked: false,
    allergens_checked: false,
    rights_confirmed: false,
    nutrition_source_checked: false,
  });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<ReviewDecision | null>(null);
  const selected = useMemo(() => recipes.find(recipe => recipe.id === selectedId) ?? recipes[0], [recipes, selectedId]);

  const loadDrafts = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await db
      .from('recipes')
      .select('id,title,description,content_version,review_status,rights_basis,rights_notes,source_url,servings,prep_minutes,cook_minutes,instructions,allergen_tags,nutrition,recipe_ingredients(id,position,name,quantity,unit,preparation)')
      .in('review_status', ['draft', 'in_review'])
      .order('updated_at', { ascending: true });
    if (error) toast.error(error.message);
    else setRecipes((data ?? []) as unknown as DraftRecipe[]);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { void loadDrafts(); }, [loadDrafts]);

  const resetReview = () => {
    setChecks(Object.fromEntries(REVIEW_CHECKS.map(check => [check.id, false])) as Record<ReviewCheck, boolean>);
    setNotes('');
  };

  const submit = async (decision: ReviewDecision) => {
    if (!selected) return;
    if (decision === 'approved' && REVIEW_CHECKS.some(check => !checks[check.id])) {
      toast.error('Complete every approval check first');
      return;
    }
    if (decision !== 'approved' && notes.trim().length < 5) {
      toast.error('Add a useful reviewer note');
      return;
    }
    setSubmitting(decision);
    const { error } = await db.rpc('review_catalogue_recipe', {
      p_recipe_id: selected.id,
      p_decision: decision,
      p_checklist: checks,
      p_notes: notes.trim() || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(decision === 'approved' ? 'Recipe approved and published' : 'Review decision recorded');
      resetReview();
      await loadDrafts();
    }
    setSubmitting(null);
  };

  if (!isAdmin) {
    return (
      <main className="max-w-2xl mx-auto p-6 pb-28">
        <div className="glass-card p-6 flex gap-3">
          <ShieldAlert className="w-6 h-6 text-destructive shrink-0" />
          <div><h1 className="font-bold">Editorial access only</h1><p className="text-sm text-muted-foreground mt-1">This route requires an admin account.</p></div>
        </div>
      </main>
    );
  }

  if (loading) return <div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-8 pb-28 space-y-6">
      <header>
        <Badge variant="outline" className="mb-2">Admin · human review</Badge>
        <h1 className="text-3xl font-bold">Catalogue review</h1>
        <p className="text-sm text-muted-foreground mt-2">Only approve the exact version you cooked and checked. AI-assisted drafts still require the same evidence.</p>
      </header>

      {recipes.length === 0 ? (
        <div className="glass-card p-8 text-center"><CheckCircle2 className="w-9 h-9 text-primary mx-auto mb-3" /><h2 className="font-bold">Review queue is clear</h2></div>
      ) : (
        <div className="grid md:grid-cols-[280px_1fr] gap-6">
          <aside className="glass-card p-3 h-fit" aria-label="Recipes awaiting review">
            {recipes.map(recipe => (
              <button
                key={recipe.id}
                onClick={() => { setSelectedId(recipe.id); resetReview(); }}
                className={`w-full text-left rounded-lg p-3 mb-1 ${selected?.id === recipe.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                <span className="block font-semibold text-sm">{recipe.title}</span>
                <span className="block text-xs opacity-75">Version {recipe.content_version} · {recipe.review_status}</span>
              </button>
            ))}
          </aside>

          {selected && (
            <section className="space-y-5">
              <div className="glass-card p-5">
                <div className="flex flex-wrap gap-2 mb-3"><Badge>{selected.rights_basis}</Badge><Badge variant="outline">v{selected.content_version}</Badge></div>
                <h2 className="text-2xl font-bold">{selected.title}</h2>
                <p className="text-sm text-muted-foreground mt-2">{selected.description}</p>
                <p className="text-xs mt-3">Serves {selected.servings} · prep {selected.prep_minutes} min · cook {selected.cook_minutes} min</p>
                {selected.source_url && <a className="text-sm text-primary underline mt-3 inline-block" href={selected.source_url} target="_blank" rel="noreferrer">Open source evidence</a>}
                {selected.rights_notes && <p className="text-sm mt-2"><strong>Rights:</strong> {selected.rights_notes}</p>}
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <div className="glass-card p-5"><h3 className="font-bold mb-3">Ingredients</h3><ol className="space-y-2 text-sm">{[...selected.recipe_ingredients].sort((a, b) => a.position - b.position).map(item => <li key={item.id}>{[item.quantity, item.unit, item.name, item.preparation].filter(Boolean).join(' ')}</li>)}</ol></div>
                <div className="glass-card p-5"><h3 className="font-bold mb-3">Method</h3><ol className="list-decimal pl-5 space-y-3 text-sm">{selected.instructions.map((step, index) => <li key={index}>{typeof step === 'string' ? step : step.text}</li>)}</ol></div>
              </div>

              <div className="glass-card p-5 space-y-4">
                <h3 className="font-bold">Approval evidence</h3>
                {REVIEW_CHECKS.map(check => (
                  <label key={check.id} className="flex items-start gap-3 text-sm cursor-pointer">
                    <Checkbox checked={checks[check.id]} onCheckedChange={value => setChecks(current => ({ ...current, [check.id]: value === true }))} aria-label={check.label} />
                    <span>{check.label}</span>
                  </label>
                ))}
                <Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Reviewer notes, changes required, test observations…" aria-label="Reviewer notes" />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void submit('approved')} disabled={submitting !== null}>{submitting === 'approved' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Approve</Button>
                  <Button variant="secondary" onClick={() => void submit('changes_requested')} disabled={submitting !== null}>Request changes</Button>
                  <Button variant="destructive" onClick={() => void submit('rejected')} disabled={submitting !== null}>Reject</Button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
