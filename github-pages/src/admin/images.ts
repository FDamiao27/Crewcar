import { bucket } from "./core";

// Processamento das fotografias no navegador: valida o ficheiro, aplica a orientação,
// redimensiona e grava versões WebP (sem metadados EXIF/GPS) no Supabase Storage.
// Não há qualquer geração de imagens: apenas são convertidas as fotografias carregadas.

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const PHOTO_WIDTHS = [480, 1024, 1920];
const HERO_WIDTHS = [1024, 1920, 2560];

export class ImageError extends Error {}

export type StoredImage = { key: string; width: number; height: number; bytes: number; variants: number[] };

async function decode(file: File): Promise<ImageBitmap> {
  if (file.size === 0) throw new ImageError(`"${file.name}" está vazio.`);
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageError(`"${file.name}" excede o limite de 15 MB.`);
  if (!ACCEPTED.includes(file.type)) throw new ImageError(`"${file.name}": formato não suportado. Utilize JPEG, PNG, WebP ou AVIF.`);
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError(`"${file.name}" não é uma imagem válida.`);
  }
  if (bmp.width < 200 || bmp.height < 150) {
    bmp.close();
    throw new ImageError(`"${file.name}" é demasiado pequena (mínimo 200 × 150 píxeis).`);
  }
  return bmp;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageError("Falha ao converter a imagem."))), type, quality));
}

async function render(bmp: ImageBitmap, width: number, height: number, type: "image/webp" | "image/png", quality = 0.82): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("O navegador não permite processar imagens.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, width, height);
  let blob = await canvasBlob(canvas, type, quality);
  // Navegadores sem codificação WebP (ex.: Safari) devolvem PNG: usar JPEG em alternativa
  if (type === "image/webp" && blob.type !== "image/webp") blob = await canvasBlob(canvas, "image/jpeg", 0.85);
  return blob;
}

async function put(path: string, blob: Blob) {
  const { error } = await bucket().upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw new ImageError(`Falha ao guardar a imagem: ${error.message}`);
}

async function storeVariants(bmp: ImageBitmap, key: string, widths: number[]): Promise<StoredImage> {
  const targets = [...new Set(widths.map((w) => Math.min(w, bmp.width)))].sort((a, b) => a - b);
  let bytes = 0;
  for (const w of targets) {
    const h = Math.round((bmp.height * w) / bmp.width);
    const blob = await render(bmp, w, h, "image/webp");
    bytes += blob.size;
    await put(`${key}-${w}.webp`, blob);
  }
  return { key, width: bmp.width, height: bmp.height, bytes, variants: targets };
}

export async function processVehiclePhoto(file: File, vehicleId: string): Promise<StoredImage> {
  const bmp = await decode(file);
  try {
    return await storeVariants(bmp, `vehicles/${vehicleId}/${crypto.randomUUID()}`, PHOTO_WIDTHS);
  } finally {
    bmp.close();
  }
}

export async function processSiteImage(file: File, kind: "hero" | "logo" | "favicon" | "og"): Promise<StoredImage> {
  const bmp = await decode(file);
  const key = `site/${kind}-${crypto.randomUUID()}`;
  try {
    if (kind === "hero" || kind === "og") return await storeVariants(bmp, key, kind === "hero" ? HERO_WIDTHS : [1200]);
    if (kind === "logo") {
      const h = Math.min(160, bmp.height);
      const w = Math.round((bmp.width * h) / bmp.height);
      const blob = await render(bmp, w, h, "image/webp", 0.9);
      await put(`${key}-${w}.webp`, blob);
      return { key, width: w, height: h, bytes: blob.size, variants: [w] };
    }
    let bytes = 0;
    const side = Math.min(bmp.width, bmp.height);
    for (const size of [64, 180]) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
      const blob = await canvasBlob(canvas, "image/png", 1);
      bytes += blob.size;
      await put(`${key}-${size}.png`, blob);
    }
    return { key, width: 180, height: 180, bytes, variants: [64, 180] };
  } finally {
    bmp.close();
  }
}

export async function removeFiles(photos: { storageKey: string; variants: number[] }[], ext = "webp") {
  const keys = photos.flatMap((p) => p.variants.map((w) => `${p.storageKey}-${w}.${ext}`));
  for (let i = 0; i < keys.length; i += 500) {
    const { error } = await bucket().remove(keys.slice(i, i + 500));
    if (error) console.warn("Falha ao remover ficheiros", error);
  }
}
