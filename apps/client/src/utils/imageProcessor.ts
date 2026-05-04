const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 0.8;
const MAX_OUTPUT_SIZE_BYTES = 500 * 1024; // 500 KB

interface ProcessResult {
  blob: Blob;
  name: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function getTargetDimensions(img: HTMLImageElement): { width: number; height: number } {
  if (img.width <= MAX_DIMENSION && img.height <= MAX_DIMENSION) {
    return { width: img.width, height: img.height };
  }
  const ratio = Math.min(MAX_DIMENSION / img.width, MAX_DIMENSION / img.height);
  return {
    width: Math.round(img.width * ratio),
    height: Math.round(img.height * ratio),
  };
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Error al convertir la imagen'));
      },
      type,
      quality,
    );
  });
}

export async function processImage(file: File): Promise<ProcessResult> {
  const img = await fileToImage(file);
  const { width, height } = getTargetDimensions(img);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  // Intentar WebP con calidad ajustada; si no se reduce lo suficiente, re-comprimir
  const outputType = 'image/webp';
  let blob = await canvasToBlob(canvas, outputType, WEBP_QUALITY);
  let quality = WEBP_QUALITY;

  while (blob.size > MAX_OUTPUT_SIZE_BYTES && quality > 0.3) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, outputType, Math.round(quality * 10) / 10);
  }

  if (blob.size > MAX_OUTPUT_SIZE_BYTES) {
    // Fallback a JPEG con mayor compresión
    blob = await canvasToBlob(canvas, 'image/jpeg', 0.6);
    quality = 0.6;
    while (blob.size > MAX_OUTPUT_SIZE_BYTES && quality > 0.2) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, 'image/jpeg', Math.round(quality * 10) / 10);
    }
  }

  const name = file.name.replace(/\.[^.]+$/, '.webp');

  return {
    blob,
    name,
    originalSize: file.size,
    compressedSize: blob.size,
    width,
    height,
  };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
