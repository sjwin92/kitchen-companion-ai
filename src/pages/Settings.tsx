import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Users, Clock, Ban, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Halal', 'Kosher', 'Nut-Free'];

export default function Settings() {
  const { preferences, setPreferences, signOut, session } = useApp();
  const [signingOut, setSigningOut] = useState(false);
  const [dislikedInput, setDislikedInput] = useState('');

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
    const next = current.includes(pref)
      ? current.filter(p => p !== pref)
      : [...current, pref];
    setPreferences({ dietaryPreferences: next });
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

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Account */}
      <section className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{preferences.displayName || session?.user?.email}</p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Display Name</label>
          <Input
            value={preferences.displayName}
            onChange={e => setPreferences({ displayName: e.target.value })}
            placeholder="Your name"
          />
        </div>
        <Button
          variant="destructive"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full"
        >
          {signingOut ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
          Sign Out
        </Button>
      </section>

      {/* Household */}
      <section className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Household Size</h2>
        </div>
        <Select
          value={String(preferences.householdSize)}
          onValueChange={v => setPreferences({ householdSize: Number(v) })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'person' : 'people'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Cooking Time */}
      <section className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Preferred Cooking Time</h2>
        </div>
        <Select
          value={preferences.cookingTime}
          onValueChange={v => setPreferences({ cookingTime: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="15 min">15 min</SelectItem>
            <SelectItem value="30 min">30 min</SelectItem>
            <SelectItem value="45 min">45 min</SelectItem>
            <SelectItem value="60+ min">60+ min</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {/* Dietary Preferences */}
      <section className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm">Dietary Preferences</h2>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map(opt => (
            <Badge
              key={opt}
              variant={preferences.dietaryPreferences.includes(opt) ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => toggleDietary(opt)}
            >
              {opt}
            </Badge>
          ))}
        </div>
      </section>

      {/* Disliked Ingredients */}
      <section className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Ban className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Disliked Ingredients</h2>
        </div>
        <div className="flex gap-2">
          <Input
            value={dislikedInput}
            onChange={e => setDislikedInput(e.target.value)}
            placeholder="e.g. Cilantro"
            onKeyDown={e => e.key === 'Enter' && addDisliked()}
            className="flex-1"
          />
          <Button size="sm" onClick={addDisliked} disabled={!dislikedInput.trim()}>Add</Button>
        </div>
        {preferences.dislikedIngredients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {preferences.dislikedIngredients.map(item => (
              <Badge key={item} variant="secondary" className="gap-1">
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
  );
}
