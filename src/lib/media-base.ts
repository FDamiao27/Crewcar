// Endereço base dos ficheiros carregados (fotografias, logótipo, imagens do site).
// No site Next.js, os ficheiros passam pela rota /media (com verificação de publicação).
// O showroom estático (GitHub Pages) substitui este módulo pelo endereço do Supabase Storage.
export function mediaBase(): string {
  return "/media";
}

export function mediaUrl(key: string): string {
  return `${mediaBase()}/${key}`;
}
