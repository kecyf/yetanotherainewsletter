// renderInline — the only place `why` text becomes html (DESIGN.md §11.5).
// backtick pairs become <code>; everything else is escaped. an unpaired backtick
// stays a literal backtick. the .md twin prints the same text verbatim, so the
// html and the twin carry identical content (the parity check strips <code> tags).

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (ch) => ESC[ch]);

export function renderInline(text: string): string {
  const parts = text.split('`');
  // an even number of parts means an odd number of backticks: the last one is unpaired
  const paired = parts.length % 2 === 1 ? parts.length : parts.length - 1;
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    if (i >= paired) {
      out += '`' + escapeHtml(parts[i]); // unpaired tail, literal
    } else if (i % 2 === 1) {
      out += `<code>${escapeHtml(parts[i])}</code>`;
    } else {
      out += escapeHtml(parts[i]);
    }
  }
  return out;
}
