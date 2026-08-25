import { useEffect, useRef, useState } from 'react';
import { BarcodeFormat, BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [location, setLocation] = useState<StorageLocation>('fridge');
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  const stopScanner = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  };

  const startScanner = async () => {
    if (!videoRef.current) return;
    stopScanner();
    setScanning(true);
    try {
      if (!readerRef.current) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);
        readerRef.current = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 250 });
      }
      controlsRef.current = await readerRef.current.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current,
        (result, _error, controls) => {
          const code = result?.getText();
          if (!code) return;
          controls.stop();
          controlsRef.current = null;
          setBarcode(code);
          setScanning(false);
          void lookupBarcode(code);
        },
      );
    } catch (error) {
      console.error('Barcode scanner error:', error);
      toast.error('Could not access the camera. Enter the barcode manually instead.');
      setScanning(false);
    }
  };

  useEffect(() => {
    return () => controlsRef.current?.stop();
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
      provenance: 'barcode',
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
        <Button aria-label="Close barcode scanner" variant="ghost" size="icon" onClick={() => navigate('/add-food')}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Scanner viewport */}
      {!barcode && (
        <div className="space-y-3">
          <div className="w-full aspect-[4/3] bg-muted rounded-xl overflow-hidden relative border border-border">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {!scanning && (
              <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-3">
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
          <div className="flex gap-2">
            <Input
              aria-label="Barcode number"
              inputMode="numeric"
              value={manualBarcode}
              onChange={event => setManualBarcode(event.target.value.replace(/\D/g, '').slice(0, 18))}
              placeholder="Enter barcode manually"
              onKeyDown={event => {
                if (event.key === 'Enter' && manualBarcode.length >= 6) {
                  stopScanner();
                  setBarcode(manualBarcode);
                  void lookupBarcode(manualBarcode);
                }
              }}
            />
            <Button
              variant="outline"
              disabled={manualBarcode.length < 6}
              onClick={() => {
                stopScanner();
                setBarcode(manualBarcode);
                void lookupBarcode(manualBarcode);
              }}
            >
              Look up
            </Button>
          </div>
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
