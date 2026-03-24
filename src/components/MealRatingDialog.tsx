import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Star } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (rating: number, wouldRepeat: boolean) => Promise<void>;
}

export default function MealRatingDialog({ open, title, onClose, onSubmit }: Props) {
  const [rating, setRating] = useState(4);
  const [wouldRepeat, setWouldRepeat] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(rating, wouldRepeat);
    setSubmitting(false);
    setRating(4);
    setWouldRepeat(true);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">Rate this meal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm font-medium truncate">{title}</p>

          {/* Star rating */}
          <div className="flex items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className="p-1 transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    n <= rating ? 'fill-amber-400 text-amber-400' : 'text-border'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {rating <= 2 ? 'Not great' : rating === 3 ? 'It was okay' : rating === 4 ? 'Really good' : 'Loved it!'}
          </p>

          {/* Would repeat */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Would you have this again?</span>
            <Switch checked={wouldRepeat} onCheckedChange={setWouldRepeat} />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full rounded-xl">
            {submitting ? 'Saving...' : 'Save Rating'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
