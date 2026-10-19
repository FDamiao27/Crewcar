import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { storage } from "@/lib/storage";

// Processamento das fotografias carregadas pelo administrador: validação do formato real
// (não apenas da extensão), orientação automática, remoção de metadados (inclui GPS/EXIF)
// e criação de versões redimensionadas em WebP. Não há qualquer geração de imagens.

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 30;
export const ACCEPTED_FORMATS = ["jpeg", "png", "webp", "avif"] as const;
export const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp,image/avif";

export const PHOTO_WIDTHS = [480, 1024, 1920] as const;
export const HERO_WIDTHS = [1024, 1920, 2560] as const;

export class ImageError extends Error {}

export type StoredImage = {
  key: string; // chave base, sem largura nem extensão
  width: number;
  height: number;
  bytes: number;
  variants: number[];
};

async function readImage(file: File): Promise<Buffer> {
  if (file.size === 0) throw new ImageError(`"${file.name}" está vazio.`);
  if (file.size > MAX_UPLOAD_BYTES)
    throw new ImageError(`"${file.name}" excede o limite de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  const buffer = Buffer.from(await file.arrayBuffer());
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buffer, { limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new ImageError(`"${file.name}" não é uma imagem válida.`);
  }
  if (!meta.format || !(ACCEPTED_FORMATS as readonly string[]).includes(meta.format === "heif" ? "avif" : meta.format))
    throw new ImageError(`"${file.name}": formato não suportado. Utilize JPEG, PNG, WebP ou AVIF.`);
  if (!meta.width || !meta.height || meta.width < 200 || meta.height < 150)
    throw new ImageError(`"${file.name}" é demasiado pequena (mínimo 200 × 150 píxeis).`);
  return buffer;
}

async function storeVariants(buffer: Buffer, keyBase: string, widths: readonly number[], quality = 82) {
  const oriented = sharp(buffer, { limitInputPixels: 60_000_000 }).rotate();
  const meta = await sharp(buffer).metadata();
  // As orientações EXIF 5–8 trocam largura e altura.
  const swap = (meta.orientation ?? 1) >= 5;
  const origW = (swap ? meta.height : meta.width) ?? 0;
  const origH = (swap ? meta.width : meta.height) ?? 0;
  const targets = Array.from(new Set(widths.map((w) => Math.min(w, origW)))).sort((a, b) => a - b);
  let totalBytes = 0;
  for (const w of targets) {
    const out = await oriented.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality }).toBuffer();
    totalBytes += out.length;
    await storage().put(`${keyBase}-${w}.webp`, out, "image/webp");
  }
  return { width: origW, height: origH, bytes: totalBytes, variants: targets };
}

export async function processVehiclePhoto(file: File, vehicleId: string): Promise<StoredImage> {
  const buffer = await readImage(file);
  const key = `vehicles/${vehicleId}/${randomUUID()}`;
  const result = await storeVariants(buffer, key, PHOTO_WIDTHS);
  return { key, ...result };
}

export async function processSiteImage(
  file: File,
  kind: "hero" | "logo" | "favicon" | "og",
): Promise<StoredImage> {
  const buffer = await readImage(file);
  const key = `site/${kind}-${randomUUID()}`;
  if (kind === "hero" || kind === "og") {
    return { key, ...(await storeVariants(buffer, key, kind === "hero" ? HERO_WIDTHS : [1200], 80)) };
  }
  if (kind === "logo") {
    const out = await sharp(buffer).rotate().resize({ height: 160, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    await storage().put(`${key}-${out.info.width}.webp`, out.data, "image/webp");
    return { key, width: out.info.width, height: out.info.height, bytes: out.data.length, variants: [out.info.width] };
  }
  // Favicon: PNG quadrado 64×64 e 180×180 (apple-touch-icon)
  const variants: number[] = [];
  let bytes = 0;
  for (const size of [64, 180]) {
    const out = await sharp(buffer).rotate().resize(size, size, { fit: "cover" }).png().toBuffer();
    bytes += out.length;
    variants.push(size);
    await storage().put(`${key}-${size}.png`, out, "image/png");
  }
  return { key, width: 180, height: 180, bytes, variants };
}

export function variantKeys(key: string, variants: number[], ext = "webp"): string[] {
  return variants.map((w) => `${key}-${w}.${ext}`);
}
