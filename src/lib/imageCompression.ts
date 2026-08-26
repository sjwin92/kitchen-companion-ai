export interface CompressedImage {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read compressed image'));
    reader.readAsDataURL(blob);
  });
}

export async function compressImage(
  file: File,
  options: { maxDimension?: number; quality?: number } = {},
): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a JPEG, PNG or WebP image');
  const maxDimension = options.maxDimension ?? 1280;
  const quality = options.quality ?? 0.75;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable in this browser');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not compress image')), 'image/jpeg', quality);
  });
  return { blob, dataUrl: await blobToDataUrl(blob), width, height };
}
