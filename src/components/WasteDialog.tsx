import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import type { FoodItem } from '@/types';

interface Props {
  item: FoodItem | null;
  open: boolean;
  onClose: () => void;
}

export default function WasteDialog({ item, open, onClose }: Props) {
  const { removeItem, session } = useApp();
  const [reason, setReason] = useState('expired');
  const [loading, setLoading] = useState(false);

  const handleDiscard = async () => {
    if (!item || !session?.user) return;
    setLoading(true);
    await supabase.from('waste_log').insert({
      user_id: session.user.id,
      name: item.name,
      quantity: item.quantity,
      reason,
    });
    await removeItem(item.id);
    setLoading(false);
    toast.success(`${item.name} logged as waste`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Discard {item?.name}?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Reason</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="spoiled">Spoiled</SelectItem>
                <SelectItem value="not-needed">Not needed</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={handleDiscard} disabled={loading} className="flex-1">
              Discard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
