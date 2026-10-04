/**
 * Wrap a page's content in <main id="main"> (the accessibility landmark screen
 * readers use to skip the nav): opened before the first <section> after the
 * mobile nav, closed before the footer. Safe to run on any page, any number of
 * times; keep in sync with ensure_main() in podcast/data/generate_episode_pages.py.
 */
export function ensureMain(html) {
  const footer = html.lastIndexOf('<footer');
  if (footer === -1) return html;
  const lineStart = (i) => html.lastIndexOf('\n', i) + 1;
  if (!/<main\b/.test(html)) {
    const nav = html.indexOf('id="mobile-nav"');
    const first = html.indexOf('<section', nav === -1 ? 0 : nav);
    if (first === -1 || first > footer) return html;
    let a = lineStart(first);
    // Keep a section's leading comment banner inside <main>, with its section.
    const before = html.slice(0, a).replace(/\s+$/, '');
    if (before.endsWith('-->')) a = lineStart(before.lastIndexOf('<!--'));
    const b = lineStart(footer);
    return html.slice(0, a) + '  <main id="main">\n' + html.slice(a, b) + '  </main>\n' + html.slice(b);
  }
  if (!/<\/main>/.test(html)) {
    const b = lineStart(footer);
    return html.slice(0, b) + '  </main>\n' + html.slice(b);
  }
  return html;
}
