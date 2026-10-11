#!/usr/bin/env node
/* Read-only inspection of the live Steam UI on a Deck, over Steam's CEF debug port.

   Decky keeps that port open on the Deck's localhost:8080. Tunnel it first:
     ssh -f -N -L 127.0.0.1:8081:localhost:8080 deck@<deck-ip>
   then:
     node tools/deckdom.mjs targets
     node tools/deckdom.mjs eval <target> '<js expression>'
     node tools/deckdom.mjs dump <target> '<js expression returning the root element>' [depth=12] [lines=600]
     node tools/deckdom.mjs snapshot <target> '<root expression>' <out.json>
   <target> is a title prefix: "Steam Big Picture", "QuickAccess", "MainMenu".

   dump prints the element tree with position, size, colour, background and filter,
   with Steam's hashed classes translated to readable names (CSS Loader's table).
   DECKDOM_NOTEXT=1 leaves out all text (for pages with account or friends' names).
   snapshot saves the root's markup for an emulator page, sanitized on the Deck
   before it is sent: every text that isn't a short UI label is replaced, images
   and url() backgrounds are dropped, and plugin elements removed.
   Nothing is changed on the Deck: expressions only read the DOM. Close the tunnel
   afterwards (pkill -f "8081:localhost:8080"). */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.DECK_CEF_PORT || 8081;
const [cmd, title, expr, depth = '12', maxLines = '600'] = process.argv.slice(2);

function readableNames() {
  // The emulator's copy if present, else the translation table tools/check_theme.py caches.
  const file = [join(HERE, '../preview/mapping.json'), join(HERE, '.cache/stable.json')].find((f) => existsSync(f));
  if (!file) throw new Error('no class mapping: run python3 tools/check_theme.py once to fetch it');
  const mapping = JSON.parse(readFileSync(file, 'utf8'));
  const READ = /^[a-z][a-z0-9]*_[A-Za-z][A-Za-z0-9-]*$/;
  const rev = new Map();
  for (const v of Object.values(mapping)) {
    const r = v.find((n) => READ.test(n) && !/_[A-Za-z0-9-]{5}$/.test(n.split('_').slice(1).join('_'))) || v.find((n) => READ.test(n));
    if (r) for (const n of v) if (!rev.has(n)) rev.set(n, r);
  }
  return rev;
}

async function evaluate(targetTitle, expression) {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const t = targets.find((x) => x.title.startsWith(targetTitle));
  if (!t) throw new Error(`no target "${targetTitle}"; have: ${targets.map((x) => x.title).join(', ')}`);
  const ws = new WebSocket(t.webSocketDebuggerUrl.replace(/\/\/[^/]+/, `//127.0.0.1:${PORT}`));
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = () => j(new Error('WebSocket failed')))));
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
  const msg = await new Promise((r) => (ws.onmessage = (e) => r(JSON.parse(e.data))));
  ws.close();
  if (msg.result?.exceptionDetails) throw new Error(msg.result.exceptionDetails.exception?.description || 'exception');
  return msg.result?.result?.value;
}

const dumpExpr = (rootExpr) => `(() => {
  const out = [];
  const root = (${rootExpr});
  if (!root) return 'root not found';
  const walk = (el, d) => {
    if (d > ${Number(depth)} || out.length > ${Number(maxLines)}) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return;
    const r = el.getBoundingClientRect();
    const bg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? ' bg=' + cs.backgroundColor : '';
    const bgi = cs.backgroundImage !== 'none' ? ' bgi=' + cs.backgroundImage.slice(0, 60) : '';
    const bs = cs.boxShadow !== 'none' ? ' shadow' : '';
    const fil = cs.filter !== 'none' ? ' filter=' + cs.filter : '';
    const txt = ${process.env.DECKDOM_NOTEXT ? 'false' : 'true'} && el.children.length === 0 && el.textContent.trim() ? ' "' + el.textContent.trim().slice(0, 30) + '"' : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? ' .' + el.className.trim().split(/\\s+/).join('.') : '';
    const role = el.getAttribute('role') ? ' [role=' + el.getAttribute('role') + ']' : '';
    out.push('  '.repeat(d) + el.tagName.toLowerCase() + cls + role + ' @' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' c=' + cs.color + bg + bgi + bs + fil + txt);
    if (el.tagName === 'svg') return;
    for (const c of el.children) walk(c, d + 1);
  };
  walk(root, 0);
  return out.join('\\n');
})()`;

const snapshotExpr = (rootExpr) => `(() => {
  const root = (${rootExpr});
  if (!root) return null;
  const clone = root.cloneNode(true);
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const texts = []; while (walker.nextNode()) texts.push(walker.currentNode);
  const fill = ['Sample text', 'Event title text', 'Option', 'A short description goes here'];
  let n = 0;
  for (const t of texts) {
    const s = t.textContent.trim();
    if (!s) continue;
    if (/^[0-9,.%:]+$/.test(s)) { t.textContent = '123'; continue; }
    // Keep short labels written in Steam's UI (title case words, no personal data).
    if (s.length <= 28 && /^[A-Z][A-Za-z ]*[a-z.…]?$/.test(s) && !/[0-9@]/.test(s)) continue;
    t.textContent = fill[n++ % fill.length];
  }
  clone.querySelectorAll('img').forEach((img, i) => { img.removeAttribute('srcset'); img.src = 'about:blank'; img.setAttribute('data-emu-img', i); });
  clone.querySelectorAll('[style*="url("]').forEach((e) => (e.style.backgroundImage = 'none'));
  clone.querySelectorAll('[class*="decky"], [class*="protondb"], [class*="hltb"]').forEach((e) => e.remove());
  clone.querySelectorAll('a[href]').forEach((a) => a.removeAttribute('href'));
  clone.querySelectorAll('.gpfocus, .gpfocuswithin').forEach((e) => e.classList.remove('gpfocus', 'gpfocuswithin'));
  return clone.outerHTML;
})()`;

if (cmd === 'snapshot' && title && expr && process.argv[5]) {
  const { writeFileSync } = await import('node:fs');
  const html = await evaluate(title, snapshotExpr(expr));
  if (!html) throw new Error('root not found');
  writeFileSync(process.argv[5], html);
  console.log('wrote', process.argv[5], html.length, 'chars');
} else if (cmd === 'targets') {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  for (const t of targets) console.log(t.title, '|', t.url.slice(0, 100));
} else if (cmd === 'eval' && title && expr) {
  console.log(JSON.stringify(await evaluate(title, expr), null, 1));
} else if (cmd === 'dump' && title && expr) {
  const rev = readableNames();
  const text = String(await evaluate(title, dumpExpr(expr)));
  console.log(text.replace(/\.([^\s.[@]+)/g, (m, c) => '.' + (rev.get(c) || c)));
} else {
  console.log('Usage:\n  node tools/deckdom.mjs targets\n  node tools/deckdom.mjs eval <target> <expr>\n  node tools/deckdom.mjs dump <target> <rootExpr> [depth] [lines]');
}
