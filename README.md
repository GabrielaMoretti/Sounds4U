# Sounds4U

Letterboxd, mas para música — com uma pitada de Twitter. Conecta no Spotify, vê o que você andou
ouvindo, avalia faixas, posta sobre uma música pros amigos verem no feed, e adiciona gente por
username ou link de convite.

Stack: React + Vite + Supabase (Auth + Postgres). MVP com Spotify apenas — é a única DSP com API
pública viável para login de usuário + histórico de escuta (ver notas abaixo).

Em produção: https://sounds4u.vercel.app (deploy automático a cada push em `main`, via Vercel + GitHub).

## Como funciona o login

O login é 100% via **Supabase Auth com o Spotify como provider OAuth** — não existe conta
separada nem senha própria do app. `supabase.auth.signInWithOAuth({ provider: 'spotify' })` já
cria o usuário, a sessão, e (no primeiro login) o `provider_token`/`provider_refresh_token` do
Spotify, que a gente salva na tabela `dsp_connections` (`src/context/AuthContext.jsx`) pra poder
chamar a Web API do Spotify depois.

Limitação atual: o token do Spotify dura 1h e a gente ainda não implementou refresh automático
(precisaria de uma function serverless guardando o Client Secret, que não pode ir pro bundle do
navegador). Quando expira, a UI pede pra reconectar. Isso é um bom próximo passo.

## Setup

```bash
npm install
cp .env.example .env
```

### 1. Projeto Supabase (conta separada da usada em outros projetos)

1. Crie o projeto em https://supabase.com
2. **SQL Editor** → rode, nesta ordem: [`supabase/schema.sql`](supabase/schema.sql) →
   [`supabase/002_profile_trigger.sql`](supabase/002_profile_trigger.sql) →
   [`supabase/003_posts.sql`](supabase/003_posts.sql)
3. **Authentication → Sign In / Providers → Email** → desative **"Confirm email"** (o app não usa
   login por e-mail/senha; sem isso o login via Spotify é bloqueado com "Unverified email")
4. **Authentication → Providers → Spotify** → ative, cole o Client ID e o Client Secret do app do
   Spotify (passo 2 abaixo), copie a **Callback URL** que o Supabase mostra
5. Preencha `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` no `.env` (Settings → API)

### 2. App do Spotify

1. Crie em https://developer.spotify.com/dashboard
2. **Redirect URIs**: adicione a Callback URL do Supabase (passo 1.4) e, se for testar local,
   `http://127.0.0.1:5173/callback/spotify`
3. Marque **Web API** em APIs used
4. Copie o Client ID e o Client Secret pro provider do Supabase (passo 1.4) — o app em si **não**
   guarda o Client ID/Secret, quem fala com o Spotify no OAuth é o Supabase

```bash
npm run dev
```

## Estrutura

```
src/
  lib/spotify.js          chamadas à Web API (recently-played, search, currently-playing) usando
                           o token salvo em dsp_connections
  lib/supabase.js          client Supabase (no-op se env vars ausentes)
  lib/dspConnections.js    salva/lê o token do Spotify por usuário
  lib/profilesApi.js       perfil próprio + busca de usuários por username
  lib/friendsApi.js        pedidos de amizade (tabela friendships)
  lib/postsApi.js          posts do feed (tabela posts, sempre associados a uma faixa)
  lib/reviewsApi.js        reviews (1-5 estrelas + texto, uma por usuário por faixa)
  lib/tracksApi.js         cache de metadata de faixa (tabela tracks)
  lib/listeningHistoryApi.js  grava o recently-played no Supabase pra não perder quando sai da
                           janela curta que o Spotify guarda
  context/AuthContext.jsx  sessão do Supabase + conexão com o Spotify
  components/TrackPicker.jsx  busca de faixa reutilizada no Feed e nas Reviews
  pages/Login.jsx          tela inicial
  pages/SpotifyCallback.jsx  aguarda a sessão do Supabase assentar depois do redirect OAuth
  pages/Feed.jsx           postar sobre uma faixa + feed de você e seus amigos aceitos
  pages/History.jsx        "ouvindo agora" + últimas músicas ouvidas
  pages/Reviews.jsx        avaliar faixas (1-5 estrelas + texto)
  pages/Friends.jsx        buscar por username, aceitar/remover, link de convite
supabase/
  schema.sql               tabelas principais + RLS
  002_profile_trigger.sql  cria o profile automaticamente no primeiro login
  003_posts.sql            tabela de posts do feed
```

## Sobre "amigos do Spotify"

O Spotify não expõe a lista de amigos/atividade social de ninguém via API pública — isso só existe
dentro do app oficial deles. Por isso "amigos" aqui é uma rede própria do Sounds4U: busca por
username + link de convite (`Friends.jsx`), não importação da rede do Spotify.

## Sobre as outras DSPs

- **Deezer**: API pública viável, dá pra adicionar depois com o mesmo padrão do Spotify.
- **Apple Music**: exige conta paga de developer (MusicKit) e não expõe "recently played" de
  verdade — só a biblioteca do usuário.
- **Amazon Music**: sem API pública para OAuth de usuário ou histórico. Não integrável hoje.
