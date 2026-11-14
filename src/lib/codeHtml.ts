// codeHtml: the html inside a code block, byte-identical in text to its source string.
// lines that start with "1. " become a hanging block (the number hangs, wrapped text sits under the text);
// every line keeps its own trailing newline inside its span, so textContent === the source string.
import { escapeHtml } from './inlineCode';

export function codeHtml(text: string): string {
  const lines = text.split('\n');
  return lines
    .map((line, i) => {
      const out = escapeHtml(line) + (i < lines.length - 1 ? '\n' : '');
      return /^\d+\. /.test(line) ? `<span class="hang">${out}</span>` : out;
    })
    .join('');
}
