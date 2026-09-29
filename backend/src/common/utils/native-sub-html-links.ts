/**
 * Extract share URIs from a 3x-ui subscription HTML page.
 *
 * Two page shapes exist (both rendered from the same `getSubs` result as the
 * raw feed, only remarks are name-only):
 * - Default SPA: links live in `window.__SUB_PAGE_DATA__ = {...json...}` where
 *   Go's json.Marshal escapes `&` `<` `>` as `\u0026` `\u003c` `\u003e`.
 * - Custom templates (docs/custom-subscription-templates.md): `{{ range .links }}`
 *   in HTML text (`&amp;`, `&#43;`) or in a JS context (`\u0026`, `\/`, `\u003d`).
 * Leaving any of those escapes in place glues the query string together and
 * drops `type`/`path`/`host`/`sni`, i.e. the transport differs from native.
 */

const PROTOCOL_URI =
  /(?:vless|vmess|trojan|ss|ssr|hysteria2?|hy2|tuic|wireguard|wg|mtproto):(?:\\?\/){2}(?:[^\s"'<>`\\]|\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}|\\\/)+/gi;

function decodeHtmlEntities(raw: string): string {
  return String(raw || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function decodeJsEscapes(raw: string): string {
  return String(raw || '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, '/');
}

export function normalizeShareUri(raw: string): string {
  let s = String(raw || '').trim();
  for (let i = 0; i < 2; i++) {
    const next = decodeHtmlEntities(decodeJsEscapes(s));
    if (next === s) break;
    s = next;
  }
  return s.trim();
}

function isShareUri(line: string): boolean {
  return /^[a-z0-9+.-]+:\/\/\S+$/i.test(line);
}

function pushUnique(out: string[], seen: Set<string>, raw: unknown): void {
  const uri = normalizeShareUri(String(raw ?? ''));
  if (!isShareUri(uri) || seen.has(uri)) return;
  seen.add(uri);
  out.push(uri);
}

/** Balanced `{...}` starting at `start`, respecting JSON string literals. */
function sliceJsonObject(text: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Links from the default 3x-ui SPA page (`window.__SUB_PAGE_DATA__`). */
function extractSpaPageDataLinks(html: string): string[] {
  const marker = /__SUB_PAGE_DATA__\s*=\s*/.exec(html);
  if (!marker) return [];
  const start = html.indexOf('{', marker.index + marker[0].length - 1);
  if (start < 0) return [];
  const json = sliceJsonObject(html, start);
  if (!json) return [];
  try {
    const data = JSON.parse(json);
    return Array.isArray(data?.links) ? data.links.map((l: unknown) => String(l ?? '')) : [];
  } catch {
    return [];
  }
}

export function extractRawLinkUrisFromHtml(html: string): string[] {
  const text = String(html || '');
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const link of extractSpaPageDataLinks(text)) pushUnique(out, seen, link);
  if (out.length) return out;

  const rawLinkRe =
    /<(div|span|pre|code|textarea|p|li)[^>]*\bclass=["'][^"']*\braw-link\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = rawLinkRe.exec(text)) !== null) {
    pushUnique(out, seen, m[2].replace(/<[^>]+>/g, ''));
  }
  if (out.length) return out;

  const dataAttrRe = /\bdata-(?:link|uri|config|url|clipboard-text)=(["'])([\s\S]*?)\1/gi;
  while ((m = dataAttrRe.exec(text)) !== null) {
    pushUnique(out, seen, m[2]);
  }
  if (out.length) return out;

  for (const raw of text.match(PROTOCOL_URI) || []) {
    pushUnique(out, seen, trimProsePunctuation(normalizeShareUri(raw)));
  }
  return out;
}

/** Drop sentence punctuation after a bare URI without eating a remark's `(...)`. */
function trimProsePunctuation(uri: string): string {
  let s = uri;
  for (;;) {
    if (/[,.;]$/.test(s)) {
      s = s.slice(0, -1);
      continue;
    }
    if (s.endsWith(')') && (s.match(/\)/g) || []).length > (s.match(/\(/g) || []).length) {
      s = s.slice(0, -1);
      continue;
    }
    return s;
  }
}

export function looksLikeSubscriptionHtml(body: string): boolean {
  const s = String(body || '');
  return (
    /raw-link/i.test(s) ||
    /__SUB_PAGE_DATA__/.test(s) ||
    (/<!doctype html/i.test(s) && /(?:vless|vmess|trojan|ss|hysteria2?|hy2):(?:\\?\/){2}/i.test(s)) ||
    (/<html[\s>]/i.test(s) && /configs-container|raw-links-container/i.test(s))
  );
}
