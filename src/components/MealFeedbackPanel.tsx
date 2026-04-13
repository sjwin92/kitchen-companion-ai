import { useState } from 'react';
import { FEEDBACK_OPTIONS, type FeedbackType } from '@/hooks/useMealFeedback';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';

interface MealFeedbackPanelProps {
  mealId: string;
  existingFeedback?: FeedbackType[];
  onSubmit: (mealId: string, feedbackType: FeedbackType, note?: string) => Promise<any>;
}

export default function MealFeedbackPanel({ mealId, existingFeedback = [], onSubmit }: MealFeedbackPanelProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (type: FeedbackType) => {
    setSubmitting(true);
    await onSubmit(mealId, type, note || undefined);
    setSubmitting(false);
    setNote('');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageCircle className="w-3 h-3" />
        Feedback
      </button>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-muted/50 border border-border/40 space-y-2 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">How was this meal?</p>
        <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-foreground/10">
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FEEDBACK_OPTIONS.map(opt => {
          const isSelected = existingFeedback.includes(opt.type);
          return (
            <button
              key={opt.type}
              onClick={() => !isSelected && handleSubmit(opt.type)}
              disabled={submitting || isSelected}
              className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                isSelected
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border hover:bg-accent hover:border-accent'
              } ${submitting ? 'opacity-50' : ''}`}
            >
              {opt.emoji} {opt.label}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Optional note..."
        className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
    </div>
  );
}
