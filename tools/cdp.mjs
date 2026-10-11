#!/usr/bin/env node
/* Minimal Chrome DevTools Protocol client, no dependencies (Node 22+ WebSocket).

   Local emulator screenshots at the Deck's 854x534 CSS px @1.5x = 1280x800 (Playwright's headless Chromium):
     node tools/cdp.mjs shoot <url> <out.png> [--keys ArrowRight,ArrowRight] [--wait 800]
     node tools/cdp.mjs probe <url>        (run tools/probe.js against an emulator page)

   Steam Deck, with CEF remote debugging enabled (Settings > Developer, or
   Decky's "Allow Remote CEF Debugging"), from a machine on the same network:
     node tools/cdp.mjs deck <deck-ip> [--out probe-output]
   Lists the Steam UI targets, and for bigpicture / MainMenu / QuickAccess saves a
   screenshot plus tools/probe.js results (which theme selectors match live elements).
   Read-only: it evaluates the probe and captures pixels, nothing else. */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : fallback;
}

class Session {
  static async open(wsUrl) {
    const s = new Session();
    s.ws = new WebSocket(wsUrl);
    s.id = 0;
    s.pending = new Map();
    s.listeners = [];
    s.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && s.pending.has(msg.id)) {
        const { resolve, reject } = s.pending.get(msg.id);
        s.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) s.listeners.forEach((l) => l(msg));
    };
    await new Promise((resolve, reject) => {
      s.ws.onopen = resolve;
      s.ws.onerror = () => reject(new Error('WebSocket failed: ' + wsUrl));
    });
    return s;
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  }
  async screenshot(file) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(data, 'base64'));
  }
  async key(key) {
    const codes = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Enter: 13, q: 81, e: 69 };
    for (const type of ['keyDown', 'keyUp'])
      await this.send('Input.dispatchKeyEvent', { type, key, code: key.length === 1 ? 'Key' + key.toUpperCase() : key, windowsVirtualKeyCode: codes[key] });
  }
  close() {
    this.ws.close();
  }
}

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

function findHeadless() {
  const base = join(homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(base)) return null;
  for (const d of readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell')).sort().reverse()) {
    const bin = join(base, d, 'chrome-mac', 'headless_shell');
    if (existsSync(bin)) return bin;
  }
  return null;
}

// Opens url in a local headless Chromium at the Deck's 854x534 @1.5x, waits for the emulator, runs fn(session).
async function withLocalPage(url, fn) {
  const bin = process.env.CHROMIUM || findHeadless();
  if (!bin) throw new Error('No headless Chromium found; set CHROMIUM=/path/to/chrome');
  const port = 9333;
  const proc = spawn(bin, [`--remote-debugging-port=${port}`, '--window-size=854,534', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  try {
    let targets;
    for (let i = 0; i < 50 && !targets; i++) {
      await sleep(100);
      targets = await json(`http://127.0.0.1:${port}/json/list`).catch(() => null);
    }
    const page = targets.find((t) => t.type === 'page');
    const s = await Session.open(page.webSocketDebuggerUrl);
    await s.send('Page.enable');
    // The Deck renders its UI at 854x534 CSS px, scaled 1.5x to the 1280x800 panel.
    await s.send('Emulation.setDeviceMetricsOverride', { width: 854, height: 534, deviceScaleFactor: 1.5, mobile: false });
    await s.send('Page.navigate', { url });
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      if ((await s.evaluate('document.documentElement.dataset.ready').catch(() => null)) === '1') break;
    }
    await sleep(Number(arg('wait', 800)));
    for (const k of (arg('keys', '') || '').split(',').filter(Boolean)) {
      await s.key(k);
      await sleep(450);
    }
    if (arg('keys')) await sleep(500);
    await fn(s);
    s.close();
  } finally {
    proc.kill();
  }
}

async function shoot(url, out) {
  await withLocalPage(url, (s) => s.screenshot(out));
  console.log('wrote', out);
}

function printReport(name, report) {
  const misses = report.rows.filter((r) => r.matches === 0);
  console.log(`\n${name}: ${report.rules} selectors, ${misses.length} match nothing right now (mapping: ${report.mapping})`);
  misses.forEach((r) => console.log(`  0  [${r.file}] ${r.selector}`));
  return misses;
}

// Evaluate a JS expression in an emulator page (after --keys), print the JSON result.
async function evalLocal(url, expr) {
  await withLocalPage(url, async (s) => console.log(JSON.stringify(await s.evaluate(expr))));
}

async function probeLocal(url) {
  const probe = readFileSync(join(HERE, 'probe.js'), 'utf8');
  await withLocalPage(url, async (s) => printReport(url, await s.evaluate(probe)));
}

async function deck(ip) {
  const outDir = arg('out', 'probe-output');
  mkdirSync(outDir, { recursive: true });
  const targets = await json(`http://${ip}:8081/json`);
  console.log('Targets:');
  targets.forEach((t) => console.log(`  ${t.type.padEnd(8)} ${t.title}  ${t.url.slice(0, 80)}`));
  const pick = {
    bigpicture: (t) => /Steam Big Picture Mode/i.test(t.title) || /Valve(%20| )Steam(%20| )Gamepad/i.test(t.url),
    MainMenu: (t) => /^MainMenu/.test(t.title),
    QuickAccess: (t) => /^QuickAccess/.test(t.title),
  };
  const probe = readFileSync(join(HERE, 'probe.js'), 'utf8');
  const summary = {};
  for (const [name, test] of Object.entries(pick)) {
    const t = targets.find(test);
    if (!t) {
      console.log(`\n${name}: not found`);
      continue;
    }
    const ws = t.webSocketDebuggerUrl.replace(/\/\/(localhost|127\.0\.0\.1)(:\d+)?/, `//${ip}:8081`);
    const s = await Session.open(ws);
    const report = await s.evaluate(probe);
    writeFileSync(join(outDir, `${name}.json`), JSON.stringify(report, null, 2));
    await s.screenshot(join(outDir, `${name}.png`)).catch((e) => console.log(`  screenshot failed: ${e.message}`));
    s.close();
    const misses = printReport(name, report);
    summary[name] = { rules: report.rules, zeroMatches: misses.length };
  }
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\nSaved screenshots and reports to ${outDir}/`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'shoot' && a && b) await shoot(a, b);
else if (cmd === 'probe' && a) await probeLocal(a);
else if (cmd === 'eval' && a && b) await evalLocal(a, b);
else if (cmd === 'deck' && a) await deck(a);
else {
  console.log('Usage:\n  node tools/cdp.mjs shoot <url> <out.png> [--keys ArrowRight,...] [--wait ms]\n  node tools/cdp.mjs probe <url>\n  node tools/cdp.mjs deck <deck-ip> [--out dir]');
  process.exit(1);
}
