// MatchCraft API Worker — stateless proxy to the Claude API.
//
// Security model:
//  - The Claude API key lives ONLY as a Cloudflare secret (`wrangler secret put CLAUDE_API_KEY`).
//  - No request or response body is persisted. KV holds integer counters only.
//  - CORS is an allowlist. Note this only constrains *browsers*; it is not an
//    authentication mechanism. Cost protection comes from the rate limits below.

const RATE_LIMIT_MAX = 10 // per-IP requests per day (default)
const GLOBAL_DAILY_MAX = 500 // hard ceiling across ALL users per day (cost circuit breaker)

// Anthropic caps a single image at 5 MB. base64 inflates by 4/3.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_BASE64_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) // ~6.99M chars
const MAX_BODY_BYTES = 8 * 1024 * 1024 // outer request envelope ceiling

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

const TONE_PROMPTS = {
  funny: 'witty, genuinely funny, and likely to make them laugh out loud',
  flirty: 'playfully flirtatious, charming, and teasing in a fun way',
  respectful: 'genuine, warm, thoughtful, and authentically interested in them',
  confident: 'bold, direct, self-assured, and a little cocky (in a charming way)',
  savage: 'sharp, playfully roast-style humor — teasing but never actually hurtful or mean',
}

const MODE_PROMPTS = {
  opener: 'craft a first opening message to start a conversation, based on details in the profile screenshot',
  reply: 'craft a reply to their last message shown in the screenshot',
}

const PLATFORM_CONTEXT = {
  tinder: 'This is a Tinder profile/chat. Keep messages punchy — Tinder users expect short, direct openers.',
  bumble: 'This is a Bumble profile/chat. On Bumble, women message first — if this is a reply, they already showed interest.',
  hinge: 'This is a Hinge profile/chat. Hinge profiles have prompts and answers — reference them specifically when possible.',
  instagram: 'This is an Instagram DM — keep the vibe casual and low-pressure, like a chill DM not a dating app pitch.',
}

// Explicit allowlists. Using own-property lookups only — a bare `OBJ[key]` truthiness
// check also matches inherited members like "constructor"/"toString", which would let a
// caller smuggle arbitrary text into the system prompt.
const TONES = Object.keys(TONE_PROMPTS)
const MODES = Object.keys(MODE_PROMPTS)
const PLATFORMS = Object.keys(PLATFORM_CONTEXT)

const pick = (allowed, table, value) =>
  typeof value === 'string' && allowed.includes(value) ? table[value] : null

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const url = new URL(request.url)
    if (url.pathname !== '/generate') return json({ error: 'Not found' }, 404, cors)
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

    // --- Reject oversized payloads before reading the body into memory ---
    const declaredLength = Number(request.headers.get('Content-Length') || 0)
    if (declaredLength > MAX_BODY_BYTES) {
      return json({ error: 'Image is too large. Please use a smaller screenshot.' }, 413, cors)
    }

    // --- Parse and validate input BEFORE consuming any quota, so malformed
    //     requests can't burn a legitimate user's daily allowance. ---
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, cors)
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return json({ error: 'Invalid request body' }, 400, cors)
    }

    const { imageBase64, imageMediaType, tone, mode, platform } = body

    const tonePrompt = pick(TONES, TONE_PROMPTS, tone)
    if (!tonePrompt) return json({ error: 'Invalid tone' }, 400, cors)

    const modePrompt = pick(MODES, MODE_PROMPTS, mode)
    if (!modePrompt) return json({ error: 'Invalid mode' }, 400, cors)

    // platform is optional; anything not on the allowlist is dropped, not rejected.
    const platformNote = platform == null ? '' : (pick(PLATFORMS, PLATFORM_CONTEXT, platform) || '')

    if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
      return json({ error: 'Missing imageBase64' }, 400, cors)
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return json(
        { error: 'Image is too large. Please use a screenshot under 5 MB.' },
        413,
        cors,
      )
    }
    if (!BASE64_RE.test(imageBase64)) {
      return json({ error: 'imageBase64 is not valid base64' }, 400, cors)
    }

    const mediaType =
      typeof imageMediaType === 'string' && ALLOWED_MEDIA_TYPES.includes(imageMediaType)
        ? imageMediaType
        : 'image/jpeg'

    if (!env.CLAUDE_API_KEY) {
      // Generic message to the client; detail stays server-side.
      console.error('CLAUDE_API_KEY is not configured')
      return json({ error: 'Service is not configured. Please try again later.' }, 503, cors)
    }

    // --- Rate limiting (per-IP + global cost ceiling) ---
    const limitResult = await enforceRateLimits(request, env)
    if (limitResult) return json({ error: limitResult.error }, limitResult.status, cors)

    const systemPrompt = `You are a dating app messaging expert helping someone ${modePrompt}.
The tone should be ${tonePrompt}.${platformNote ? `\n${platformNote}` : ''}

Rules:
- Generate exactly 5 different, varied messages (not slight rephrasing of each other)
- Keep each message short: 1–3 sentences max for openers; up to 4 sentences for replies
- Sound natural, not copy-paste cheesy or like a template
- When possible, reference specific details visible in the screenshot (bio, photos, last message)
- ${tone === 'savage' ? 'Be playfully teasing, never actually mean, hurtful, or body-shaming' : 'Make it genuinely engaging so they actually want to respond'}
- Do NOT use clichés like "Your smile is amazing" or "What are you looking for on here?"

Respond with ONLY a valid JSON array of 5 strings. No preamble, no explanation, no markdown.
Example: ["message one", "message two", "message three", "message four", "message five"]`

    let claudeResp
    try {
      claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024, // bounds worst-case output cost per request
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mediaType, data: imageBase64 },
                },
                {
                  type: 'text',
                  text: `Generate 5 ${tone} ${mode === 'opener' ? 'opening messages' : 'replies'} based on this screenshot.`,
                },
              ],
            },
          ],
        }),
      })
    } catch {
      // Deliberately not logging the error object — it can carry request context.
      console.error('upstream_fetch_failed')
      return json({ error: 'Failed to reach AI service. Please try again.' }, 502, cors)
    }

    if (!claudeResp.ok) {
      // Log the status code only. Upstream error bodies can echo request content
      // and must never reach Cloudflare logs or the client.
      console.error('upstream_error_status', claudeResp.status)
      if (claudeResp.status === 429) {
        return json({ error: 'AI service is busy. Please wait a moment and try again.' }, 429, cors)
      }
      return json({ error: 'AI service returned an error. Please try again.' }, 502, cors)
    }

    let claudeData
    try {
      claudeData = await claudeResp.json()
    } catch {
      return json({ error: 'Invalid response from AI service.' }, 502, cors)
    }

    const rawText = claudeData?.content?.[0]?.text || ''
    const suggestions = parseSuggestions(rawText)

    if (!suggestions.length) {
      return json({ error: 'Could not parse AI response. Please try again.' }, 502, cors)
    }

    return json({ suggestions }, 200, cors)
  },
}

// --- Rate limiting -----------------------------------------------------------
//
// Returns null when the request may proceed, or { error, status } when it may not.
//
// Keys off CF-Connecting-IP only. X-Forwarded-For is attacker-controlled and must
// never be trusted for this; Cloudflare always sets CF-Connecting-IP itself and
// strips any client-supplied copy.
async function enforceRateLimits(request, env) {
  if (!env.RATE_LIMIT_KV) {
    // Fail CLOSED. An unbound KV namespace previously meant "no rate limiting at
    // all", which silently removed every spend control. Local dev can opt out
    // explicitly with ALLOW_UNLIMITED = "true" in wrangler.toml [vars].
    if (env.ALLOW_UNLIMITED === 'true') return null
    console.error('rate_limit_kv_unbound')
    return { error: 'Service is not configured. Please try again later.', status: 503 }
  }

  const today = new Date().toISOString().slice(0, 10)
  const perIpLimit = toPositiveInt(env.RATE_LIMIT_MAX_PER_DAY, RATE_LIMIT_MAX)
  const globalLimit = toPositiveInt(env.GLOBAL_DAILY_MAX, GLOBAL_DAILY_MAX)

  // Global circuit breaker first — this is the ceiling that still applies when a
  // single actor rotates IPs (VPN/proxy/mobile network) to defeat the per-IP limit.
  const globalKey = `rl:global:${today}`
  const globalCount = toPositiveInt(await env.RATE_LIMIT_KV.get(globalKey), 0)
  if (globalCount >= globalLimit) {
    return {
      error: 'MatchCraft has hit its daily capacity. Please try again tomorrow 💘',
      status: 429,
    }
  }

  // CF-Connecting-IP is absent under `wrangler dev`; bucket those together rather
  // than handing every unidentified caller its own fresh allowance.
  const ip = request.headers.get('CF-Connecting-IP') || 'noip'
  const ipKey = `rl:${ip}:${today}`
  const ipCount = toPositiveInt(await env.RATE_LIMIT_KV.get(ipKey), 0)
  if (ipCount >= perIpLimit) {
    return {
      error: `Daily limit of ${perIpLimit} generations reached. Come back tomorrow! 💘`,
      status: 429,
    }
  }

  // expirationTtl 90000s (25h) so the counter outlives the UTC day boundary.
  await Promise.all([
    env.RATE_LIMIT_KV.put(ipKey, String(ipCount + 1), { expirationTtl: 90000 }),
    env.RATE_LIMIT_KV.put(globalKey, String(globalCount + 1), { expirationTtl: 90000 }),
  ])

  return null
}

function toPositiveInt(value, fallback) {
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

// --- CORS --------------------------------------------------------------------
//
// Allowlist from env.ALLOWED_ORIGINS (comma-separated). When a request's Origin
// is not on the list, no Access-Control-Allow-Origin header is emitted and the
// browser blocks the response. Native apps send no Origin and do not enforce
// CORS, so they are unaffected.
function corsHeaders(request, env) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  }

  const origin = request.headers.get('Origin')
  if (!origin) return headers

  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

// --- Response parsing --------------------------------------------------------

function parseSuggestions(rawText) {
  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
    if (Array.isArray(parsed)) {
      const cleaned = parsed
        .filter((s) => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 5)
      if (cleaned.length) return cleaned
    }
  } catch {
    // fall through to line-splitting
  }

  return rawText
    .split(/\n/)
    .map((l) => l.replace(/^\d+[.)]\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 5)
}

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
