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
- O **back office** está em `/admin` (`src/admin`): login com o **Supabase Auth** e os mesmos
  ecrãs do back office Next.js (`src/components/admin`), com as ações substituídas por versões
  que usam a API do Supabase (`src/admin/actions`, ligadas por aliases no `vite.config.mts`).
  Só entra quem tiver conta no Supabase Auth **e** um registo ativo em `admin_users` com o mesmo
  e-mail; as permissões são aplicadas pela base de dados (`db/migrations/0005_admin_api.sql`).
  A criação de contas e a redefinição de palavras-passe usam a função `supabase/functions/admin-users`
  (a chave de serviço nunca chega ao navegador).

## Primeiro acesso ao back office

1. No Supabase: **Authentication → Sign In / Providers → desativar “Allow new users to sign up”**
   (não pode existir registo público de administradores).
2. **Authentication → URL Configuration → Site URL:** `https://crew-car.pt`.
3. **Authentication → Users → Add user → Create new user** com o seu e-mail e uma palavra-passe
   forte (marque “Auto Confirm User”).
4. No **SQL Editor**, registe-se como proprietário:
   `insert into admin_users (email, name, role) values ('o-seu-email@exemplo.pt', 'O seu nome', 'owner');`
5. Entre em `https://crew-car.pt/admin`. Os restantes utilizadores são criados em **Utilizadores**.

## Comandos

```bash
npm run pages:dev        # desenvolvimento em http://localhost:5173/
npm run pages:build      # gera github-pages/dist (inclui 404.html para os endereços internos)
npm run pages:typecheck
```

Variáveis opcionais: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_STORAGE_BUCKET`
e `PAGES_BASE` (por omissão `/`, para o domínio próprio **crew-car.pt**; use `/Crewcar/` para publicar em fdamiao27.github.io/Crewcar/ sem domínio próprio — nesse caso remova `public/CNAME`).

## Publicar

O conteúdo de `github-pages/dist` é publicado no ramo `gh-pages`. No GitHub:
**Settings → Pages → Build and deployment → Source: Deploy from a branch → `gh-pages` / `(root)`**.

Domínio próprio: `public/CNAME` contém `crew-car.pt`. DNS no registo do domínio: registos A `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (e AAAA `2606:50c0:8000::153` … `8003::153`) para `crew-car.pt`, e CNAME `www` → `fdamiao27.github.io`.
