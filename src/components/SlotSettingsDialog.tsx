import { useState, useEffect } from 'react';
import type { MealSlot } from '@/hooks/useMealPlans';
import type { SlotSettings } from '@/hooks/useMealSlotSettings';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Clock, Gauge, Users, Leaf, Wallet, Baby, Apple } from 'lucide-react';

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '☀️ Lunch',
  dinner: '🌙 Dinner',
  snack: '🍎 Snack',
};

const TIME_OPTIONS = ['10 min', '15 min', '20 min', '30 min', '45 min', '60+ min'];
const COMPLEXITY_OPTIONS = [
  { value: 'simple', label: 'Simple' },
  { value: 'medium', label: 'Medium' },
  { value: 'complex', label: 'Complex' },
];

const CUISINE_OPTIONS = ['Any', 'Italian', 'Mexican', 'Indian', 'Chinese', 'Japanese', 'Thai', 'Mediterranean', 'Middle Eastern', 'Korean', 'French', 'American', 'British'];

interface Props {
  slot: MealSlot | null;
  settings: SlotSettings | null;
  onClose: () => void;
  onSave: (slot: MealSlot, updates: Partial<SlotSettings>) => Promise<void>;
}

export default function SlotSettingsDialog({ slot, settings, onClose, onSave }: Props) {
  const [form, setForm] = useState<Partial<SlotSettings>>({});

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  if (!slot || !settings) return null;

  const update = (key: keyof SlotSettings, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    await onSave(slot, form);
    onClose();
  };

  return (
    <Dialog open={!!slot} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{SLOT_LABELS[slot]} Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prep time */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Target Prep Time
            </label>
            <Select value={form.target_prep_time || '30 min'} onValueChange={v => update('target_prep_time', v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Complexity */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" /> Complexity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COMPLEXITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update('complexity', opt.value)}
                  className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                    form.complexity === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Servings */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Servings
            </label>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl"
                onClick={() => update('servings', Math.max(1, (form.servings || 2) - 1))}>−</Button>
              <span className="text-lg font-bold w-6 text-center">{form.servings || 2}</span>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl"
                onClick={() => update('servings', Math.min(12, (form.servings || 2) + 1))}>+</Button>
            </div>
          </div>

          {/* Cuisine preference */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5" /> Cuisine Preference
            </label>
            <Select value={form.cuisine_preference || 'Any'} onValueChange={v => update('cuisine_preference', v === 'Any' ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CUISINE_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Bias toggles */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Preferences</p>
            <div className="space-y-2.5">
              {[
                { key: 'quick_bias' as const, label: 'Quick meals', icon: <Clock className="w-3.5 h-3.5" /> },
                { key: 'family_friendly_bias' as const, label: 'Family-friendly', icon: <Baby className="w-3.5 h-3.5" /> },
                { key: 'pantry_first_bias' as const, label: 'Use pantry first', icon: <Apple className="w-3.5 h-3.5" /> },
                { key: 'budget_friendly_bias' as const, label: 'Budget-friendly', icon: <Wallet className="w-3.5 h-3.5" /> },
              ].map(({ key, label, icon }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">{icon} {label}</span>
                  <Switch checked={!!form[key]} onCheckedChange={v => update(key, v)} />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} className="w-full rounded-xl">Save Settings</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
