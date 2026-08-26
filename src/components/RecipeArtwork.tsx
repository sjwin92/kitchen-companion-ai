import { useState } from 'react';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecipeArtworkProps {
  title: string;
  image?: string | null;
  className?: string;
  imageClassName?: string;
}

export default function RecipeArtwork({ title, image, className, imageClassName }: RecipeArtworkProps) {
  const [failed, setFailed] = useState(false);

  if (image && !failed) {
    return (
      <div className={cn('overflow-hidden bg-[#e9e4da]', className)}>
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
      className={cn('relative flex overflow-hidden bg-[#173d32] text-white', className)}
      role="img"
      aria-label={`${title}; photography not yet available`}
    >
      <div className="absolute left-[12%] top-[15%] h-[70%] w-[70%] rounded-full border border-white/15 bg-[#f3eee4]/95 shadow-[0_22px_50px_rgba(5,25,20,0.25)]" />
      <div className="absolute left-[28%] top-[31%] flex h-[38%] w-[38%] items-center justify-center rounded-full border border-[#173d32]/10 bg-[#d9c8a8] text-[#173d32] shadow-inner">
        <Leaf className="h-7 w-7 opacity-70" strokeWidth={1.5} />
      </div>
      <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
        <p className="max-w-[75%] text-xs font-semibold leading-tight text-white/90">{title}</p>
        <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/50">Image pending</span>
      </div>
    </div>
  );
}
