import { useState, useRef, useEffect, useCallback } from 'react';
import { FoodItem, StorageLocation } from '@/types';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { X, ScanEye, Check, Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';

interface LiveScannerProps {
  location: StorageLocation;
  onComplete: (items: Omit<FoodItem, 'id'>[]) => void;
  onCancel: () => void;
}

type ScanPreset = 'auto' | 'manual';

const AUTO_SCAN_INTERVAL_MS = 7000;
const ERROR_TOAST_COOLDOWN_MS = 12000;

export default function LiveScanner({ location, onComplete, onCancel }: LiveScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef(false);
  const lastErrorToastAtRef = useRef(0);

  const [items, setItems] = useState<Omit<FoodItem, 'id'>[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isManualScanning, setIsManualScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationLabel = location === 'freezer' ? 'Freezer' : location === 'cupboard' ? 'Cupboard' : 'Fridge';

  // Start camera
  useEffect(() => {
    let mounted = true;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraReady(true);
          };
        }
      } catch (err) {
        console.error('Camera error:', err);
        setError('Could not access camera. Please allow camera permissions and try again.');
      }
    };
    startCamera();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const captureFrame = useCallback((preset: ScanPreset = 'auto'): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return null;

    // Keep payload very small for reliable background scans;
    // manual snap keeps a bit more detail while still constrained.
    const maxSide = preset === 'manual' ? 420 : 320;
    const quality = preset === 'manual' ? 0.3 : 0.22;

    let w = video.videoWidth;
    let h = video.videoHeight;

    if (w > maxSide) {
      h = Math.round((h * maxSide) / w);
      w = maxSide;
    }
    if (h > maxSide) {
      w = Math.round((w * maxSide) / h);
      h = maxSide;
    }

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }, []);

  const processFrame = useCallback(async (preset: ScanPreset = 'auto') => {
    if (isScanningRef.current) return;

    isScanningRef.current = true;
    setIsProcessing(true);
    if (preset === 'manual') setIsManualScanning(true);

    try {
      const frame = captureFrame(preset);
      if (!frame) {
        isScanningRef.current = false;
        setIsProcessing(false);
        if (preset === 'manual') setIsManualScanning(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: { imageBase64: frame, mode: 'fridge', storageLocation: location },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const newItems: Omit<FoodItem, 'id'>[] = data.items || [];
      if (newItems.length > 0) {
        setItems(prev => {
          const merged = [...prev];
          for (const item of newItems) {
            const exists = merged.some(
              existing => existing.name.toLowerCase() === item.name.toLowerCase()
            );
            if (!exists) merged.push(item);
          }
          return merged;
        });
        setScanCount(c => c + 1);
      }
    } catch (err: any) {
      console.error('Scan frame error:', err);
      const now = Date.now();
      if (now - lastErrorToastAtRef.current > ERROR_TOAST_COOLDOWN_MS) {
        toast.error('Scan request failed. Keep camera steady and tap Snap to log.');
        lastErrorToastAtRef.current = now;
      }
    } finally {
      isScanningRef.current = false;
      setIsProcessing(false);
      if (preset === 'manual') setIsManualScanning(false);
    }
  }, [captureFrame, location]);

  // Auto-scan on an interval once camera is ready
  useEffect(() => {
    if (!cameraReady) return;

    const firstScan = setTimeout(() => {
      processFrame('auto');
    }, 900);

    const interval = setInterval(() => {
      processFrame('auto');
    }, AUTO_SCAN_INTERVAL_MS);

    return () => {
      clearTimeout(firstScan);
      clearInterval(interval);
    };
  }, [cameraReady, processFrame]);

  const handleDone = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (items.length === 0) {
      toast.info('No items detected. Try pointing the camera at food items.');
      return;
    }
    onComplete(items);
  };

  const handleManualSnap = () => {
    processFrame('manual');
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-center text-destructive font-medium">{error}</p>
        <Button onClick={onCancel}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col">
      {/* Camera feed */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 pt-12 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Scanning {locationLabel}</h2>
            <p className="text-white/70 text-xs">Move camera slowly across items</p>
          </div>
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Scanning indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {isProcessing && (
            <div className="flex flex-col items-center gap-2 animate-pulse">
              <div className="w-48 h-48 border-2 border-white/50 rounded-2xl flex items-center justify-center">
                <ScanEye className="w-10 h-10 text-white/80" />
              </div>
              <span className="text-white/80 text-sm font-medium bg-black/40 px-3 py-1 rounded-full">
                Analyzing...
              </span>
            </div>
          )}
          {!isProcessing && cameraReady && (
            <div className="w-48 h-48 border-2 border-white/30 rounded-2xl flex items-center justify-center">
              <ScanEye className="w-10 h-10 text-white/40" />
            </div>
          )}
        </div>

        {/* Manual quick-snap assist while scanner stays open */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <Button
            type="button"
            variant="secondary"
            onClick={handleManualSnap}
            disabled={!cameraReady || isProcessing}
            className="h-11 rounded-full px-5 shadow-lg"
          >
            {isManualScanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            {isManualScanning ? 'Snapping…' : 'Snap to log'}
          </Button>
        </div>

        {/* Scan pulse */}
        {isProcessing && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary animate-pulse" />
        )}
      </div>

      {/* Bottom panel — detected items */}
      <div className="bg-background rounded-t-3xl -mt-6 relative z-10 flex flex-col max-h-[45%]">
        <div className="p-4 pb-2 flex items-center justify-between">
          <div>
            <span className="font-bold text-lg">{items.length} item{items.length !== 1 ? 's' : ''} found</span>
            {scanCount > 0 && (
              <span className="text-xs text-muted-foreground ml-2">
                ({scanCount} scan{scanCount !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          {isProcessing && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
        </div>

        {/* Scrollable item list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-3 text-center">
              {cameraReady ? 'Point camera at food items or tap Snap to log...' : 'Starting camera...'}
            </p>
          )}
          <div className="space-y-1.5">
            {items.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2 animate-fade-in"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{item.quantity}</span>
                </div>
                <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive ml-2 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-4 pt-2 flex gap-3 border-t border-border">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleDone} className="flex-1" disabled={items.length === 0}>
            <Check className="w-4 h-4 mr-1" /> Done ({items.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
