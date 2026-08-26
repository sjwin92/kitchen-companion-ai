import { ArrowUpRight, Check, Clock, Heart } from 'lucide-react';
import RecipeArtwork from '@/components/RecipeArtwork';
import { cn } from '@/lib/utils';

interface RecipeCardProps {
  title: string;
  image?: string;
  prepTime?: string;
  matchPercent: number;
  ownedCount: number;
  ingredientCount: number;
  reason?: string;
  expiringLabel?: string;
  saved?: boolean;
  onOpen: () => void;
  onSave: () => void;
  className?: string;
}

export default function RecipeCard({
  title,
  image,
  prepTime,
  matchPercent,
  ownedCount,
  ingredientCount,
  reason,
  expiringLabel,
  saved,
  onOpen,
  onSave,
  className,
}: RecipeCardProps) {
  return (
    <article className={cn('recipe-card group animate-fade-in', className)}>
      <div className="relative">
        <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Open ${title}`}>
          <RecipeArtwork
            title={title}
            image={image}
            className="aspect-[4/3] w-full flex items-center justify-center"
            imageClassName="transition-transform duration-500 group-hover:scale-[1.025]"
          />
        </button>
        {expiringLabel && (
          <span className="absolute left-3 top-3 max-w-[calc(100%-4rem)] truncate rounded-full bg-[#9a5a27] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
            Use soon · {expiringLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          aria-label={saved ? `Remove ${title} from saved recipes` : `Save ${title}`}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/90 text-[#35463d] shadow-sm transition hover:bg-white"
        >
          <Heart className={cn('h-4 w-4', saved && 'fill-current')} />
        </button>
      </div>

      <button type="button" onClick={onOpen} className="block w-full p-4 text-left">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          {prepTime && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{prepTime}</span>}
          {prepTime && <span aria-hidden="true">·</span>}
          <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-primary" />{ownedCount}/{ingredientCount} in your kitchen</span>
        </div>
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 text-[17px] font-extrabold leading-snug tracking-[-0.015em]">{title}</h2>
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{matchPercent}% pantry match</span>
          {reason && <span className="truncate text-[11px] text-muted-foreground">{reason}</span>}
        </div>
      </button>
    </article>
  );
}
