# CREW CAR — Showroom automóvel e back office

Aplicação web completa para o stand automóvel **CREW CAR** (mercado português):

- **Showroom público**: página inicial, catálogo com pesquisa, filtros e ordenação, página própria de cada viatura (galeria, características, equipamento, preços e descontos), página "O Stand", contactos com formulário e páginas legais.
- **Back office privado** (`/admin`): painel com indicadores reais, gestão completa de viaturas, fotografias, preços e promoções, stock (importação/exportação CSV), contactos (CRM), conteúdos do website, definições gerais e utilizadores.

Todo o design é feito em código (HTML semântico, Tailwind CSS, componentes React, ícones vetoriais). **O projeto não gera nem depende de geração de imagens**: as fotografias são apenas as que carrega no back office; sem fotografias, é apresentado um marcador neutro em CSS.

---

## Arquitetura

| Camada | Tecnologia |
| --- | --- |
| Frontend e servidor | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Estilo | Tailwind CSS 4, tipografia Inter / Manrope (alojadas localmente), ícones Lucide |
| Base de dados | PostgreSQL (local, **Supabase**, Neon, RDS…) com o cliente `postgres` |
| Autenticação | Própria, no servidor: palavras-passe com bcrypt, sessões em base de dados com cookies `HttpOnly` |
| Armazenamento de fotografias | Disco local **ou** qualquer serviço compatível com S3 (**Supabase Storage**, AWS S3, Cloudflare R2) |
| Imagens | `sharp`: validação do formato real, orientação, remoção de metadados (incl. GPS) e versões WebP responsivas |
| Testes | Vitest (unitários) e Playwright (integração ponta a ponta + acessibilidade com axe) |

**Porquê PostgreSQL + autenticação própria em vez do cliente Supabase?** A aplicação usa o Supabase como base de dados PostgreSQL e como armazenamento (S3), mas a lógica de acesso corre exclusivamente no servidor. Isto permite:

- testar tudo localmente sem serviços externos;
- nunca expor chaves privilegiadas no navegador (não existe nenhuma variável `NEXT_PUBLIC_*` com credenciais);
- não depender de um fornecedor específico (funciona em qualquer PostgreSQL);
- manter as **políticas de acesso na base de dados** (ver Segurança).

### Estrutura

```
db/migrations/        Esquema SQL (tabelas, restrições, índices, triggers, RLS e permissões)
scripts/              Migrações, dados iniciais, criação de administradores, dados de demonstração
src/app/(site)/       Showroom público
src/app/admin/        Back office (login, páginas e server actions)
src/app/api/          Carregamento de fotografias, exportação CSV, pré-visualização
src/app/media/        Entrega das fotografias (com verificação de publicação)
src/components/       Componentes reutilizáveis (ui, site, admin)
src/lib/              Base de dados, autenticação, preços, validação, armazenamento, consultas
tests/                Testes unitários e de integração
```

---

## Instalação local

Requisitos: **Node.js 20.9+** e **PostgreSQL 14+**.

```bash
npm install
cp .env.example .env.local          # e ajuste DATABASE_URL e APP_SECRET
npm run db:migrate                  # cria as tabelas, regras e permissões
npm run db:seed                     # definições, conteúdos e modelos das páginas legais
npm run admin:create -- --email o.seu@email.pt --name "O seu nome"
npm run dev                         # http://localhost:3000 e http://localhost:3000/admin
```

O comando `admin:create` apresenta uma palavra-passe temporária (ou use `--password`). Altere-a em **A minha conta** após o primeiro acesso. **Não existe registo público de administradores**: novas contas são criadas pelo proprietário em **Utilizadores** ou por este comando.

### Dados de demonstração (opcional)

```bash
npm run db:seed:demo                 # 9 viaturas de exemplo, sem fotografias
npm run db:seed:demo -- --remover    # remove-as
```

As viaturas de demonstração têm referências `DEMO-…`, mostram o aviso **"Conteúdo de demonstração"** no showroom e podem ser removidas no back office (**Viaturas → Remover demonstração**). Os dados técnicos destas viaturas são fictícios e servem apenas para testar o funcionamento.

---

## Colocar em produção com Supabase

### 1. Base de dados

1. Crie um projeto em [supabase.com](https://supabase.com) (região UE, por exemplo `eu-west-3` Paris ou `eu-central-1` Frankfurt).
2. Em **Project Settings → Database → Connection string**, copie a ligação **Session pooler** (ou a ligação direta) com o utilizador `postgres`.
3. Defina `DATABASE_URL` com essa ligação e execute, a partir do seu computador:
   ```bash
   DATABASE_URL="postgresql://postgres.xxxx:PALAVRA-PASSE@aws-0-eu-west-3.pooler.supabase.com:5432/postgres" npm run db:migrate
   DATABASE_URL="…" npm run db:seed
   DATABASE_URL="…" npm run admin:create -- --email o.seu@email.pt --name "O seu nome"
   ```
   Se usar o pooler em **modo transação** (porta 6543), defina também `DATABASE_PREPARE=false`.

   **Sem terminal?** Abra no Supabase **SQL Editor → New query**, cole o conteúdo de [`db/supabase-setup.sql`](db/supabase-setup.sql) e carregue em **Run**. Cria todas as tabelas, regras de segurança e dados iniciais (o ficheiro é regenerado com `npm run db:supabase-sql` sempre que houver novas migrações). No fim do ficheiro há um exemplo comentado para criar o primeiro administrador.

### 2. Armazenamento das fotografias (Supabase Storage)

1. Em **Storage**, crie um bucket **privado** chamado, por exemplo, `crewcar`.
2. Em **Project Settings → Storage → S3 Connection**, ative o acesso S3 e crie uma chave de acesso.
3. Configure:
   ```
   STORAGE_DRIVER=s3
   S3_ENDPOINT=https://<projeto>.supabase.co/storage/v1/s3
   S3_REGION=<região do projeto>
   S3_BUCKET=crewcar
   S3_ACCESS_KEY_ID=…
   S3_SECRET_ACCESS_KEY=…
   ```

O bucket permanece privado: as fotografias são servidas pela aplicação em `/media/…`, que só as entrega ao público quando a viatura está publicada.

### 3. Alojamento da aplicação

**Vercel** (recomendado com Supabase): importe o repositório, defina as variáveis de ambiente (`DATABASE_URL`, `SITE_URL=https://o-seu-dominio.pt`, `APP_SECRET`, `STORAGE_DRIVER=s3` e `S3_*`) e publique. Com `STORAGE_DRIVER=local` os ficheiros não persistem em plataformas serverless — use S3.

**Servidor próprio / VPS com Docker**:

```bash
docker compose up -d --build                     # aplicação + PostgreSQL + volume para fotografias
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
docker compose exec app npm run admin:create -- --email o.seu@email.pt --name "O seu nome"
```

Coloque um proxy HTTPS (Caddy, Nginx, Traefik) à frente da porta 3000 e defina `SITE_URL` com `https://`. Com HTTPS, os cookies de sessão passam a usar o prefixo `__Host-` e a flag `Secure`, e é ativado o HSTS.

### Showroom no GitHub Pages (sem servidor)

O GitHub Pages só aloja ficheiros estáticos. Para isso existe uma versão estática do showroom
em [`github-pages/`](github-pages/README.md), que lê os dados em tempo real do Supabase e grava os
pedidos de contacto diretamente na base de dados. O back office continua a ser a aplicação
Next.js (no seu computador ou alojada), ligada à mesma base de dados.

Endereço: **https://crew-car.pt/** (domínio próprio, depois de ativar o GitHub Pages no repositório e de configurar o DNS — ver [`github-pages/README.md`](github-pages/README.md)).

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | sim | Ligação PostgreSQL |
| `SITE_URL` | sim | Endereço público (SEO, sitemap, partilhas, cookies seguros) |
| `APP_SECRET` | sim | Segredo aleatório (≥ 32 caracteres) para os tokens anti-spam |
| `STORAGE_DRIVER` | não | `local` (por omissão) ou `s3` |
| `STORAGE_LOCAL_DIR` | não | Diretório das fotografias com `local` (por omissão `./storage`) |
| `S3_*` | com `s3` | Endpoint, região, bucket e credenciais |
| `DATABASE_POOL_SIZE` | não | Ligações simultâneas (por omissão 10) |
| `DATABASE_PREPARE` | não | `false` para poolers em modo transação |

---

## Funcionalidades principais

### Showroom
- Página inicial com secção principal editável (título, texto, botões, fotografia própria ou fundo em CSS), pesquisa rápida, destaques, chegadas recentes, apresentação, vantagens e perguntas frequentes (apenas quando configuradas) e contactos.
- Catálogo com pesquisa por marca/modelo/palavras-chave, filtros (marca, modelo dependente da marca, preço, ano, quilometragem, combustível, caixa, categoria), ordenação, contagem de resultados, filtros ativos removíveis, paginação e URLs partilháveis.
- Página da viatura: galeria com miniaturas, navegação por teclado/gestos e ecrã inteiro; características (só as preenchidas); equipamento e extras; garantia apenas quando marcada como verificada; ligações públicas; WhatsApp, chamada, partilha; formulário de contacto; viaturas semelhantes; dados estruturados `schema.org/Car`.
- Viaturas vendidas saem do catálogo e dos destaques; a página indica "Vendida" (configurável). Viaturas não publicadas ou arquivadas devolvem 404.

### Preços e descontos (regras legais)
- O desconto é sempre calculado sobre o **preço de venda base**; existe **uma única promoção por período** (garantido por uma restrição de exclusão na base de dados) — não há descontos acumulados.
- Tipos: valor (€), percentagem (%) ou preço final promocional. Promoções podem ser agendadas (início/fim) e terminadas.
- O **preço anterior** mostrado é calculado automaticamente como o **preço mais baixo praticado nos 30 dias anteriores à redução** (Diretiva (UE) 2019/2161 — "Omnibus", transposta pelo DL n.º 109-G/2021). Se não for possível demonstrar um preço anterior mais alto, a redução não é anunciada como desconto.
- Histórico de preços registado automaticamente por trigger na base de dados.

### Back office
- Painel com indicadores calculados dos dados reais e lista de tarefas de configuração.
- Viaturas: criar, editar (separadores), duplicar (incluindo fotografias), pré-visualizar, publicar/retirar, destacar, reservar, vender, arquivar/restaurar, eliminar com confirmação escrita; aviso de alterações por guardar.
- Fotografias: carregamento múltiplo com progresso, arrastar e largar para reordenar (e setas, para teclado), fotografia principal, texto alternativo e legenda, substituição e remoção.
- Preços: tabela com edição rápida do preço, gestão de promoções, histórico e pré-visualização pública.
- Stock: tabela com filtros, ações rápidas, exportação e importação CSV (análise prévia, validação, deteção de duplicados de referência e VIN).
- Contactos (CRM): estados Novo / Em contacto / Em negociação / Convertido / Perdido, notas internas, histórico, pesquisa, outros pedidos do mesmo cliente, eliminação (RGPD).
- Conteúdos: rascunho → pré-visualização → publicação; banners com datas; vantagens; FAQ; rodapé; SEO; páginas legais com pré-visualização ao vivo.
- Definições: marca, logótipo, favicon, cores, tipografia, contactos, redes sociais, dados legais, fuso horário, cookies, ferramentas de análise e publicação.
- Perfis: **Proprietário** (tudo), **Administrador** (sem gestão de utilizadores), **Editor** (sem custos de aquisição, eliminações definitivas, definições ou utilizadores).

---

## Segurança

- **Autenticação** com bcrypt (custo 12), bloqueio temporário após 5 tentativas falhadas, limitação de tentativas por IP e tempo de resposta uniforme.
- **Sessões** guardadas na base de dados (apenas o hash do token), cookie `HttpOnly`, `SameSite=Lax`, `Secure` + prefixo `__Host-` em HTTPS, expiração por inatividade (12 h) e duração máxima (7 dias); terminar sessões noutros dispositivos.
- **Autorização no servidor** em todas as páginas, server actions e APIs (verificação de sessão e de permissão por perfil); as ações do Next.js verificam a origem; os route handlers validam a origem (CSRF).
- **Políticas na base de dados**: o showroom consulta a base de dados com a role restrita `crewcar_web` (`SET LOCAL ROLE`), que:
  - só pode ler colunas públicas — **nunca** VIN, preço de aquisição, notas internas, rascunhos ou utilizadores;
  - só vê viaturas publicadas e não arquivadas (Row Level Security);
  - só pode **inserir** pedidos de contacto, nunca lê-los.
  No Supabase, o RLS sem políticas para `anon`/`authenticated` bloqueia também a API REST pública.
- **Ficheiros**: validação do formato real e das dimensões, limite de 15 MB, remoção de metadados EXIF/GPS, chaves aleatórias, entrega com `nosniff` e CSP restritiva; fotografias de viaturas não publicadas não são servidas ao público.
- **Anti-spam** no formulário: campo isco, token assinado com tempo mínimo de preenchimento, limitação por IP (5 pedidos / 10 min) e limite de ligações na mensagem.
- **Cabeçalhos**: CSP com nonce, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS em HTTPS.
- **CSV**: proteção contra injeção de fórmulas na exportação; o preço de aquisição só é exportado para perfis autorizados.

---

## SEO, desempenho e acessibilidade

- URLs amigáveis (`/viaturas/peugeot-308-1-2-puretech-gt-2022`), títulos e descrições editáveis, Open Graph, `sitemap.xml` e `robots.txt` dinâmicos, dados estruturados (`AutoDealer`, `Car`), páginas 404 próprias, opção para bloquear a indexação durante a preparação.
- Fotografias em WebP com `srcset` (480/1024/1920 px) e carregamento diferido.
- HTML semântico, navegação por teclado, indicadores de foco, ligação "Saltar para o conteúdo", contraste verificado automaticamente (axe, WCAG 2.1 AA) e respeito por `prefers-reduced-motion`.
- Formatação portuguesa: `21 900 €`, `48 200 km`, datas `DD/MM/AAAA`, fuso horário `Europe/Lisbon` (configurável para Madeira/Açores).

---

## Testes

```bash
npm run typecheck
npm test                 # testes unitários (preços, descontos, formatação, validação, CSV, Markdown)
npm run test:e2e         # compila e executa os testes de integração (base de dados crewcar_test)
```

Os testes de integração usam uma base de dados separada (`TEST_DATABASE_URL`, por omissão `postgres://crewcar:crewcar_dev@localhost:5432/crewcar_test`) que é limpa no início. Cobrem: início de sessão, criação/edição de viaturas, carregamento e organização de fotografias, cálculo de descontos, publicação no showroom, privacidade de viaturas não publicadas, filtros e pesquisa, páginas próprias, formulários de contacto e CRM, reflexo de preços e estados, persistência após atualizar, proteção de dados privados (incluindo ao nível da base de dados), telemóvel, erros e dados inválidos, CSV e acessibilidade.

As imagens usadas nos testes de carregamento são ficheiros existentes de dados de teste do projeto Go (licença BSD) — ver `tests/fixtures/README.md`.

---

## O que depende de si

1. **Credenciais e alojamento**: projeto Supabase (ou outro PostgreSQL), bucket de armazenamento, domínio e `APP_SECRET`.
2. **Dados da empresa**: telefone, e-mail, WhatsApp, morada, horário, redes sociais, denominação social, NIF e sede (em **Definições**). Nada disto foi inventado — enquanto não preencher, estes elementos não aparecem.
3. **Páginas legais**: os modelos de Política de privacidade, Política de cookies e Informação legal são criados como **rascunho** com campos `[entre parênteses retos]`. Complete-os, confirme-os com um profissional e publique-os. O website não afirma qualquer conformidade jurídica.
4. **Fotografias e logótipo**: carregue as suas fotografias reais em cada viatura e, se quiser, o logótipo, o favicon e a imagem principal.
5. **Vantagens do stand**: só as adicione se forem verdadeiras.
6. **Dados de demonstração**: remova-os antes de lançar o site.

### Evoluções sugeridas
- Notificação por e-mail de novos contactos (requer um serviço SMTP).
- Simulador de financiamento (requer parceiro financeiro e informação pré-contratual).
- Integração automática com portais automóveis.
