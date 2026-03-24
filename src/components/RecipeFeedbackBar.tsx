import { ThumbsUp, ThumbsDown, EyeOff, Pin } from 'lucide-react';
import { useInteractions } from '@/hooks/useInteractions';
import { useStapleMeals } from '@/hooks/useStapleMeals';
import { toast } from 'sonner';

interface Props {
  recipeId: string;
  recipeTitle: string;
  recipeImage?: string;
  recipeCategory?: string;
  compact?: boolean;
}

export default function RecipeFeedbackBar({ recipeId, recipeTitle, recipeImage, recipeCategory, compact }: Props) {
  const { track } = useInteractions();
  const { isStaple, toggleStaple } = useStapleMeals();
  const stapled = isStaple(recipeId);

  const handleLike = async () => {
    await track('recipe_liked', { recipeId, recipeTitle });
    toast.success('Liked!');
  };

  const handleDislike = async () => {
    await track('recipe_disliked', { recipeId, recipeTitle });
    toast('Hidden from future suggestions');
  };

  const handleHide = async () => {
    await track('recipe_hidden', { recipeId, recipeTitle });
    toast('Recipe hidden');
  };

  const handleStaple = async () => {
    await toggleStaple(recipeId, recipeTitle, recipeImage, recipeCategory);
    if (!stapled) {
      await track('meal_saved_as_staple', { recipeId, recipeTitle });
      toast.success('Saved as staple meal');
    } else {
      toast('Removed from staples');
    }
  };

  const btnClass = compact
    ? 'p-1.5 rounded-lg hover:bg-muted transition-colors'
    : 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-muted transition-colors text-xs font-medium';
  const iconSize = compact ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5';

  return (
    <div className={compact ? 'flex items-center gap-1' : 'flex items-center gap-2 flex-wrap'}>
      <button onClick={handleLike} className={btnClass} title="Like">
        <ThumbsUp className={`${iconSize} text-muted-foreground`} />
        {!compact && <span>Like</span>}
      </button>
      <button onClick={handleDislike} className={btnClass} title="Not for me">
        <ThumbsDown className={`${iconSize} text-muted-foreground`} />
        {!compact && <span>Not for me</span>}
      </button>
      <button onClick={handleHide} className={btnClass} title="Hide">
        <EyeOff className={`${iconSize} text-muted-foreground`} />
        {!compact && <span>Hide</span>}
      </button>
      <button onClick={handleStaple} className={`${btnClass} ${stapled ? '!bg-primary/10 !border-primary/30' : ''}`} title={stapled ? 'Remove staple' : 'Save as staple'}>
        <Pin className={`${iconSize} ${stapled ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
        {!compact && <span>{stapled ? 'Staple' : 'Make staple'}</span>}
      </button>
    </div>
  );
}
