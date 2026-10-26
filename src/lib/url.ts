// domainOf — the registrable domain with "www." stripped. computed, never typed into content.

export function domainOf(url: string): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url);
  if (!m) throw new Error(`bad url: ${url}`);
  let host = m[1].toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  return host;
}
