import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { FoodItem, StorageLocation } from '@/types';
import { MOCK_RECEIPT_ITEMS } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScanLine, Plus, Upload, Trash2, Check, Loader2 } from 'lucide-react';

export default function AddFood() {
  const { addItems } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'manual' ? 'manual' : 'choose';

  const [mode, setMode] = useState<'choose' | 'scanning' | 'review' | 'manual'>(initialMode);
  const [scannedItems, setScannedItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('');
  const [manualLocation, setManualLocation] = useState<StorageLocation>('fridge');

  const simulateScan = () => {
    setMode('scanning');
    setTimeout(() => {
      setScannedItems([...MOCK_RECEIPT_ITEMS]);
      setMode('review');
    }, 2000);
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

  if (mode === 'choose') {
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold">Add Food</h1>
        <div className="space-y-3">
          <button
            onClick={simulateScan}
            className="w-full bg-card border border-border rounded-xl p-6 text-left hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <ScanLine className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Scan Receipt</div>
                <div className="text-sm text-muted-foreground">Upload a photo of your grocery receipt</div>
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
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <h2 className="text-xl font-bold">Scanning Receipt...</h2>
        <p className="text-sm text-muted-foreground mt-1">Extracting items with AI</p>
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
