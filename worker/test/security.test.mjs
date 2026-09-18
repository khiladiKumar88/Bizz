import worker from '../src/index.js'

// In-memory KV stub
const makeKV = (store = new Map()) => ({
  get: async (k) => store.get(k) ?? null,
  put: async (k, v) => void store.set(k, v),
  _store: store,
})

const ENV = () => ({
  CLAUDE_API_KEY: 'test-key',
  RATE_LIMIT_KV: makeKV(),
  ALLOWED_ORIGINS: 'https://matchcraft.pages.dev,http://localhost:5173',
  RATE_LIMIT_MAX_PER_DAY: '10',
  GLOBAL_DAILY_MAX: '500',
})

const IMG = Buffer.from('fake-image-bytes').toString('base64')

function req(body, { origin, ip = '1.2.3.4', method = 'POST', path = '/generate', headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers }
  if (origin) h['Origin'] = origin
  return new Request(`https://api.test${path}`, {
    method,
    headers: h,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
}

let pass = 0, fail = 0
async function check(name, res, expectStatus, extra) {
  const bodyText = await res.clone().text()
  let body = {}
  try { body = JSON.parse(bodyText) } catch {}
  const okStatus = res.status === expectStatus
  const okExtra = extra ? extra(res, body) : true
  if (okStatus && okExtra) { console.log(`  PASS  ${name}`); pass++ }
  else { console.log(`  FAIL  ${name} — got ${res.status}, want ${expectStatus} | body=${bodyText.slice(0,120)}`); fail++ }
}

// Block the real Claude call — we only test worker logic, not upstream.
globalThis.fetch = async () => new Response(
  JSON.stringify({ content: [{ text: '["a","b","c","d","e"]' }] }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
)

console.log('\n--- Input validation ---')
for (const probe of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
  await check(
    `tone="${probe}" rejected (prototype chain)`,
    await worker.fetch(req({ imageBase64: IMG, tone: probe, mode: 'reply' }), ENV()),
    400,
  )
}
await check('mode="constructor" rejected',
  await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'constructor' }), ENV()), 400)
await check('valid tone+mode accepted',
  await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' }), ENV()), 200)
await check('platform="constructor" dropped, not fatal',
  await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply', platform: 'constructor' }), ENV()), 200)
await check('non-string tone rejected',
  await worker.fetch(req({ imageBase64: IMG, tone: { a: 1 }, mode: 'reply' }), ENV()), 400)
await check('array body rejected',
  await worker.fetch(req([1, 2, 3]), ENV()), 400)

console.log('\n--- Image payload limits ---')
await check('oversized image rejected (413)',
  await worker.fetch(req({ imageBase64: 'A'.repeat(7_000_001), tone: 'funny', mode: 'reply' }), ENV()), 413)
await check('non-base64 image rejected',
  await worker.fetch(req({ imageBase64: 'not valid!!! base64 $$$', tone: 'funny', mode: 'reply' }), ENV()), 400)
await check('missing image rejected',
  await worker.fetch(req({ tone: 'funny', mode: 'reply' }), ENV()), 400)
await check('Content-Length over cap rejected early',
  await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' },
    { headers: { 'Content-Length': String(9 * 1024 * 1024) } }), ENV()), 413)

console.log('\n--- CORS allowlist ---')
await check('allowed origin echoed',
  await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' },
    { origin: 'https://matchcraft.pages.dev' }), ENV()), 200,
  (r) => r.headers.get('Access-Control-Allow-Origin') === 'https://matchcraft.pages.dev')
await check('evil origin gets NO ACAO header',
  await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' },
    { origin: 'https://evil.example' }), ENV()), 200,
  (r) => r.headers.get('Access-Control-Allow-Origin') === null)
await check('OPTIONS preflight from evil origin gets no ACAO',
  await worker.fetch(req(null, { method: 'OPTIONS', origin: 'https://evil.example' }), ENV()), 204,
  (r) => r.headers.get('Access-Control-Allow-Origin') === null)
await check('Vary: Origin present',
  await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' }, { origin: 'https://matchcraft.pages.dev' }), ENV()), 200,
  (r) => r.headers.get('Vary') === 'Origin')

console.log('\n--- Rate limiting ---')
{
  const env = ENV()
  let last
  for (let i = 0; i < 11; i++) {
    last = await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' }), env)
  }
  await check('11th request from same IP blocked', last, 429)

  // Different IP should still work
  const other = await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' }, { ip: '9.9.9.9' }), env)
  await check('different IP still allowed', other, 200)
}
{
  // Spoofed XFF must NOT create a fresh bucket
  const env = ENV()
  for (let i = 0; i < 10; i++) {
    await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' }, { ip: '5.5.5.5' }), env)
  }
  const spoofed = await worker.fetch(
    req({ imageBase64: IMG, tone: 'funny', mode: 'reply' },
      { ip: '5.5.5.5', headers: { 'X-Forwarded-For': '6.6.6.6' } }), env)
  await check('spoofed X-Forwarded-For does NOT bypass limit', spoofed, 429)
}
{
  // Global ceiling holds across rotating IPs
  const env = { ...ENV(), GLOBAL_DAILY_MAX: '5', RATE_LIMIT_MAX_PER_DAY: '10' }
  let last
  for (let i = 0; i < 6; i++) {
    last = await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' }, { ip: `10.0.0.${i}` }), env)
  }
  await check('global ceiling blocks IP rotation', last, 429)
}
{
  const env = { ...ENV(), RATE_LIMIT_KV: undefined }
  await check('unbound KV fails CLOSED (503)',
    await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' }), env), 503)
}
{
  const env = { ...ENV(), RATE_LIMIT_KV: undefined, ALLOW_UNLIMITED: 'true' }
  await check('explicit dev opt-out still works',
    await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' }), env), 200)
}

console.log('\n--- Error hygiene ---')
{
  globalThis.fetch = async () => new Response('INTERNAL STACK TRACE /opt/secret/path.js:42 apikey=sk-ant-leak', { status: 500 })
  const res = await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' }), ENV())
  const text = await res.clone().text()
  await check('upstream error body never reaches client', res, 502,
    () => !text.includes('STACK') && !text.includes('sk-ant') && !text.includes('/opt/'))
}
{
  const env = { ...ENV(), CLAUDE_API_KEY: undefined }
  const res = await worker.fetch(req({ imageBase64: IMG, tone: 'funny', mode: 'reply' }), env)
  const text = await res.clone().text()
  await check('missing key does not leak config detail', res, 503,
    () => !text.toLowerCase().includes('api key'))
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`)
process.exit(fail ? 1 : 0)
