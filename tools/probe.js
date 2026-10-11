/* NXE Deck selector probe.
   Run inside a Steam UI tab (CEF devtools console, or `node tools/cdp.mjs deck`).
   For every rule in the injected NXE Deck stylesheets it reports how many live
   elements the selector matches, with hashed classes shown as readable names.
   0 matches is expected for state rules (focus, selected, disabled) while that
   state isn't on screen; a structural rule with 0 matches is a miss.

   Paste the whole file into the console; it logs a table and returns the report. */
(async () => {
  async function loadMapping() {
    // CSS Loader keeps its copy next to the themes; the emulator serves one too.
    for (const url of ['/themes_custom/css_translations.json', '/mapping.json', 'https://api.deckthemes.com/stable.json']) {
      try {
        const r = await fetch(url);
        if (r.ok) return await r.json();
      } catch {}
    }
    return null;
  }

  function splitSelectors(text) {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of text) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  const mapping = await loadMapping();
  const readable = new Map();
  if (mapping) {
    for (const versions of Object.values(mapping)) {
      const alias = versions
        .slice(0, -1)
        .filter((v) => v.includes('_') && !v.startsWith('_') && !v.endsWith('_'))
        .sort((a, b) => a.length - b.length)[0];
      if (alias) readable.set(versions[versions.length - 1], alias);
    }
  }
  const unminify = (sel) => sel.replace(/\.([_a-zA-Z][\w-]*)/g, (m, c) => '.' + (readable.get(c) || c));

  const rows = [];
  for (const style of document.querySelectorAll('style')) {
    const head = style.textContent.match(/NXE Deck(?: option)?: ([^\n(.]*)/);
    if (!head || !style.sheet) continue;
    const file = head[1].trim();
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules && !rule.selectorText) walk(rule.cssRules); // @media etc.
        if (!rule.selectorText) continue;
        for (const sel of splitSelectors(rule.selectorText)) {
          const query = sel.replace(/::?(before|after|placeholder|selection|-webkit-[\w-]+)/g, '') || '*';
          let matches;
          try {
            matches = document.querySelectorAll(query).length;
          } catch {
            matches = 'invalid';
          }
          rows.push({ file, matches, selector: unminify(sel) });
        }
      }
    };
    walk(style.sheet.cssRules);
  }

  const report = { url: location.href, title: document.title, mapping: !!mapping, rules: rows.length, rows };
  console.table(rows);
  return report;
})();
