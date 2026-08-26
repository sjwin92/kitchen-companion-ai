import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useApp } from '@/context/AppContext';
import { compressImage } from '@/lib/imageCompression';

interface Props {
  open: boolean;
  onClose: () => void;
  shoppingItems: { id: string; name: string }[];
  onReconciled: () => void;
}

interface ExtractedReceipt {
  items: { name: string; price?: number }[];
  total: number;
  retailer?: string;
}

export default function ReceiptReconcileDialog({ open, onClose, shoppingItems, onReconciled }: Props) {
  const { session } = useApp();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    matched: { id: string; name: string }[];
    unmatched: { name: string; price?: number }[];
    total: number;
    retailer?: string;
  } | null>(null);
  const [totalOverride, setTotalOverride] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!session?.user) return;
    setBusy(true);
    try {
      const { dataUrl: base64 } = await compressImage(file, { maxDimension: 1280, quality: 0.75 });

      const { data, error } = await supabase.functions.invoke('reconcile-receipt', {
        body: { imageBase64: base64 },
      });

      if (error) throw error;
      const r = data as ExtractedReceipt;
      if (!r || !Array.isArray(r.items)) throw new Error('Could not read receipt');

      // Fuzzy match against shopping list
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').trim();
      const matched: { id: string; name: string }[] = [];
      const unmatched: { name: string; price?: number }[] = [];
      const matchedIds = new Set<string>();

      for (const item of r.items) {
        const itemTokens = norm(item.name).split(/\s+/).filter(Boolean);
        const hit = shoppingItems.find(s => {
          if (matchedIds.has(s.id)) return false;
          const sTokens = norm(s.name).split(/\s+/).filter(Boolean);
          return sTokens.some(t => t.length >= 3 && itemTokens.some(it => it.includes(t) || t.includes(it)));
        });
        if (hit) {
          matched.push(hit);
          matchedIds.add(hit.id);
        } else {
          unmatched.push(item);
        }
      }

      setResult({ matched, unmatched, total: r.total || 0, retailer: r.retailer });
      setTotalOverride(String(r.total || ''));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to process receipt');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!result || !session?.user) return;
    setBusy(true);
    const finalTotal = parseFloat(totalOverride) || result.total || 0;

    // Tick matched items
    if (result.matched.length > 0) {
      await supabase
        .from('shopping_list')
        .update({ checked: true })
        .in('id', result.matched.map(m => m.id));
    }

    // Log reconciliation
    await supabase.from('receipt_reconciliations').insert({
      user_id: session.user.id,
      total_gbp: finalTotal,
      matched_items: result.matched as Json,
      unmatched_items: result.unmatched as Json,
      retailer: result.retailer || null,
      receipt_date: new Date().toISOString().slice(0, 10),
    });

    toast.success(`Logged £${finalTotal.toFixed(2)} · ticked ${result.matched.length} items`);
    setResult(null);
    setTotalOverride('');
    setBusy(false);
    onReconciled();
    onClose();
  };

  const handleClose = () => {
    if (busy) return;
    setResult(null);
    setTotalOverride('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Receipt</DialogTitle>
        </DialogHeader>

        {!result && (
          <>
            <p className="text-xs text-muted-foreground -mt-1">
              Snap a photo of your grocery receipt. We'll auto-tick items on your list and log the total spend.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full rounded-xl gap-2"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {busy ? 'Reading receipt…' : 'Take or upload photo'}
            </Button>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Receipt total (£)
              </label>
              <Input
                value={totalOverride}
                onChange={e => setTotalOverride(e.target.value)}
                type="number"
                step="0.01"
                className="mt-1"
              />
            </div>
            <div className="rounded-xl bg-success/10 p-3">
              <p className="text-xs font-bold text-success mb-1.5 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> {result.matched.length} matched items
              </p>
              {result.matched.length > 0 && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {result.matched.map(m => m.name).join(', ')}
                </p>
              )}
            </div>
            {result.unmatched.length > 0 && (
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs font-bold mb-1.5">{result.unmatched.length} items not on list</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {result.unmatched.slice(0, 10).map(m => m.name).join(', ')}
                  {result.unmatched.length > 10 && ` +${result.unmatched.length - 10} more`}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={busy}>Cancel</Button>
          {result && (
            <Button onClick={handleConfirm} disabled={busy} style={{ background: 'var(--gradient-primary)' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm & Log Spend
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
