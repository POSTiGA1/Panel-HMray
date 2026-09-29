import {
  extractRawLinkUrisFromHtml,
  looksLikeSubscriptionHtml,
  normalizeShareUri,
} from './native-sub-html-links';

const WS =
  'vless://uuid@cdn.example.com:443?type=ws&path=%2Fws%3Fed%3D2048&host=cdn.example.com&security=tls&sni=cdn.example.com&fp=chrome&encryption=none#NL%20(CDN)';
const GRPC =
  'vless://uuid@de.example.com:443?type=grpc&serviceName=gun&mode=gun&security=reality&pbk=PUBKEY&sid=ab12&sni=www.google.com&fp=chrome#DE';
const XHTTP =
  'vless://uuid@x.example.com:443?type=xhttp&path=%2Fx&host=x.example.com&mode=auto&security=tls#XH';
const HTTPUPGRADE =
  'trojan://pass@h.example.com:8443?type=httpupgrade&path=%2Fup&host=h.example.com&security=tls#HU';
const VMESS =
  'vmess://' +
  Buffer.from(
    JSON.stringify({ v: '2', ps: 'VM', add: 'vm.example.com', port: '443', id: 'uuid', net: 'ws', path: '/vm', host: 'vm.example.com', tls: 'tls' }),
  ).toString('base64');

describe('native-sub-html-links', () => {
  it('extracts .raw-link nodes like neo templates', () => {
    const html = `
      <div id="raw-links-container">
        <div class="raw-link">vless://uuid@cdn.example.com:443?type=ws&amp;security=tls#payg-1215-%F0%9F%9A%80%20NL%20Netherland%20(CDN)</div>
        <div class="raw-link">vless://uuid@us.example.com:443?security=reality#payg-1215-%F0%9F%8C%90%20us%20United%20States</div>
      </div>
    `;
    const links = extractRawLinkUrisFromHtml(html);
    expect(links).toHaveLength(2);
    expect(links[0]).toContain('cdn.example.com');
    expect(links[0]).toContain('type=ws&security=tls');
    expect(links[0]).toMatch(/\(CDN\)$/);
    expect(links[1]).toContain('us.example.com');
  });

  it('reads links from the default 3x-ui SPA page data (json.Marshal escapes)', () => {
    const payload = JSON.stringify({ sId: 'abc', links: [WS, GRPC, XHTTP, HTTPUPGRADE, VMESS], emails: ['a'] })
      .replace(/&/g, '\\u0026')
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e');
    const html = `<!doctype html><html><head><script>window.X_UI_BASE_PATH="/";window.__SUB_PAGE_DATA__=${payload};</script></head><body><div id="root"></div></body></html>`;
    expect(looksLikeSubscriptionHtml(html)).toBe(true);
    expect(extractRawLinkUrisFromHtml(html)).toEqual([WS, GRPC, XHTTP, HTTPUPGRADE, VMESS]);
  });

  it('decodes JS-context escapes from custom templates', () => {
    const js = WS.replace(/&/g, '\\u0026').replace(/=/g, '\\u003d').replace(/\//g, '\\/');
    const html = `<html><body><script>const links = ["${js}"];</script></body></html>`;
    expect(extractRawLinkUrisFromHtml(html)).toEqual([WS]);
  });

  it('decodes html/template entities including &#43; inside vmess base64', () => {
    const escaped = VMESS.replace(/\+/g, '&#43;');
    const html = `<div class="raw-link">${escaped}</div><div class="raw-link">${GRPC.replace(/&/g, '&amp;')}</div>`;
    expect(extractRawLinkUrisFromHtml(html)).toEqual([VMESS, GRPC]);
  });

  it('falls back to protocol URIs when raw-link is absent', () => {
    const html = `<html><body>vless://a@host.example:443?encryption=none#Name</body></html>`;
    expect(extractRawLinkUrisFromHtml(html)).toEqual([
      'vless://a@host.example:443?encryption=none#Name',
    ]);
  });

  it('normalizes escaped URIs', () => {
    expect(normalizeShareUri('vless:\\/\\/u@h:1?type\\u003dws\\u0026path\\u003d%2F#x')).toBe(
      'vless://u@h:1?type=ws&path=%2F#x',
    );
  });

  it('detects subscription HTML pages', () => {
    expect(looksLikeSubscriptionHtml('<div class="raw-link">vless://x</div>')).toBe(
      true,
    );
    expect(looksLikeSubscriptionHtml('dmxlc3M6Ly9hYmM=')).toBe(false);
  });
});
