import { useState } from 'react';
import { cn } from '@/lib/utils';

interface RecipeArtworkProps {
  title: string;
  image?: string | null;
  className?: string;
  imageClassName?: string;
}

const FALLBACKS = [
  'from-[#e7d9c8] to-[#c9d6c0]',
  'from-[#d9dfce] to-[#b9cbbd]',
  'from-[#ead8c8] to-[#d7c2a7]',
  'from-[#d9d5c9] to-[#c5d2c0]',
];

function recipeEmoji(title: string) {
  const value = title.toLowerCase();
  if (/(oat|breakfast|porridge)/.test(value)) return '🥣';
  if (/(pasta|orzo|noodle)/.test(value)) return '🍝';
  if (/(soup|dal|stew|curry)/.test(value)) return '🍲';
  if (/(taco|wrap)/.test(value)) return '🌮';
  if (/(rice|risotto)/.test(value)) return '🍚';
  if (/(salad|bowl|greens)/.test(value)) return '🥗';
  return '🍽️';
}

export default function RecipeArtwork({ title, image, className, imageClassName }: RecipeArtworkProps) {
  const [failed, setFailed] = useState(false);
  const palette = FALLBACKS[title.length % FALLBACKS.length];

  if (image && !failed) {
    return (
      <div className={cn('overflow-hidden bg-muted', className)}>
        <img
          src={image}
          alt={title}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={cn('h-full w-full object-cover', imageClassName)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn('relative overflow-hidden bg-gradient-to-br', palette, className)}
      role="img"
      aria-label={`${title} illustration`}
    >
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/40 bg-white/20" />
      <div className="absolute -bottom-10 -left-8 h-32 w-32 rounded-full border border-white/30 bg-white/10" />
      <span className="relative text-4xl drop-shadow-sm" aria-hidden="true">{recipeEmoji(title)}</span>
    </div>
  );
}
