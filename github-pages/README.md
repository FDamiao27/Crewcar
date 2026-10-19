# Showroom estático (GitHub Pages)

Versão pública do showroom CREW CAR que corre sem servidor, alojada no **GitHub Pages**.
Lê as viaturas, os conteúdos e as definições **em tempo real** do Supabase e grava os
pedidos de contacto diretamente na base de dados.

- Reutiliza os componentes visuais do site principal (`src/components`) através de adaptadores
  (`src/shims`) para `next/link`, `next/navigation` e `next/script`.
- A chave usada no navegador é a chave **publishable** do Supabase (pública por natureza).
  A proteção dos dados é feita pela base de dados (`db/migrations/0004_public_api.sql`):
  só colunas e viaturas públicas; contactos apenas por inserção, com limites anti-spam.
- As fotografias são servidas pelo Supabase Storage (bucket `crewcar`, leitura pública,
  nomes de ficheiro aleatórios, listagem não permitida).
- O **back office não corre no GitHub Pages**: use a aplicação Next.js (no seu computador
  ou alojada, por exemplo, na Vercel) ligada à mesma base de dados Supabase.

## Comandos

```bash
npm run pages:dev        # desenvolvimento em http://localhost:5173/Crewcar/
npm run pages:build      # gera github-pages/dist (inclui 404.html para os endereços internos)
npm run pages:typecheck
```

Variáveis opcionais: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_STORAGE_BUCKET`
e `PAGES_BASE` (por omissão `/Crewcar/`, o nome do repositório).

## Publicar

O conteúdo de `github-pages/dist` é publicado no ramo `gh-pages`. No GitHub:
**Settings → Pages → Build and deployment → Source: Deploy from a branch → `gh-pages` / `(root)`**.
