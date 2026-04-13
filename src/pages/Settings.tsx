import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { LogOut, User, Users, Clock, Ban, X, Loader2, Moon, TrendingDown, Bell, ChevronRight, Globe, Wallet, Gauge, Target, Wand2, AlertTriangle, Leaf, UtensilsCrossed, Minus, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import type { PlanningStyle, BudgetSensitivity, CookingConfidence, PrimaryGoal } from '@/types';
import CalorieTracker from '@/components/CalorieTracker';

const DIETARY_OPTIONS = [
  { label: 'Plant-Based', icon: <Leaf className="w-5 h-5" />, desc: 'Prioritizing whole foods from plant sources.' },
  { label: 'Omnivore', icon: <UtensilsCrossed className="w-5 h-5" />, desc: 'Customized restrictions for your lifestyle.' },
  { label: 'Pescatarian', icon: <UtensilsCrossed className="w-5 h-5" />, desc: 'Customized restrictions for your lifestyle.' },
  { label: 'High Protein', icon: <UtensilsCrossed className="w-5 h-5" />, desc: 'Customized restrictions for your lifestyle.' },
];

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
  const { preferences, setPreferences, signOut, session } = useApp();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [dislikedInput, setDislikedInput] = useState('');
  const [allergyInput, setAllergyInput] = useState('');
  const { enabled: notificationsEnabled, permission: notifPermission, toggle: toggleNotifications } = useNotifications();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [darkMode]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(); toast.success('Signed out'); }
    catch { toast.error('Failed to sign out'); }
    finally { setSigningOut(false); }
  };

  const toggleDietary = (pref: string) => {
    const current = preferences.dietaryPreferences;
    const next = current.includes(pref) ? current.filter(p => p !== pref) : [...current, pref];
    setPreferences({ dietaryPreferences: next });
  };

  const toggleCuisine = (item: string) => {
    const current = preferences.preferredCuisines;
    const next = current.includes(item) ? current.filter(c => c !== item) : [...current, item];
    setPreferences({ preferredCuisines: next });
  };

  const addDisliked = () => {
    const val = dislikedInput.trim();
    if (!val || preferences.dislikedIngredients.includes(val)) return;
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
              {DIETARY_OPTIONS.map(opt => {
                const active = preferences.dietaryPreferences.includes(opt.label);
                return (
                  <button
                    key={opt.label}
                    onClick={() => toggleDietary(opt.label)}
                    className={`glass-card p-5 text-left transition-all ${active ? 'ring-2 ring-primary' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-primary">{opt.icon}</div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-primary bg-primary' : 'border-border'}`}>
                        {active && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                    </div>
                    <h3 className="text-sm font-bold mb-1">{opt.label}</h3>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
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
              Recipes and AI-generated meals will stay within this time limit.
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
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="rounded-xl text-xs font-bold uppercase tracking-wider">
              Discard Changes
            </Button>
            <Button className="rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: 'var(--gradient-primary)' }}>
              Update Profile
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
                  <button onClick={() => setPreferences({ householdSize: Math.max(1, preferences.householdSize - 1) })} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-lg font-bold w-6 text-center">{String(preferences.householdSize).padStart(2, '0')}</span>
                  <button onClick={() => setPreferences({ householdSize: preferences.householdSize + 1 })} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Daily Calorie Target</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPreferences({ dailyCalorieGoal: Math.max(1000, preferences.dailyCalorieGoal - 100) })} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-bold w-14 text-center">{preferences.dailyCalorieGoal.toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">kcal</span></span>
                  <button onClick={() => setPreferences({ dailyCalorieGoal: Math.min(5000, preferences.dailyCalorieGoal + 100) })} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted">
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
                { value: 'do-it-for-me' as PlanningStyle, label: 'Automated', desc: 'AI generates your weekly plan based on preferences and inventory.' },
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


          {/* Calorie Tracker */}
          <CalorieTracker />

          {/* Sign out */}
          <Button variant="outline" onClick={handleSignOut} disabled={signingOut} className="w-full rounded-xl text-destructive border-destructive/20 hover:bg-destructive/5">
            {signingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
