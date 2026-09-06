# Backend — Content Studio

Servidor pequeno (Node + Express) que fala com a API da Anthropic (Claude) em nome do app.
Ele existe porque uma chave de API **nunca** pode ficar dentro de um site estático (GitHub Pages) —
qualquer pessoa que abrir o código-fonte da página conseguiria vê-la e usar sua conta.

## 1. Rodar localmente (para testar)

```bash
cd backend
npm install
cp .env.example .env
# edite o .env e cole sua chave, pegue em https://console.anthropic.com/settings/keys
npm start
```

O servidor sobe em `http://localhost:3000`.

## 2. Colocar no ar de graça (escolha uma opção)

### Opção A — Render.com (recomendado, mais simples)
1. Crie um repositório no GitHub só com a pasta `backend` (ou o projeto todo).
2. Em https://render.com → New → Web Service → conecte o repositório.
3. Build command: `npm install` — Start command: `npm start`.
4. Em "Environment", adicione a variável `ANTHROPIC_API_KEY` com sua chave.
5. Deploy. Você vai receber uma URL tipo `https://seu-app.onrender.com`.

### Opção B — Railway.app
1. New Project → Deploy from GitHub repo.
2. Adicione a variável de ambiente `ANTHROPIC_API_KEY`.
3. Railway detecta o Node automaticamente e gera uma URL pública.

Qualquer uma das duas tem plano gratuito suficiente para começar.

## 3. Conectar ao frontend

Depois do deploy, copie a URL pública (ex: `https://seu-app.onrender.com`) e cole na tela
**Configurações** do app (frontend), no campo "URL do backend". O app salva isso no navegador
e passa a usar essa URL em todas as chamadas de IA.

## Endpoints

- `POST /api/trends` `{ niche, description }` → lista de assuntos em alta com pontuação (usa busca na web).
- `POST /api/hooks` `{ niche, topic }` → 10 ganchos de abertura.
- `POST /api/copy` `{ niche, description, topic, format, subformat, designPattern, tone, objective, hook, slideCount }` → título, slides, legenda, hashtags e CTA.

## Segurança

O CORS está liberado para qualquer origem (`cors()`) para facilitar os testes. Antes de divulgar o
app publicamente, troque a linha no `server.js` por:

```js
app.use(cors({ origin: "https://SEU-USUARIO.github.io" }));
```

para que só o seu site no GitHub Pages consiga chamar o backend.
