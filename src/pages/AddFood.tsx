import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { FoodItem, StorageLocation } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Camera, Trash2, Check, Loader2, Image, ScanEye, Refrigerator, Snowflake, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AddFood() {
  const { addItems } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'manual' ? 'manual' : 'choose';

  const [mode, setMode] = useState<'choose' | 'pick-location' | 'scanning' | 'review' | 'manual'>(initialMode);
  const [scannedItems, setScannedItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('');
  const [manualLocation, setManualLocation] = useState<StorageLocation>('fridge');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [scanType, setScanType] = useState<'receipt' | 'fridge'>('receipt');
  const [scanLocation, setScanLocation] = useState<StorageLocation>('fridge');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fridgeCameraRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setReceiptPreview(base64);
      setMode('scanning');

      try {
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
        toast.error(err.message || 'Failed to scan receipt. Try again or add manually.');
        setMode('choose');
      }
    };
    reader.readAsDataURL(file);
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  const removeScanned = (index: number) => {
    setScannedItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateScanned = (index: number, updates: Partial<Omit<FoodItem, 'id'>>) => {
    setScannedItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const saveScanned = () => {
    const items: FoodItem[] = scannedItems.map((item, i) => ({
      ...item,
      id: `new-${Date.now()}-${i}`,
    }));
    addItems(items);
    navigate('/inventory');
  };

  const addManual = () => {
    if (!manualName.trim()) return;
    const item: FoodItem = {
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      quantity: manualQty || '1',
      location: manualLocation,
      dateAdded: new Date().toISOString().split('T')[0],
      daysUntilExpiry: manualLocation === 'freezer' ? 60 : manualLocation === 'cupboard' ? 90 : 7,
      status: 'okay',
    };
    addItems([item]);
    setManualName('');
    setManualQty('');
  };

  if (mode === 'pick-location') {
    const locations = [
      { value: 'fridge' as StorageLocation, label: 'Fridge', icon: Refrigerator, desc: 'Fresh food, dairy, drinks' },
      { value: 'freezer' as StorageLocation, label: 'Freezer', icon: Snowflake, desc: 'Frozen items, ice cream, meat' },
      { value: 'cupboard' as StorageLocation, label: 'Cupboard / Pantry', icon: Archive, desc: 'Dry goods, cans, snacks' },
    ];
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Where are you scanning?</h1>
          <p className="text-sm text-muted-foreground">Pick the location, then take a photo</p>
        </div>
        <div className="space-y-3">
          {locations.map(loc => (
            <button
              key={loc.value}
              onClick={() => { setScanLocation(loc.value); fridgeCameraRef.current?.click(); }}
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
        <h1 className="text-2xl font-bold">Add Food</h1>
        <input
          ref={fridgeCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelected}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelected}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />
        <div className="space-y-3">
          <button
            onClick={() => { setScanType('fridge'); setMode('pick-location'); }}
            className="w-full bg-card border-2 border-primary/20 rounded-xl p-6 text-left hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <ScanEye className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Scan My Kitchen</div>
                <div className="text-sm text-muted-foreground">Point your camera at the fridge, freezer, or cupboard</div>
              </div>
            </div>
          </button>
          <button
            onClick={() => { setScanType('receipt'); cameraInputRef.current?.click(); }}
            className="w-full bg-card border border-border rounded-xl p-6 text-left hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Take Photo of Receipt</div>
                <div className="text-sm text-muted-foreground">Use your camera to scan a grocery receipt</div>
              </div>
            </div>
          </button>
          <button
            onClick={() => { setScanType('receipt'); fileInputRef.current?.click(); }}
            className="w-full bg-card border border-border rounded-xl p-6 text-left hover:border-primary/30 transition-colors"
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
        <div className="space-y-2">
          {scannedItems.map((item, idx) => (
            <div key={idx} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={e => updateScanned(idx, { name: e.target.value })}
                  className="flex-1 h-9 text-sm"
                />
                <Input
                  value={item.quantity}
                  onChange={e => updateScanned(idx, { quantity: e.target.value })}
                  className="w-20 h-9 text-sm"
                />
                <Select value={item.location} onValueChange={v => updateScanned(idx, { location: v as StorageLocation })}>
                  <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fridge">Fridge</SelectItem>
                    <SelectItem value="freezer">Freezer</SelectItem>
                    <SelectItem value="cupboard">Cupboard</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeScanned(idx)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setMode('choose')} className="flex-1">Cancel</Button>
          <Button onClick={saveScanned} className="flex-1">
            <Check className="w-4 h-4 mr-1" /> Add {scannedItems.length} Items
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Quantity</label>
            <Input value={manualQty} onChange={e => setManualQty(e.target.value)} placeholder="e.g. 500g" />
          </div>
          <div>
            <label className="text-sm font-medium">Location</label>
            <Select value={manualLocation} onValueChange={v => setManualLocation(v as StorageLocation)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fridge">Fridge</SelectItem>
                <SelectItem value="freezer">Freezer</SelectItem>
                <SelectItem value="cupboard">Cupboard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={addManual} disabled={!manualName.trim()} className="w-full">
          <Plus className="w-4 h-4 mr-1" /> Add to Inventory
        </Button>
      </div>
      <Button variant="ghost" onClick={() => navigate('/inventory')} className="w-full text-muted-foreground">
        Done Adding Items
      </Button>
    </div>
  );
}
