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
type VerificationTier = 'editorial_reviewed' | 'creator_verified' | 'test_kitchen_verified';
type ReviewCheck = 'recipe_tested' | 'creator_attested' | 'ingredient_quantities_checked' | 'allergens_checked' | 'rights_confirmed' | 'nutrition_source_checked';
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
type CommunitySubmission = {
  id: string;
  status: string;
  rights_confirmed: boolean;
  licence_grant: string | null;
  promoted_recipe_id: string | null;
  duplicate_of_recipe_id: string | null;
  user_recipes: { title: string; description: string | null; provenance: string } | null;
};
type CreatorPartnership = {
  id: string;
  status: 'prospect' | 'approved_for_outreach' | 'contacted' | 'interested' | 'agreed' | 'declined' | 'paused';
  public_contact_route: string | null;
  founder_approved_at: string | null;
  creators: { display_name: string; website_url: string | null } | null;
};

const BASE_REVIEW_CHECKS: Array<{ id: ReviewCheck; label: string }> = [
  { id: 'ingredient_quantities_checked', label: 'Ingredient quantities and units are complete and correct' },
  { id: 'allergens_checked', label: 'Allergens and dietary tags are checked' },
  { id: 'rights_confirmed', label: 'Publishing and media rights are documented' },
  { id: 'nutrition_source_checked', label: 'Nutrition evidence is checked, or nutrition is intentionally blank' },
];

const EVIDENCE_CHECKS: Record<VerificationTier, Array<{ id: ReviewCheck; label: string }>> = {
  editorial_reviewed: [],
  creator_verified: [{ id: 'creator_attested', label: 'The supplying creator confirmed this version has been cooked and used' }],
  test_kitchen_verified: [{ id: 'recipe_tested', label: 'I cooked and tested this exact content version' }],
};

const db = supabase as unknown as SupabaseClient;

async function runAdminAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-operations', { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data?.data;
}

export default function CatalogueReview() {
  const { session } = useApp();
  const isAdmin = session?.user.app_metadata?.role === 'admin';
  const [recipes, setRecipes] = useState<DraftRecipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<ReviewCheck, boolean>>({
    recipe_tested: false,
    creator_attested: false,
    ingredient_quantities_checked: false,
    allergens_checked: false,
    rights_confirmed: false,
    nutrition_source_checked: false,
  });
  const [verificationTier, setVerificationTier] = useState<VerificationTier>('editorial_reviewed');
  const [budget, setBudget] = useState<{ total_gbp: number; vision_gbp: number; text_gbp: number; hard_limit_gbp: number } | null>(null);
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [partnerships, setPartnerships] = useState<CreatorPartnership[]>([]);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [approvingCreatorId, setApprovingCreatorId] = useState<string | null>(null);
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
    const [{ data, error }, { data: budgetData }, { data: submissionData, error: submissionError }, { data: partnershipData, error: partnershipError }] = await Promise.all([
      db.from('recipes')
        .select('id,title,description,content_version,review_status,rights_basis,rights_notes,source_url,servings,prep_minutes,cook_minutes,instructions,allergen_tags,nutrition,recipe_ingredients(id,position,name,quantity,unit,preparation)')
        .in('review_status', ['draft', 'in_review'])
        .order('updated_at', { ascending: true }),
      db.rpc('get_ai_budget_status'),
      db.from('recipe_submissions')
        .select('id,status,rights_confirmed,licence_grant,promoted_recipe_id,duplicate_of_recipe_id,user_recipes(title,description,provenance)')
        .in('status', ['submitted', 'in_review'])
        .order('created_at', { ascending: true }),
      db.from('creator_partnerships')
        .select('id,status,public_contact_route,founder_approved_at,creators(display_name,website_url)')
        .in('status', ['prospect', 'approved_for_outreach', 'contacted', 'interested', 'agreed'])
        .order('created_at', { ascending: true }),
    ]);
    if (error) toast.error(error.message);
    else setRecipes((data ?? []) as unknown as DraftRecipe[]);
    if (budgetData) setBudget(budgetData as unknown as typeof budget);
    if (submissionError) toast.error(submissionError.message);
    else setSubmissions((submissionData ?? []) as unknown as CommunitySubmission[]);
    if (partnershipError) toast.error(partnershipError.message);
    else setPartnerships((partnershipData ?? []) as unknown as CreatorPartnership[]);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { void loadDrafts(); }, [loadDrafts]);

  const resetReview = () => {
    setChecks({ recipe_tested: false, creator_attested: false, ingredient_quantities_checked: false, allergens_checked: false, rights_confirmed: false, nutrition_source_checked: false });
    setVerificationTier('editorial_reviewed');
    setNotes('');
  };

  const submit = async (decision: ReviewDecision) => {
    if (!selected) return;
    const requiredChecks = [...BASE_REVIEW_CHECKS, ...EVIDENCE_CHECKS[verificationTier]];
    if (decision === 'approved' && requiredChecks.some(check => !checks[check.id])) {
      toast.error('Complete every approval check first');
      return;
    }
    if (decision !== 'approved' && notes.trim().length < 5) {
      toast.error('Add a useful reviewer note');
      return;
    }
    setSubmitting(decision);
    try {
      await runAdminAction({
        action: 'review_recipe',
        recipeId: selected.id,
        decision,
        checklist: checks,
        notes: notes.trim() || null,
        verificationTier,
      });
      toast.success(decision === 'approved' ? 'Recipe approved and published' : 'Review decision recorded');
      resetReview();
      await loadDrafts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The review decision was not saved');
    } finally {
      setSubmitting(null);
    }
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
        <p className="text-sm text-muted-foreground mt-2">Approve only the exact content version whose rights, ingredients, allergens and nutrition evidence you checked. Higher verification tiers require creator or test-kitchen evidence.</p>
      </header>

      {budget && (
        <section className="glass-card p-4" aria-label="Monthly AI budget">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">AI budget</p><p className="text-sm mt-1">Vision £{Number(budget.vision_gbp).toFixed(2)} · text £{Number(budget.text_gbp).toFixed(2)}</p></div>
            <strong className="text-lg">£{Number(budget.total_gbp).toFixed(2)} / £{Number(budget.hard_limit_gbp).toFixed(2)}</strong>
          </div>
        </section>
      )}

      {submissions.length > 0 && (
        <section className="glass-card p-4 space-y-3" aria-label="Community recipe submissions">
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Community queue</p><h2 className="mt-1 font-bold">Permissioned private recipes</h2></div>
          {submissions.map(submission => (
            <div key={submission.id} className="flex flex-col gap-3 rounded-xl border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-sm">{submission.user_recipes?.title ?? 'Untitled private recipe'}</p>
                <p className="text-xs text-muted-foreground mt-1">{submission.user_recipes?.provenance} · {submission.status} · {submission.rights_confirmed ? 'permission recorded' : 'permission missing'}{submission.duplicate_of_recipe_id ? ' · possible duplicate' : ''}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!submission.rights_confirmed || Boolean(submission.promoted_recipe_id) || Boolean(submission.duplicate_of_recipe_id) || promotingId !== null}
                onClick={async () => {
                  const base = (submission.user_recipes?.title ?? 'community-recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
                  setPromotingId(submission.id);
                  try {
                    await runAdminAction({
                      action: 'promote_submission',
                      submissionId: submission.id,
                      slug: `${base}-${submission.id.slice(0, 8)}`,
                      notes: 'Promoted to the private catalogue queue; full editorial review still required.',
                    });
                    toast.success('Submission processed in the editorial queue');
                    await loadDrafts();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'The submission was not processed');
                  } finally {
                    setPromotingId(null);
                  }
                }}
              >
                {promotingId === submission.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {submission.duplicate_of_recipe_id ? 'Duplicate flagged' : submission.promoted_recipe_id ? 'Prepared' : 'Prepare catalogue draft'}
              </Button>
            </div>
          ))}
        </section>
      )}

      {partnerships.length > 0 && (
        <section className="glass-card p-4 space-y-3" aria-label="Creator partnership approvals">
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Creator partnerships</p><h2 className="mt-1 font-bold">Founder-controlled outreach</h2><p className="mt-1 text-xs text-muted-foreground">Approval unlocks outreach tracking only. It does not send a message or grant content rights.</p></div>
          {partnerships.map(partnership => (
            <div key={partnership.id} className="flex flex-col gap-3 rounded-xl border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-sm">{partnership.creators?.display_name ?? 'Unnamed creator'}</p>
                <p className="text-xs text-muted-foreground mt-1">{partnership.status.replaceAll('_', ' ')}{partnership.public_contact_route ? ` · ${partnership.public_contact_route}` : ' · public route not recorded'}</p>
              </div>
              <div className="flex items-center gap-2">
                {partnership.creators?.website_url && <Button size="sm" variant="ghost" asChild><a href={partnership.creators.website_url} target="_blank" rel="noreferrer">Open public site</a></Button>}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={partnership.status !== 'prospect' || approvingCreatorId !== null}
                  onClick={async () => {
                    setApprovingCreatorId(partnership.id);
                    try {
                      await runAdminAction({ action: 'approve_creator_outreach', partnershipId: partnership.id });
                      toast.success('Creator approved for outreach preparation');
                      await loadDrafts();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'The creator approval was not saved');
                    } finally {
                      setApprovingCreatorId(null);
                    }
                  }}
                >
                  {approvingCreatorId === partnership.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {partnership.status === 'prospect' ? 'Approve outreach' : 'Approval recorded'}
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

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
                <label className="block text-sm font-semibold">
                  Verification tier
                  <select className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={verificationTier} onChange={event => setVerificationTier(event.target.value as VerificationTier)}>
                    <option value="editorial_reviewed">Editorially reviewed</option>
                    <option value="creator_verified">Creator verified</option>
                    <option value="test_kitchen_verified">Test-kitchen verified</option>
                  </select>
                </label>
                {[...BASE_REVIEW_CHECKS, ...EVIDENCE_CHECKS[verificationTier]].map(check => (
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
