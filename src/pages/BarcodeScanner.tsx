import { useEffect, useRef, useState } from 'react';
import Quagga from '@ericblade/quagga2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, ScanLine, Loader2, Plus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { StorageLocation, FoodItem } from '@/types';
import { toast } from 'sonner';

export default function BarcodeScanner() {
  const { addItems } = useApp();
  const navigate = useNavigate();
  const scannerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [location, setLocation] = useState<StorageLocation>('fridge');
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState(false);

  const startScanner = () => {
    if (!scannerRef.current) return;
    setScanning(true);
    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: scannerRef.current,
          constraints: { facingMode: 'environment', width: 640, height: 480 },
        },
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'],
        },
        locate: true,
      },
      (err: any) => {
        if (err) {
          console.error('Quagga init error:', err);
          toast.error('Could not access camera');
          setScanning(false);
          return;
        }
        Quagga.start();
      }
    );

    Quagga.onDetected((result: any) => {
      const code = result?.codeResult?.code;
      if (code) {
        setBarcode(code);
        Quagga.stop();
        setScanning(false);
        lookupBarcode(code);
      }
    });
  };

  const stopScanner = () => {
    try { Quagga.stop(); } catch {}
    setScanning(false);
  };

  useEffect(() => {
    return () => { try { Quagga.stop(); } catch {} };
  }, []);

  const lookupBarcode = async (code: string) => {
    setLooking(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product?.product_name) {
        setProductName(data.product.product_name);
        setFound(true);
        toast.success('Product found!');
      } else {
        setProductName('');
        setFound(false);
        toast.info('Product not found. Enter the name manually.');
      }
    } catch {
      toast.error('Lookup failed. Enter name manually.');
      setFound(false);
    } finally {
      setLooking(false);
    }
  };

  const addItem = () => {
    if (!productName.trim()) return;
    const item: FoodItem = {
      id: `barcode-${Date.now()}`,
      name: productName.trim(),
      quantity: quantity || '1',
      location,
      dateAdded: new Date().toISOString().split('T')[0],
      daysUntilExpiry: location === 'freezer' ? 60 : location === 'cupboard' ? 90 : 7,
      status: 'okay',
    };
    addItems([item]);
    toast.success(`${productName} added!`);
    // Reset for next scan
    setBarcode('');
    setProductName('');
    setQuantity('1');
    setFound(false);
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Barcode Scanner</h1>
        <Button variant="ghost" size="icon" onClick={() => navigate('/add-food')}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Scanner viewport */}
      {!barcode && (
        <div className="space-y-3">
          <div
            ref={scannerRef}
            className="w-full aspect-[4/3] bg-muted rounded-xl overflow-hidden relative border border-border"
          >
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <ScanLine className="w-10 h-10 text-muted-foreground" />
                <Button onClick={startScanner}>Start Scanner</Button>
              </div>
            )}
          </div>
          {scanning && (
            <Button variant="outline" onClick={stopScanner} className="w-full">
              Stop Scanner
            </Button>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Point camera at a product barcode
          </p>
        </div>
      )}

      {/* Barcode found — show product form */}
      {barcode && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">Barcode</p>
            <p className="font-mono text-lg font-bold">{barcode}</p>
          </div>

          {looking ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Looking up product...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Product Name</label>
                <Input
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="Enter product name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Quantity</label>
                  <Input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <Select value={location} onValueChange={v => setLocation(v as StorageLocation)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fridge">Fridge</SelectItem>
                      <SelectItem value="freezer">Freezer</SelectItem>
                      <SelectItem value="cupboard">Cupboard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={addItem} disabled={!productName.trim()} className="w-full">
                <Plus className="w-4 h-4 mr-1" /> Add to Inventory
              </Button>
              <Button variant="outline" onClick={() => { setBarcode(''); setProductName(''); setFound(false); }} className="w-full">
                Scan Another
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
