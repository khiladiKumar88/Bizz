# MatchCraft 💘

AI-powered dating app reply assistant. Upload a screenshot of a profile or chat, pick a tone, and get 5 crafted openers or replies in seconds.

**Supported platforms:** Tinder, Bumble, Hinge, Instagram DMs

**Tones:** Funny, Flirty, Genuine, Confident, Savage (with roast card export!)

---

## Architecture

```
/frontend   — React + Vite + Tailwind CSS single-page app (mobile-first)
/worker     — Cloudflare Worker: stateless proxy to Claude API with IP-based rate limiting
```

No database. No user accounts. History is stored in browser `localStorage` (text only — screenshots are never persisted).

---

## Local development

### 1. Worker

```bash
cd worker
npm install

# Set your Anthropic API key
echo "CLAUDE_API_KEY=sk-ant-..." > .dev.vars

npm run dev          # starts on http://localhost:8787
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # starts on http://localhost:5173
                     # /api/* proxies to http://localhost:8787
```

Open [http://localhost:5173](http://localhost:5173).

---

## Deployment

### Deploy the Worker

```bash
cd worker
npm install

# Set secret (do this once — never commit the key)
npx wrangler secret put CLAUDE_API_KEY

# Optional: create a KV namespace for rate limiting
#   npx wrangler kv:namespace create RATE_LIMIT_KV
# Then uncomment the kv_namespaces block in wrangler.toml and paste the id.

npx wrangler deploy
# → https://matchcraft-api.YOUR-NAME.workers.dev
```

### Deploy the Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local:
#   VITE_API_URL=https://matchcraft-api.YOUR-NAME.workers.dev

npm run build        # outputs to dist/
```

Upload `dist/` to Cloudflare Pages, Vercel, Netlify, or any static host.

**Cloudflare Pages (recommended — same edge network as the Worker):**
```bash
cd frontend
npx wrangler pages deploy dist --project-name matchcraft
```

---

## Rate limiting

The Worker uses a per-IP daily limit (default: 10 generations/day). To enable it:

1. Create a KV namespace:
   ```bash
   npx wrangler kv:namespace create RATE_LIMIT_KV
   ```
2. Copy the returned `id` into `worker/wrangler.toml` (uncomment the `[[kv_namespaces]]` block).
3. Redeploy.

Without a KV namespace, the Worker operates without rate limiting.

---

## Environment variables

| Location | Variable | Description |
|---|---|---|
| `worker/.dev.vars` (local) | `CLAUDE_API_KEY` | Anthropic API key |
| Worker secrets (prod) | `CLAUDE_API_KEY` | Set via `wrangler secret put` |
| `frontend/.env.local` | `VITE_API_URL` | Worker URL (prod only) |

---

## Project structure

```
/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  — root state + screen routing
│   │   ├── components/
│   │   │   ├── UploadScreen.jsx     — image upload, tone/mode selection
│   │   │   ├── ResultsScreen.jsx    — suggestion cards, copy, roast card export
│   │   │   └── HistoryScreen.jsx    — localStorage-backed history
│   │   └── utils/
│   │       └── roastCard.js         — canvas-based shareable PNG generator
│   └── ...
└── worker/
    └── src/
        └── index.js                 — Cloudflare Worker: CORS, rate limiting, Claude API proxy
```

---

## Privacy

- Screenshots are sent to the Cloudflare Worker only to call the Claude API and are **never stored**.
- Only the generated text suggestions are saved, in your browser's `localStorage`.
- No user accounts, no analytics, no tracking.
