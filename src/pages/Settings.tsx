import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { LogOut, User, X, Loader2, Moon, TrendingDown, Bell, ChevronRight, Wallet, Leaf, UtensilsCrossed, Minus, Plus, Download, Trash2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import type { PlanningStyle, BudgetSensitivity, CookingConfidence, PrimaryGoal } from '@/types';
import { deleteAccount, downloadAccountExport } from '@/services/accountPrivacy';
import { DIETARY_OPTIONS, removeRedundantDislikes, toggleDietaryPreference } from '@/lib/onboardingPreferences';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const DIETARY_DESCRIPTIONS: Record<(typeof DIETARY_OPTIONS)[number], string> = {
  Vegetarian: 'Exclude meat and fish.',
  Vegan: 'Exclude meat, fish, dairy, eggs, honey, and other animal products.',
  Pescatarian: 'Exclude meat while allowing fish and seafood.',
  'Gluten-Free': 'Exclude ingredients containing gluten.',
  'Dairy-Free': 'Exclude milk and dairy ingredients.',
  Keto: 'Prioritise low-carbohydrate meals.',
  'High-Protein': 'Prioritise meals with more protein.',
  Halal: 'Exclude clear conflicts such as pork and alcohol; certification still matters.',
  Kosher: 'Exclude clear conflicts such as pork and shellfish; certification still matters.',
  None: 'No dietary restrictions.',
};

const CUISINE_OPTIONS = ['Mediterranean', 'Japanese', 'French', 'Nordic', 'Thai', 'Mexican', 'Indian', 'Italian', 'Korean', 'Chinese', 'American', 'British', 'Middle Eastern'];

const CONFIDENCE_LABELS: Record<string, { label: string; desc: string }> = {
  beginner: { label: 'Novice', desc: 'Simple recipes, minimal techniques, basic equipment' },
  intermediate: { label: 'Competent', desc: 'Comfortable with most recipes and common techniques' },
  advanced: { label: 'Advanced', desc: 'Complex recipes, advanced techniques, specialty dishes' },
  master: { label: 'Master', desc: 'Professional-level skills, any cuisine, any technique' },
};

const CONFIDENCE_SLIDER: Record<string, number> = {
  beginner: 0,
  intermediate: 33,
  advanced: 66,
  master: 100,
};

const PREP_TIME_MARKS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hr' },
  { value: 90, label: '1.5 hr' },
  { value: 120, label: '2 hr' },
];

export default function Settings() {
  const { preferences: savedPreferences, savePreferences, signOut, session } = useApp();
  const [preferences, setDraftPreferences] = useState(savedPreferences);
  const [savingProfile, setSavingProfile] = useState(false);
  const setPreferences = (updates: Partial<typeof preferences>) => {
    setDraftPreferences(current => ({ ...current, ...updates }));
  };
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [dislikedInput, setDislikedInput] = useState('');
  const [allergyInput, setAllergyInput] = useState('');
  const { enabled: notificationsEnabled, permission: notifPermission, toggle: toggleNotifications } = useNotifications();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [privacyAction, setPrivacyAction] = useState<'export' | 'delete' | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const isDirty = JSON.stringify(preferences) !== JSON.stringify(savedPreferences);

  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [darkMode]);

  useEffect(() => {
    setDraftPreferences(savedPreferences);
  }, [savedPreferences]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await savePreferences(preferences);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(); toast.success('Signed out'); }
    catch { toast.error('Failed to sign out'); }
    finally { setSigningOut(false); }
  };

  const handleExport = async () => {
    if (!session?.user) return;
    setPrivacyAction('export');
    try {
      await downloadAccountExport();
      toast.success('Your data export has downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setPrivacyAction(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') return;
    setPrivacyAction('delete');
    try {
      await deleteAccount();
      toast.success('Account deleted');
      setDeleteDialogOpen(false);
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Account deletion failed');
    } finally {
      setPrivacyAction(null);
    }
  };

  const toggleDietary = (pref: string) => {
    const next = toggleDietaryPreference(preferences.dietaryPreferences, pref);
    setPreferences({
      dietaryPreferences: next,
      dislikedIngredients: removeRedundantDislikes(preferences.dislikedIngredients, next),
    });
  };

  const toggleCuisine = (item: string) => {
    const current = preferences.preferredCuisines;
    const next = current.includes(item) ? current.filter(c => c !== item) : [...current, item];
    setPreferences({ preferredCuisines: next });
  };

  const addDisliked = () => {
    const val = dislikedInput.trim();
    if (!val || preferences.dislikedIngredients.includes(val)) return;
    if (removeRedundantDislikes([val], preferences.dietaryPreferences).length === 0) {
      toast.info(`${val} is already excluded by your dietary choices.`);
      setDislikedInput('');
      return;
    }
    setPreferences({ dislikedIngredients: [...preferences.dislikedIngredients, val] });
    setDislikedInput('');
  };

  const removeDisliked = (item: string) => {
    setPreferences({ dislikedIngredients: preferences.dislikedIngredients.filter(i => i !== item) });
  };

  const addAllergy = () => {
    const val = allergyInput.trim();
    if (!val || preferences.allergies.includes(val)) return;
    setPreferences({ allergies: [...preferences.allergies, val] });
    setAllergyInput('');
  };

  return (
    <div className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-7xl mx-auto animate-fade-in">
      <header className="mb-8">
        <p className="section-title mb-2">Your kitchen</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Account, food preferences, goals, appearance and privacy.</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-8">
        {/* Main content */}
        <div className="space-y-8">
          {/* Account header */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{preferences.displayName || session?.user?.email}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              </div>
            </div>
            <Input
              value={preferences.displayName}
              onChange={e => setPreferences({ displayName: e.target.value })}
              placeholder="Display name"
              className="max-w-sm"
            />
          </section>

          {/* Dietary Preferences — card grid */}
          <section>
            <h2 className="text-xl font-bold tracking-tight mb-4">Dietary Preferences</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DIETARY_OPTIONS.map(option => {
                const active = preferences.dietaryPreferences.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDietary(option)}
                    className={`glass-card p-5 text-left transition-all ${active ? 'ring-2 ring-primary' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-primary">
                        {option === 'None' ? <UtensilsCrossed className="w-5 h-5" /> : <Leaf className="w-5 h-5" />}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-primary bg-primary' : 'border-border'}`}>
                        {active && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                    </div>
                    <h3 className="text-sm font-bold mb-1">{option}</h3>
                    <p className="text-xs text-muted-foreground">{DIETARY_DESCRIPTIONS[option]}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Culinary Influence — chip row */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold tracking-tight">Culinary Influence</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Multiple Select</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CUISINE_OPTIONS.map(opt => {
                const active = preferences.preferredCuisines.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleCuisine(opt)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      active ? 'bg-primary text-primary-foreground' : 'bg-surface text-foreground hover:bg-surface-high'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Cooking Confidence — slider */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold tracking-tight">Cooking Confidence</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {CONFIDENCE_LABELS[preferences.cookingConfidence]?.label || 'Competent'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {CONFIDENCE_LABELS[preferences.cookingConfidence]?.desc || 'Comfortable with most recipes'}
            </p>
            <Slider
              value={[CONFIDENCE_SLIDER[preferences.cookingConfidence] ?? 33]}
              max={100}
              step={1}
              onValueChange={([v]) => {
                const conf = v < 20 ? 'beginner' : v < 50 ? 'intermediate' : v < 80 ? 'advanced' : 'master';
                setPreferences({ cookingConfidence: conf as CookingConfidence });
              }}
              className="mb-2"
            />
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Novice</span>
              <span>Competent</span>
              <span>Advanced</span>
              <span>Master</span>
            </div>
          </section>

          {/* Max Prep Time — slider */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold tracking-tight">Maximum Prep Time</h2>
              <span className="text-sm font-bold text-primary">
                {preferences.maxPrepTime <= 60
                  ? `${preferences.maxPrepTime} min`
                  : `${Math.floor(preferences.maxPrepTime / 60)}h ${preferences.maxPrepTime % 60 > 0 ? `${preferences.maxPrepTime % 60}m` : ''}`
                }
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Reviewed recipes and any optional AI fallback will stay within this time limit.
            </p>
            <Slider
              value={[preferences.maxPrepTime]}
              min={15}
              max={120}
              step={5}
              onValueChange={([v]) => setPreferences({ maxPrepTime: v })}
              className="mb-2"
            />
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {PREP_TIME_MARKS.map(m => (
                <span key={m.value}>{m.label}</span>
              ))}
            </div>
          </section>

          {/* Disliked ingredients & allergies */}
          <section>
            <h2 className="text-xl font-bold tracking-tight mb-3">Allergies & Dislikes</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Allergies</label>
                <div className="flex gap-2 mb-2">
                  <Input value={allergyInput} onChange={e => setAllergyInput(e.target.value)} placeholder="Add allergy..." onKeyDown={e => e.key === 'Enter' && addAllergy()} className="flex-1" />
                  <Button size="sm" onClick={addAllergy} disabled={!allergyInput.trim()} className="rounded-xl">Add</Button>
                </div>
                {preferences.allergies.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {preferences.allergies.map(item => (
                      <Badge key={item} variant="destructive" className="gap-1 rounded-xl">
                        {item}
                        <button onClick={() => setPreferences({ allergies: preferences.allergies.filter(a => a !== item) })}><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Disliked Ingredients</label>
                <div className="flex gap-2 mb-2">
                  <Input value={dislikedInput} onChange={e => setDislikedInput(e.target.value)} placeholder="e.g. Cilantro" onKeyDown={e => e.key === 'Enter' && addDisliked()} className="flex-1" />
                  <Button size="sm" onClick={addDisliked} disabled={!dislikedInput.trim()} className="rounded-xl">Add</Button>
                </div>
                {preferences.dislikedIngredients.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {preferences.dislikedIngredients.map(item => (
                      <Badge key={item} variant="secondary" className="gap-1 rounded-xl">
                        {item}
                        <button onClick={() => removeDisliked(item)}><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Action buttons */}
          <div className="sticky bottom-20 z-20 flex gap-3 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-[var(--shadow-elevated)] backdrop-blur md:bottom-4">
            <Button variant="outline" onClick={() => setDraftPreferences(savedPreferences)} disabled={savingProfile || !isDirty} className="min-h-11 rounded-xl text-xs font-bold uppercase tracking-wider">
              Discard Changes
            </Button>
            <Button onClick={handleSaveProfile} disabled={savingProfile || !isDirty} className="min-h-11 flex-1 rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: 'var(--gradient-primary)' }}>
              {savingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Profile
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Toggles */}
          <div className="glass-card divide-y divide-border/50">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Dark Mode</span>
              </div>
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-warning" />
                <span className="text-sm font-semibold">Notifications</span>
              </div>
              <Switch checked={notificationsEnabled} disabled={notifPermission === 'denied'} onCheckedChange={async (checked) => {
                const ok = await toggleNotifications(checked);
                if (checked && ok) toast.success('Notifications enabled');
                else if (checked && !ok) toast.error('Permission denied');
              }} />
            </div>
            <button onClick={() => navigate('/waste')} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold">Waste Tracker</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Household Dynamics */}
          <div className="glass-card p-5">
            <h3 className="text-base font-bold mb-4">Household Dynamics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Serving Size</span>
                <div className="flex items-center gap-3">
                  <button aria-label="Decrease household size" onClick={() => setPreferences({ householdSize: Math.max(1, preferences.householdSize - 1) })} className="h-11 w-11 rounded-full border border-border flex items-center justify-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-lg font-bold w-6 text-center">{String(preferences.householdSize).padStart(2, '0')}</span>
                  <button aria-label="Increase household size" onClick={() => setPreferences({ householdSize: preferences.householdSize + 1 })} className="h-11 w-11 rounded-full border border-border flex items-center justify-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Daily Calorie Target</span>
                <div className="flex items-center gap-3">
                  <button aria-label="Decrease daily calorie goal" onClick={() => setPreferences({ dailyCalorieGoal: Math.max(1000, preferences.dailyCalorieGoal - 100) })} className="h-11 w-11 rounded-full border border-border flex items-center justify-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-bold w-14 text-center">{preferences.dailyCalorieGoal.toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">kcal</span></span>
                  <button aria-label="Increase daily calorie goal" onClick={() => setPreferences({ dailyCalorieGoal: Math.min(5000, preferences.dailyCalorieGoal + 100) })} className="h-11 w-11 rounded-full border border-border flex items-center justify-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm">Monthly Budget</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">£</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={preferences.monthlyBudgetGbp ?? ''}
                    onChange={e => {
                      const v = e.target.value;
                      setPreferences({ monthlyBudgetGbp: v === '' ? null : Number(v) });
                    }}
                    placeholder="400"
                    className="w-20 h-8 text-right text-sm font-bold"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm">Lunchboxes / Week</span>
                </div>
                <div className="flex items-center gap-3">
                  <button aria-label="Decrease weekly lunchboxes" onClick={() => setPreferences({ lunchboxCount: Math.max(0, preferences.lunchboxCount - 1) })} className="h-11 w-11 rounded-full border border-border flex items-center justify-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-lg font-bold w-6 text-center">{preferences.lunchboxCount}</span>
                  <button aria-label="Increase weekly lunchboxes" onClick={() => setPreferences({ lunchboxCount: Math.min(7, preferences.lunchboxCount + 1) })} className="h-11 w-11 rounded-full border border-border flex items-center justify-center hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Planning Ethos */}
          <div className="glass-card p-5">
            <h3 className="text-base font-bold mb-4">Planning Ethos</h3>
            <div className="space-y-2">
              {([
                { value: 'pick-myself' as PlanningStyle, label: 'The Curated Week', desc: 'Full planning every Sunday including prep lists and inventory synchronization.' },
                { value: 'help-choose' as PlanningStyle, label: 'Spontaneous Utility', desc: 'Recipe suggestions based on what is currently in the pantry. Minimal prep.' },
                { value: 'do-it-for-me' as PlanningStyle, label: 'Automated', desc: 'Builds your weekly plan from reviewed catalogue recipes, preferences and inventory.' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPreferences({ planningStyle: opt.value })}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    preferences.planningStyle === opt.value ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      preferences.planningStyle === opt.value ? 'border-primary' : 'border-border'
                    }`}>
                      {preferences.planningStyle === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <p className="text-sm font-bold">{opt.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="text-base font-bold">Your data & privacy</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Nutrition values are estimates for general wellbeing, not medical advice. Meal photos are private and removed after 90 days.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleExport} disabled={privacyAction !== null} className="w-full rounded-xl">
              {privacyAction === 'export' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download my data
            </Button>
            <Button variant="outline" onClick={() => { setDeleteConfirmation(''); setDeleteDialogOpen(true); }} disabled={privacyAction !== null} className="w-full min-h-11 rounded-xl text-destructive border-destructive/20 hover:bg-destructive/5">
              {privacyAction === 'delete' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete account
            </Button>
            <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-center text-xs">
              <button onClick={() => navigate('/privacy')} className="rounded-lg py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Privacy</button>
              <button onClick={() => navigate('/terms')} className="rounded-lg py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Terms</button>
              <button onClick={() => navigate('/support')} className="rounded-lg py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Support</button>
            </div>
          </div>

          {/* Sign out */}
          <Button variant="outline" onClick={handleSignOut} disabled={signingOut} className="w-full rounded-xl text-destructive border-destructive/20 hover:bg-destructive/5">
            {signingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            Sign Out
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your Kitchen Companion account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your private inventory, meal plans and meal photos. Type DELETE to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} aria-label="Type DELETE to confirm account deletion" autoComplete="off" />
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" className="min-h-11 rounded-xl" disabled={deleteConfirmation !== 'DELETE' || privacyAction === 'delete'} onClick={() => void handleDeleteAccount()}>
                {privacyAction === 'delete' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete account
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
