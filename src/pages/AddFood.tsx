import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Barcode } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { FoodItem, StorageLocation } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Plus, Camera, Trash2, Check, Loader2, Image, ScanEye, Refrigerator, Snowflake, Archive, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { errorMessage } from '@/lib/appError';
import { toast } from 'sonner';
import LiveScanner from '@/components/LiveScanner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCapabilities } from '@/hooks/useCapabilities';

const LOCATION_BUTTONS: { value: StorageLocation; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
  { value: 'fridge', label: 'Fridge', icon: <Refrigerator className="w-3.5 h-3.5" />, color: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400', activeColor: 'bg-emerald-500 text-white border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600' },
  { value: 'freezer', label: 'Freezer', icon: <Snowflake className="w-3.5 h-3.5" />, color: 'border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400', activeColor: 'bg-blue-500 text-white border-blue-500 dark:bg-blue-600 dark:border-blue-600' },
  { value: 'cupboard', label: 'Cupboard', icon: <Archive className="w-3.5 h-3.5" />, color: 'border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400', activeColor: 'bg-amber-500 text-white border-amber-500 dark:bg-amber-600 dark:border-amber-600' },
];

export default function AddFood() {
  const { addItems, preferences } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'manual' ? 'manual' : 'choose';

  const [mode, setMode] = useState<'choose' | 'pick-location' | 'live-scan' | 'scanning' | 'review' | 'manual'>(initialMode);
  const [scannedItems, setScannedItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('');
  const [manualLocation, setManualLocation] = useState<StorageLocation>('fridge');
  const [manualExpiry, setManualExpiry] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [scanType, setScanType] = useState<'receipt' | 'fridge'>('receipt');
  const [scanLocation, setScanLocation] = useState<StorageLocation>('fridge');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fridgeCameraRef = useRef<HTMLInputElement>(null);
  const expiryInputRef = useRef<HTMLInputElement>(null);
  const [scanningExpiry, setScanningExpiry] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const { getCapability, isLoading: capabilitiesLoading } = useCapabilities();
  const visionAvailable = getCapability('inventory_vision')?.available ?? false;
  const receiptAvailable = getCapability('receipt_extraction')?.available ?? false;

  const handleExpiryScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    
    try {
      setScanningExpiry(true);
      toast.loading('Scanning expiry dates...', { id: 'expiry-scan' });
      const base64 = await compressImage(file);
      
      const { data, error } = await supabase.functions.invoke('scan-expiry', {
        body: { imageBase64: base64, itemNames: scannedItems.map(i => i.name) },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const expiryResults = data.results || [];
      let matched = 0;
      setScannedItems(prev => prev.map(item => {
        const match = expiryResults.find((r: any) => 
          r.itemName.toLowerCase() === item.name.toLowerCase() ||
          item.name.toLowerCase().includes(r.itemName.toLowerCase()) ||
          r.itemName.toLowerCase().includes(item.name.toLowerCase())
        );
        if (match?.expiryDate) {
          matched++;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const exp = new Date(match.expiryDate);
          exp.setHours(0, 0, 0, 0);
          const diffDays = Math.max(0, Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
          return {
            ...item,
            expiryDate: match.expiryDate,
            daysUntilExpiry: diffDays,
            status: diffDays <= 1 ? 'use-today' as const : diffDays <= 3 ? 'use-soon' as const : 'okay' as const,
          };
        }
        return item;
      }));

      toast.dismiss('expiry-scan');
      if (matched > 0) {
        toast.success(`Updated expiry for ${matched} item${matched > 1 ? 's' : ''}`);
      } else {
        toast.info('Could not match any expiry dates to your items. Try a clearer photo.');
      }
    } catch (err: any) {
      toast.dismiss('expiry-scan');
      toast.error(err.message || 'Failed to scan expiry dates');
    } finally {
      setScanningExpiry(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so the same file can be re-selected
    e.target.value = '';

    try {
      const { dataUrl: base64 } = await compressImage(file, { maxDimension: 1200, quality: 0.7 });
      setReceiptPreview(base64);
      setMode('scanning');

      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: { imageBase64: base64, mode: scanType, storageLocation: scanLocation },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const items = data.items || [];
      if (items.length === 0) {
        toast.info('No food items found. Try a clearer photo or add manually.');
        setMode('choose');
        return;
      }

      setScannedItems(items);
      setMode('review');
      toast.success(`Found ${items.length} item${items.length > 1 ? 's' : ''}!`);
    } catch (err: any) {
      console.error('Receipt scan failed:', err);
      toast.error(err.message || 'Failed to scan. Try again or add manually.');
      setMode('choose');
    }
  };

  const removeScanned = (index: number) => {
    setScannedItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateScanned = (index: number, updates: Partial<Omit<FoodItem, 'id'>>) => {
    setScannedItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const saveScanned = async () => {
    const items: FoodItem[] = scannedItems.map((item, i) => ({
      ...item,
      id: `new-${Date.now()}-${i}`,
    }));
    setSavingItems(true);
    try {
      await addItems(items);
      toast.success(`Added ${items.length} item${items.length === 1 ? '' : 's'} to your kitchen`);
      navigate('/inventory');
    } catch (error) {
      toast.error(errorMessage(error, 'Your items were not saved. Please try again.'));
    } finally {
      setSavingItems(false);
    }
  };

  const addManual = async () => {
    if (!manualName.trim()) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fallbackDays = manualLocation === 'freezer' ? 60 : manualLocation === 'cupboard' ? 90 : 7;
    const expiry = manualExpiry ? new Date(`${manualExpiry}T00:00:00`) : null;
    const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000) : fallbackDays;
    const status: FoodItem['status'] = daysUntilExpiry < 0
      ? 'expired'
      : daysUntilExpiry === 0
        ? 'use-today'
        : daysUntilExpiry <= 3
          ? 'use-soon'
          : 'okay';
    const item: FoodItem = {
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      quantity: manualQty || '1',
      location: manualLocation,
      dateAdded: new Date().toISOString().split('T')[0],
      daysUntilExpiry,
      expiryDate: manualExpiry || undefined,
      status,
    };
    setSavingItems(true);
    try {
      await addItems([item]);
      setManualName('');
      setManualQty('');
      setManualExpiry('');
      toast.success(`${item.name} added`);
    } catch (error) {
      toast.error(errorMessage(error, 'This item was not saved. Please try again.'));
    } finally {
      setSavingItems(false);
    }
  };

  const hiddenInputs = (
    <>
      <input ref={fridgeCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelected} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelected} />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
    </>
  );

  if (mode === 'live-scan') {
    return (
      <LiveScanner
        location={scanLocation}
        dietaryPreferences={preferences.dietaryPreferences}
        onComplete={(items) => {
          setScannedItems(items);
          setMode('review');
          toast.success(`Found ${items.length} item${items.length > 1 ? 's' : ''}!`);
        }}
        onCancel={() => setMode('choose')}
      />
    );
  }

  if (mode === 'pick-location') {
    const locations = [
      { value: 'fridge' as StorageLocation, label: 'Fridge', icon: Refrigerator, desc: 'Fresh food, dairy, drinks' },
      { value: 'freezer' as StorageLocation, label: 'Freezer', icon: Snowflake, desc: 'Frozen items, ice cream, meat' },
      { value: 'cupboard' as StorageLocation, label: 'Cupboard / Pantry', icon: Archive, desc: 'Dry goods, cans, snacks' },
    ];
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
        {hiddenInputs}
        <div>
          <h1 className="text-2xl font-bold">Where are you scanning?</h1>
          <p className="text-sm text-muted-foreground">Pick a location to open live scanner</p>
        </div>
        <div className="space-y-3">
          {locations.map(loc => (
            <button
              key={loc.value}
              onClick={() => { setScanLocation(loc.value); setMode('live-scan'); }}
              className="w-full bg-card border border-border rounded-xl p-5 text-left hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <loc.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">{loc.label}</div>
                  <div className="text-sm text-muted-foreground">{loc.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => setMode('choose')} className="w-full text-muted-foreground">
          ← Back
        </Button>
      </div>
    );
  }

  if (mode === 'choose') {
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
        {hiddenInputs}
        <h1 className="text-2xl font-bold">Add Food</h1>
        {!capabilitiesLoading && (!visionAvailable || !receiptAvailable) && (
          <div className="rounded-2xl border border-border/70 bg-[#f6f1e8] p-4 text-sm text-[#29463c]">
            Photo capture is not configured yet. Manual entry and barcode lookup are still available.
          </div>
        )}
        <div className="space-y-3">
          <button
            disabled={!visionAvailable}
            onClick={() => { setScanType('fridge'); setMode('pick-location'); }}
            className="w-full bg-card border-2 border-primary/20 rounded-xl p-6 text-left hover:border-primary/50 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <ScanEye className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Scan My Kitchen</div>
                <div className="text-sm text-muted-foreground">{capabilitiesLoading ? 'Checking availability…' : visionAvailable ? 'Point your camera at the fridge, freezer, or cupboard' : 'Unavailable — use barcode or manual entry'}</div>
              </div>
            </div>
          </button>
          <button
            disabled={!receiptAvailable}
            onClick={() => { setScanType('receipt'); cameraInputRef.current?.click(); }}
            className="w-full bg-card border border-border rounded-xl p-6 text-left hover:border-primary/30 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Take Photo of Receipt</div>
                <div className="text-sm text-muted-foreground">{receiptAvailable ? 'Use your camera to scan a grocery receipt' : 'Unavailable — add items manually'}</div>
              </div>
            </div>
          </button>
          <button
            disabled={!receiptAvailable}
            onClick={() => { setScanType('receipt'); fileInputRef.current?.click(); }}
            className="w-full bg-card border border-border rounded-xl p-6 text-left hover:border-primary/30 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Image className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Upload Receipt Photo</div>
                <div className="text-sm text-muted-foreground">Choose an existing photo from your gallery</div>
              </div>
            </div>
          </button>
          <button
            onClick={() => navigate('/barcode')}
            className="w-full bg-card border border-border rounded-xl p-6 text-left hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Barcode className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Scan Barcode</div>
                <div className="text-sm text-muted-foreground">Scan a product barcode for auto-fill</div>
              </div>
            </div>
          </button>
          <button
            onClick={() => setMode('manual')}
            className="w-full bg-card border border-border rounded-xl p-6 text-left hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Add Manually</div>
                <div className="text-sm text-muted-foreground">Type in items one by one</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'scanning') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
        {receiptPreview && (
          <div className="w-32 h-40 rounded-xl overflow-hidden mb-4 border border-border shadow-sm">
            <img src={receiptPreview} alt="Receipt" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <h2 className="text-xl font-bold">
          {scanType === 'fridge' ? `Scanning ${scanLocation === 'freezer' ? 'Freezer' : scanLocation === 'cupboard' ? 'Cupboard' : 'Fridge'}...` : 'Scanning Receipt...'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{scanType === 'fridge' ? 'Identifying items with AI' : 'Extracting items with AI'}</p>
      </div>
    );
  }

  if (mode === 'review') {
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto space-y-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Review Items</h1>
          <p className="text-sm text-muted-foreground">Edit items before adding to your inventory</p>
        </div>

        {/* Scan Expiry Dates prompt */}
        <button
          onClick={() => {
            toast.info('Take a photo of the expiry dates on your products');
            expiryInputRef.current?.click();
          }}
          className="w-full bg-card border border-dashed border-primary/30 rounded-xl p-3.5 text-left hover:border-primary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">📸 Scan Expiry Dates</div>
              <div className="text-xs text-muted-foreground">Take a photo of product labels to auto-extract dates</div>
            </div>
          </div>
        </button>
        <input ref={expiryInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleExpiryScan} />

        <div className="space-y-2">
          {scannedItems.map((item, idx) => (
            <div key={idx} className="bg-card border border-border rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={e => updateScanned(idx, { name: e.target.value })}
                  className="flex-1 h-9 text-sm"
                  placeholder="Item name"
                />
                <Input
                  value={item.quantity}
                  onChange={e => updateScanned(idx, { quantity: e.target.value })}
                  className="w-20 h-9 text-sm"
                  placeholder="Qty"
                />
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeScanned(idx)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {/* Color-coded location buttons */}
              <div className="flex gap-1.5">
                {LOCATION_BUTTONS.map(loc => (
                  <button
                    key={loc.value}
                    onClick={() => updateScanned(idx, { location: loc.value })}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium border-2 transition-all duration-150 ${
                      item.location === loc.value ? loc.activeColor : loc.color
                    }`}
                  >
                    {loc.icon}
                    {loc.label}
                  </button>
                ))}
              </div>
              {/* Expiry info */}
              {item.expiryDate ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="w-3 h-3" />
                  <span>Exp: {new Date(item.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground/60 italic">~{item.daysUntilExpiry}d estimated expiry</div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setMode('choose')} className="flex-1">Cancel</Button>
          <Button onClick={saveScanned} disabled={savingItems} className="flex-1">
            {savingItems ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
            {savingItems ? 'Saving…' : `Add ${scannedItems.length} Items`}
          </Button>
        </div>
      </div>
    );
  }

  // Manual mode
  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Add Item</h1>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Item Name</label>
          <Input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="e.g. Chicken Breast" />
        </div>
        <div>
          <label className="text-sm font-medium">Quantity</label>
          <Input value={manualQty} onChange={e => setManualQty(e.target.value)} placeholder="e.g. 500g" />
        </div>
        <div>
          <label className="text-sm font-medium">Location</label>
          <div className="flex gap-1.5 mt-1">
            {LOCATION_BUTTONS.map(loc => (
              <button
                key={loc.value}
                type="button"
                onClick={() => setManualLocation(loc.value)}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border-2 text-xs font-medium transition-all duration-150 ${
                  manualLocation === loc.value ? loc.activeColor : loc.color
                }`}
              >
                {loc.icon}
                {loc.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="manual-expiry" className="text-sm font-medium">Expiry date <span className="font-normal text-muted-foreground">(optional)</span></label>
          <Input id="manual-expiry" type="date" value={manualExpiry} onChange={event => setManualExpiry(event.target.value)} className="mt-1 h-11" />
          <p className="mt-1 text-xs text-muted-foreground">Leave blank and we’ll use a storage-based estimate you can edit later.</p>
        </div>
        <Button onClick={addManual} disabled={!manualName.trim() || savingItems} className="min-h-11 w-full">
          {savingItems ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          {savingItems ? 'Saving…' : 'Add to Inventory'}
        </Button>
      </div>
      <Button variant="ghost" onClick={() => navigate('/inventory')} className="w-full text-muted-foreground">
        Done Adding Items
      </Button>
    </div>
  );
}
