# musics2u

Letterboxd, mas para música. Conecta na sua DSP, mostra o que você andou ouvindo, você avalia
e escreve reviews, e vê o que os amigos estão curtindo.

Stack: React + Vite + Supabase (Postgres/Auth). MVP com Spotify apenas — é a única DSP com API
pública viável para login de usuário + histórico de escuta (ver notas abaixo).

## Setup

```bash
npm install
cp .env.example .env
```

### 1. App do Spotify (obrigatório para login)

1. Crie um app em https://developer.spotify.com/dashboard (use uma conta própria do projeto).
2. Em **Redirect URIs**, adicione exatamente `http://127.0.0.1:5173/callback/spotify`
   (Spotify não aceita mais `localhost`, tem que ser `127.0.0.1`).
3. Copie o **Client ID** para `VITE_SPOTIFY_CLIENT_ID` no `.env`.
   Não precisa de Client Secret — o fluxo usado é Authorization Code + PKCE, feito 100% no
   browser (`src/lib/spotify.js`).

### 2. Supabase (opcional por enquanto)

Ainda não configurado neste projeto — **use uma conta/projeto Supabase separado do STRM
Insight**. Enquanto isso, reviews e amigos usam `localStorage` como placeholder
(`src/lib/localStore.js`), só para poder testar a UI.

Quando o projeto Supabase novo existir:

1. Rode `supabase/schema.sql` no SQL editor do projeto (cria tabelas + RLS: `profiles`,
   `dsp_connections`, `tracks`, `listening_history`, `reviews`, `friendships`).
2. Preencha `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` no `.env`.
3. Trocar `src/lib/localStore.js` pelas queries reais ao Supabase nas páginas
   `Reviews.jsx` / `Friends.jsx`, e persistir os tokens do Spotify em `dsp_connections`
   em vez de `localStorage` (`src/lib/spotify.js`).

```bash
npm run dev
```

## Estrutura

```
src/
  lib/spotify.js         PKCE auth + chamadas à Web API (recently-played, search, currently-playing)
  lib/supabase.js        client Supabase (no-op se env vars ausentes)
  lib/localStore.js      placeholder localStorage p/ reviews e amigos (até o Supabase entrar)
  context/SpotifyContext.jsx  estado de conexão com o Spotify
  pages/Login.jsx         tela inicial, botão "Conectar com Spotify"
  pages/SpotifyCallback.jsx  troca o code por token (PKCE)
  pages/History.jsx       "ouvindo agora" + últimas músicas ouvidas
  pages/Reviews.jsx       buscar música, avaliar (1-5 estrelas) + texto
  pages/Friends.jsx       lista de amigos (placeholder local por enquanto)
supabase/schema.sql       schema completo + RLS, pronto pra rodar quando o projeto existir
```

## Sobre as outras DSPs

- **Deezer**: API pública viável, dá pra adicionar depois com o mesmo padrão do Spotify.
- **Apple Music**: exige conta paga de developer (MusicKit) e não expõe "recently played" de
  verdade — só a biblioteca do usuário.
- **Amazon Music**: sem API pública para OAuth de usuário ou histórico. Não integrável hoje.
