import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { LogOut, User, Users, Clock, Ban, X, Loader2, Moon, TrendingDown, Bell, ChevronRight, Globe, Wallet, Gauge, Target, Wand2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import type { PlanningStyle, BudgetSensitivity, CookingConfidence, PrimaryGoal } from '@/types';
import CalorieTracker from '@/components/CalorieTracker';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Halal', 'Kosher', 'Nut-Free'];
const COMMON_ALLERGIES = ['Peanuts', 'Tree Nuts', 'Shellfish', 'Dairy', 'Eggs', 'Soy', 'Wheat', 'Fish', 'Sesame'];
const CUISINE_OPTIONS = ['Italian', 'Mexican', 'Indian', 'Chinese', 'Japanese', 'Thai', 'Mediterranean', 'Middle Eastern', 'Korean', 'French', 'American', 'British'];

export default function Settings() {
  const { preferences, setPreferences, signOut, session } = useApp();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [dislikedInput, setDislikedInput] = useState('');
  const [allergyInput, setAllergyInput] = useState('');
  const { enabled: notificationsEnabled, permission: notifPermission, toggle: toggleNotifications } = useNotifications();
  const [darkMode, setDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      toast.success('Signed out');
    } catch {
      toast.error('Failed to sign out');
    } finally {
      setSigningOut(false);
    }
  };

  const toggleDietary = (pref: string) => {
    const current = preferences.dietaryPreferences;
    const next = current.includes(pref) ? current.filter(p => p !== pref) : [...current, pref];
    setPreferences({ dietaryPreferences: next });
  };

  const toggleAllergy = (item: string) => {
    const current = preferences.allergies;
    const next = current.includes(item) ? current.filter(a => a !== item) : [...current, item];
    setPreferences({ allergies: next });
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

  const chipClass = (active: boolean) =>
    `cursor-pointer select-none rounded-xl px-3 py-1 text-xs font-medium border transition-all ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:border-primary/40'
    }`;

  const chipDestructive = (active: boolean) =>
    `cursor-pointer select-none rounded-xl px-3 py-1 text-xs font-medium border transition-all ${
      active ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-card text-foreground border-border hover:border-destructive/40'
    }`;

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Account */}
      <section className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: '0ms', animationFillMode: 'backwards' }}>
        <div className="flex items-center gap-3">
          <div className="icon-container bg-primary/10">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{preferences.displayName || session?.user?.email}</p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Display Name</label>
          <Input
            value={preferences.displayName}
            onChange={e => setPreferences({ displayName: e.target.value })}
            placeholder="Your name"
            className="mt-1"
          />
        </div>
      </section>

      {/* Toggles group */}
      <div className="glass-card divide-y divide-border/50 animate-fade-in" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="icon-container bg-muted">
              <Moon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Switch themes</p>
            </div>
          </div>
          <Switch checked={darkMode} onCheckedChange={setDarkMode} />
        </div>

        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="icon-container bg-warning/10">
              <Bell className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-sm font-semibold">Expiry Reminders</p>
              <p className="text-xs text-muted-foreground">Daily notifications</p>
            </div>
          </div>
          <Switch
            checked={notificationsEnabled}
            disabled={notifPermission === 'denied'}
            onCheckedChange={async (checked) => {
              const ok = await toggleNotifications(checked);
              if (checked && ok) toast.success('Notifications enabled!');
              else if (checked && !ok) toast.error('Notification permission denied by browser');
              else if (!checked) toast.success('Notifications disabled');
            }}
          />
        </div>

        <button onClick={() => navigate('/waste')} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="icon-container bg-destructive/10">
              <TrendingDown className="w-4 h-4 text-destructive" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">Waste Tracker</p>
              <p className="text-xs text-muted-foreground">View waste stats & trends</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Planning Style */}
      <div className="space-y-3">
        <h2 className="section-title px-1">Planning Style</h2>
        <section className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm">How should we help?</h3>
          </div>
          <div className="space-y-2">
            {([
              { value: 'pick-myself' as PlanningStyle, label: 'Pick It Myself', desc: 'I choose my own meals' },
              { value: 'help-choose' as PlanningStyle, label: 'Help Me Choose', desc: 'Suggest options, I decide' },
              { value: 'do-it-for-me' as PlanningStyle, label: 'Do It For Me', desc: 'Plan meals automatically' },
            ]).map(opt => (
              <button key={opt.value} onClick={() => setPreferences({ planningStyle: opt.value })}
                className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                  preferences.planningStyle === opt.value ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/30'
                }`}>
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: '140ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Primary Goal</h3>
          </div>
          <Select value={preferences.primaryGoal} onValueChange={v => setPreferences({ primaryGoal: v as PrimaryGoal })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="save-time">Save Time</SelectItem>
              <SelectItem value="eat-healthier">Eat Healthier</SelectItem>
              <SelectItem value="reduce-waste">Reduce Waste</SelectItem>
              <SelectItem value="family-friendly">Family-Friendly</SelectItem>
              <SelectItem value="variety">More Variety</SelectItem>
            </SelectContent>
          </Select>
        </section>
      </div>

      {/* Preferences */}
      <div className="space-y-3">
        <h2 className="section-title px-1">Preferences</h2>

        <section className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Household Size</h3>
          </div>
          <Select value={String(preferences.householdSize)} onValueChange={v => setPreferences({ householdSize: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'person' : 'people'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <section className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: '180ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Cooking Time</h3>
          </div>
          <Select value={preferences.cookingTime} onValueChange={v => setPreferences({ cookingTime: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15 min">15 min</SelectItem>
              <SelectItem value="30 min">30 min</SelectItem>
              <SelectItem value="45 min">45 min</SelectItem>
              <SelectItem value="60+ min">60+ min</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Cooking Confidence</h3>
          </div>
          <Select value={preferences.cookingConfidence} onValueChange={v => setPreferences({ cookingConfidence: v as CookingConfidence })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">🍳 Beginner</SelectItem>
              <SelectItem value="intermediate">👨‍🍳 Comfortable</SelectItem>
              <SelectItem value="advanced">🔪 Confident</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: '220ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Budget</h3>
          </div>
          <Select value={preferences.budgetSensitivity} onValueChange={v => setPreferences({ budgetSensitivity: v as BudgetSensitivity })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Budget-Friendly</SelectItem>
              <SelectItem value="medium">Balanced</SelectItem>
              <SelectItem value="high">No Limit</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: '240ms', animationFillMode: 'backwards' }}>
          <h3 className="font-semibold text-sm">Dietary Preferences</h3>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map(opt => (
              <button key={opt} onClick={() => toggleDietary(opt)} className={chipClass(preferences.dietaryPreferences.includes(opt))}>
                {opt}
              </button>
            ))}
          </div>
        </section>

        <section className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: '260ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="font-semibold text-sm">Allergies</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {COMMON_ALLERGIES.map(opt => (
              <button key={opt} onClick={() => toggleAllergy(opt)} className={chipDestructive(preferences.allergies.includes(opt))}>
                {opt}
              </button>
            ))}
          </div>
          {preferences.allergies.filter(a => !COMMON_ALLERGIES.includes(a)).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {preferences.allergies.filter(a => !COMMON_ALLERGIES.includes(a)).map(item => (
                <Badge key={item} variant="destructive" className="gap-1 rounded-xl">
                  {item}
                  <button onClick={() => setPreferences({ allergies: preferences.allergies.filter(a => a !== item) })}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input value={allergyInput} onChange={e => setAllergyInput(e.target.value)} placeholder="Add other..." onKeyDown={e => e.key === 'Enter' && addAllergy()} className="flex-1" />
            <Button size="sm" onClick={addAllergy} disabled={!allergyInput.trim()} className="rounded-xl">Add</Button>
          </div>
        </section>

        <section className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: '280ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Preferred Cuisines</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {CUISINE_OPTIONS.map(opt => (
              <button key={opt} onClick={() => toggleCuisine(opt)} className={chipClass(preferences.preferredCuisines.includes(opt))}>
                {opt}
              </button>
            ))}
          </div>
        </section>

        <section className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Disliked Ingredients</h3>
          </div>
          <div className="flex gap-2">
            <Input value={dislikedInput} onChange={e => setDislikedInput(e.target.value)} placeholder="e.g. Cilantro" onKeyDown={e => e.key === 'Enter' && addDisliked()} className="flex-1" />
            <Button size="sm" onClick={addDisliked} disabled={!dislikedInput.trim()} className="rounded-xl">Add</Button>
          </div>
          {preferences.dislikedIngredients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {preferences.dislikedIngredients.map(item => (
                <Badge key={item} variant="secondary" className="gap-1 rounded-xl">
                  {item}
                  <button onClick={() => removeDisliked(item)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Sign out */}
      <Button
        variant="outline"
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full rounded-xl text-destructive border-destructive/20 hover:bg-destructive/5"
      >
        {signingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
        Sign Out
      </Button>
    </div>
  );
}
