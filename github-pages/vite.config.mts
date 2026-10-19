import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Showroom estático para o GitHub Pages. Reutiliza os componentes visuais do site Next.js
// (src/components) e substitui os módulos específicos do Next.js por adaptadores.
const here = path.dirname(fileURLToPath(import.meta.url));

// Projeto Supabase da CREW CAR (a chave "publishable" é pública por natureza).
// Podem ser substituídos pelas variáveis de ambiente com o mesmo nome.
process.env.VITE_SUPABASE_URL ??= "https://havprvfbreiukcchjagl.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_0NA6jCDpNywMyGlA5K7qUw_q2534IWC";
process.env.VITE_STORAGE_BUCKET ??= "crewcar";
const r = (p: string) => path.resolve(here, p);

export default defineConfig({
  root: here,
  base: process.env.PAGES_BASE ?? "/Crewcar/",
  publicDir: r("public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: r("src/shims/next-link.tsx") },
      { find: /^next\/navigation$/, replacement: r("src/shims/next-navigation.ts") },
      { find: /^next\/script$/, replacement: r("src/shims/next-script.tsx") },
      { find: /^@\/lib\/media-base$/, replacement: r("src/shims/media-base.ts") },
      { find: /^@\//, replacement: `${r("../src")}/` },
    ],
  },
  build: { outDir: r("dist"), emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { port: 5173 },
});
