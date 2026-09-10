import { ArrowRight, Check, Clock, Heart } from 'lucide-react';
import RecipeArtwork from '@/components/RecipeArtwork';
import { cn } from '@/lib/utils';
import type { RecipeMediaVariants } from '@/types';

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
  verificationTier?: 'editorial_reviewed' | 'creator_verified' | 'test_kitchen_verified';
  sourceLabel?: string | null;
  creatorName?: string | null;
  imageVariants?: RecipeMediaVariants;
  priority?: boolean;
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
  verificationTier,
  sourceLabel,
  creatorName,
  imageVariants,
  priority,
}: RecipeCardProps) {
  const trustLabel = verificationTier === 'test_kitchen_verified'
    ? 'Test-kitchen verified'
    : verificationTier === 'creator_verified'
    ? 'Creator verified'
    : verificationTier
    ? 'Editorially reviewed'
    : null;
  return (
    <article className={cn('group animate-fade-in overflow-hidden rounded-[1.65rem] bg-card shadow-[0_16px_50px_rgba(29,52,43,0.09)]', className)}>
      <div className="relative overflow-hidden">
        <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Open ${title}`}>
          <RecipeArtwork
            title={title}
            image={image}
            variants={imageVariants}
            priority={priority}
            className="aspect-[4/5] w-full items-center justify-center"
            imageClassName="transition-transform duration-700 group-hover:scale-[1.025]"
          />
        </button>
        {expiringLabel && (
          <span className="absolute left-3 top-3 max-w-[calc(100%-4rem)] truncate rounded-full bg-[#8b4c25]/95 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-white shadow-sm backdrop-blur-sm">
            Use soon · {expiringLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          aria-label={saved ? `Remove ${title} from saved recipes` : `Save ${title}`}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/90 text-[#173d32] shadow-sm backdrop-blur-sm transition hover:bg-white"
        >
          <Heart className={cn('h-4 w-4', saved && 'fill-current')} />
        </button>
      </div>

      <button type="button" onClick={onOpen} className="block w-full p-5 text-left">
        {(trustLabel || creatorName || sourceLabel) && (
          <p className="mb-2 truncate text-[9px] font-extrabold uppercase tracking-[0.15em] text-primary/75">
            {[trustLabel, creatorName ?? sourceLabel].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 text-xl font-semibold leading-[1.15] tracking-[-0.035em]">{title}</h2>
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0ece3] text-primary transition-transform group-hover:translate-x-1">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
        {reason && <p className="mt-2 line-clamp-1 text-xs leading-relaxed text-muted-foreground">{reason}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-muted-foreground">
          {prepTime && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{prepTime}</span>}
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" />{ownedCount}/{ingredientCount} ingredients</span>
          <span className="ml-auto font-bold text-primary">{matchPercent}% match</span>
        </div>
      </button>
    </article>
  );
}
