const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const RATE_LIMIT_MAX = 10 // requests per IP per day

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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const url = new URL(request.url)

    if (url.pathname !== '/generate') {
      return json({ error: 'Not found' }, 404)
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    // --- Rate limiting ---
    const ip = request.headers.get('CF-Connecting-IP')
      || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
      || 'unknown'

    if (env.RATE_LIMIT_KV) {
      const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      const key = `rl:${ip}:${today}`
      const raw = await env.RATE_LIMIT_KV.get(key)
      const count = raw ? parseInt(raw, 10) : 0
      const limit = parseInt(env.RATE_LIMIT_MAX_PER_DAY || String(RATE_LIMIT_MAX), 10)

      if (count >= limit) {
        return json(
          { error: `Daily limit of ${limit} generations reached. Come back tomorrow! 💘` },
          429,
        )
      }

      // Increment — expire after 25 hours to be safe around midnight
      await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: 90000 })
    }

    // --- Parse body ---
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const { imageBase64, imageMediaType, tone, mode } = body

    if (!imageBase64) return json({ error: 'Missing imageBase64' }, 400)
    if (!tone || !TONE_PROMPTS[tone]) return json({ error: 'Invalid tone' }, 400)
    if (!mode || !MODE_PROMPTS[mode]) return json({ error: 'Invalid mode' }, 400)

    const allowedMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const mediaType = allowedMediaTypes.includes(imageMediaType) ? imageMediaType : 'image/jpeg'

    if (!env.CLAUDE_API_KEY) {
      return json({ error: 'API key not configured' }, 500)
    }

    // --- Call Claude ---
    const systemPrompt = `You are a dating app messaging expert helping someone ${MODE_PROMPTS[mode]}.
The tone should be ${TONE_PROMPTS[tone]}.

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
          max_tokens: 1024,
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
    } catch (err) {
      console.error('Claude fetch error:', err)
      return json({ error: 'Failed to reach AI service. Please try again.' }, 502)
    }

    if (!claudeResp.ok) {
      const errText = await claudeResp.text().catch(() => '')
      console.error('Claude API error:', claudeResp.status, errText)
      if (claudeResp.status === 429) {
        return json({ error: 'AI service is busy. Please wait a moment and try again.' }, 429)
      }
      return json({ error: 'AI service returned an error. Please try again.' }, 502)
    }

    let claudeData
    try {
      claudeData = await claudeResp.json()
    } catch {
      return json({ error: 'Invalid response from AI service.' }, 502)
    }

    const rawText = claudeData?.content?.[0]?.text || ''

    // Parse the JSON array from Claude's response
    let suggestions
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/)
      suggestions = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
      if (!Array.isArray(suggestions)) throw new Error('not an array')
      suggestions = suggestions
        .filter((s) => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 5)
      if (suggestions.length === 0) throw new Error('empty')
    } catch {
      // Fallback: split by numbered lines or newlines
      suggestions = rawText
        .split(/\n/)
        .map((l) => l.replace(/^\d+[\.\)]\s*/, '').replace(/^["']|["']$/g, '').trim())
        .filter((l) => l.length > 0)
        .slice(0, 5)

      if (suggestions.length === 0) {
        return json({ error: 'Could not parse AI response. Please try again.' }, 502)
      }
    }

    return json({ suggestions })
  },
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
