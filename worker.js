/**
 * STIK OS – Cloudflare Worker
 *  GET  /health          -> preveri delovanje
 *  GET  /fetch?url=…     -> prebere spletno stran ali JSON izdelka (za ponudbe)
 *  GET  /img?url=…       -> prenese sliko izdelka (za ponudbe)
 *  POST /ai              -> brezplačen AI (Cloudflare Workers AI)
 *
 * Nastavitve (Settings → Variables and Secrets):
 *  APP_KEY         (priporočeno) skrivni ključ; isti ključ vpišeš v STIK OS → Nastavitve → AI
 *  ALLOWED_ORIGIN  (neobvezno) npr. https://ime.github.io  – omeji klice samo na tvojo aplikacijo
 *  ALLOWED_HOSTS   (neobvezno) npr. pickupoprema.si,roadranger.si – omeji branje samo na te strani
 *  AI_MODELS       (neobvezno) modeli po vrstnem redu, ločeni z vejico
 * Vezava (Settings → Bindings): Workers AI, ime spremenljivke: AI
 */
const DEFAULT_MODELS = [
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct'
];
const PRIVATE_HOST = /^(localhost|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1|.*\.local$|.*\.internal$)/i;
const UA = 'Mozilla/5.0 (compatible; STIK-OS/1.0; +https://pickupoprema.si)';

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-STIK-KEY',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (env.APP_KEY && req.headers.get('X-STIK-KEY') !== env.APP_KEY) return json({ ok: false, error: 'Napačen ali manjkajoč ključ (APP_KEY).' }, 401);

    const url = new URL(req.url);
    try {
      if (url.pathname === '/health') return json({ ok: true, ai: !!env.AI });

      if (url.pathname === '/fetch' || url.pathname === '/img') {
        const target = checkTarget(url.searchParams.get('url'), env);
        const r = await fetch(target, { headers: { 'User-Agent': UA, 'Accept': url.pathname === '/img' ? 'image/*,*/*;q=0.8' : 'text/html,application/json,*/*;q=0.8', 'Accept-Language': 'sl,en;q=0.7' }, redirect: 'follow', cf: { cacheTtl: 300, cacheEverything: true } });
        if (!r.ok) return json({ ok: false, error: 'Vir je vrnil ' + r.status }, 502);
        if (url.pathname === '/img') {
          const type = r.headers.get('Content-Type') || '';
          if (!type.startsWith('image/')) return json({ ok: false, error: 'Vir ni slika' }, 415);
          const buf = await r.arrayBuffer();
          if (buf.byteLength > 15 * 1024 * 1024) return json({ ok: false, error: 'Slika je prevelika' }, 413);
          return new Response(buf, { headers: { ...cors, 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } });
        }
        const text = await r.text();
        if (text.length > 4 * 1024 * 1024) return json({ ok: false, error: 'Stran je prevelika' }, 413);
        return new Response(text, { headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8', 'X-Final-Url': r.url } });
      }

      if (url.pathname === '/ai' && req.method === 'POST') {
        if (!env.AI) return json({ ok: false, error: 'Worker nima vezave Workers AI (Settings → Bindings → Workers AI, ime: AI).' }, 500);
        const body = await req.json().catch(() => ({}));
        let messages = Array.isArray(body.messages) ? body.messages : (body.prompt ? [{ role: 'user', content: String(body.prompt) }] : []);
        messages = messages.filter(m => m && typeof m.content === 'string' && ['system', 'user', 'assistant'].includes(m.role));
        if (!messages.length) return json({ ok: false, error: 'Ni sporočil' }, 400);
        if (messages.reduce((a, m) => a + m.content.length, 0) > 40000) return json({ ok: false, error: 'Vhod je predolg' }, 413);
        const max_tokens = Math.min(Math.max(parseInt(body.max_tokens) || 800, 16), 1800);
        const temperature = Math.min(Math.max(Number(body.temperature) || 0.4, 0), 1.2);
        let models = env.AI_MODELS ? env.AI_MODELS.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_MODELS;
        if (body.model && /^@cf\/[\w.\-\/]+$/.test(body.model)) models = [body.model, ...models.filter(m => m !== body.model)];
        let lastErr;
        for (const model of models) {
          try {
            const out = await env.AI.run(model, { messages, max_tokens, temperature });
            const text = extractText(out);
            if (text) return json({ ok: true, text, model });
            lastErr = new Error('Prazen odgovor modela ' + model);
          } catch (e) {
            lastErr = e;
            if (/4006|daily free allocation/i.test(String(e && e.message))) return json({ ok: false, error: 'Dnevna brezplačna kvota AI je porabljena. Ponastavi se ob 00:00 UTC (ob 2:00 po slovenskem poletnem času, ob 1:00 pozimi).' }, 429);
          }
        }
        return json({ ok: false, error: 'AI trenutno ni na voljo: ' + (lastErr && lastErr.message || 'neznana napaka') }, 502);
      }
      return json({ ok: false, error: 'Neznana pot' }, 404);
    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e) }, 400);
    }
  }
};

function checkTarget(raw, env) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('Neveljaven naslov'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Dovoljena sta samo http in https');
  if (PRIVATE_HOST.test(u.hostname)) throw new Error('Naslov ni dovoljen');
  if (env.ALLOWED_HOSTS) {
    const ok = env.ALLOWED_HOSTS.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).some(h => u.hostname === h || u.hostname.endsWith('.' + h));
    if (!ok) throw new Error('Domena ni na seznamu dovoljenih (ALLOWED_HOSTS)');
  }
  return u.href;
}

function extractText(out) {
  if (!out) return '';
  let t = out.response ?? (out.result && out.result.response) ?? (out.choices && out.choices[0] && (out.choices[0].message ? out.choices[0].message.content : out.choices[0].text));
  if (t && typeof t === 'object') t = JSON.stringify(t);
  t = String(t || '');
  return t.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\|?channel\|?>thought[\s\S]*?<\|?channel\|?>/gi, '').trim();
}
