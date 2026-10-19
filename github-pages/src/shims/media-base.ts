import { STORAGE_BUCKET, SUPABASE_URL } from "../config";

// Ficheiros servidos diretamente pelo Supabase Storage (bucket com leitura pública).
export function mediaBase(): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}`;
}

export function mediaUrl(key: string): string {
  return `${mediaBase()}/${key}`;
}
