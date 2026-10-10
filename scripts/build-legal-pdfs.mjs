#!/usr/bin/env node
/**
 * Renders every legal document to apps/web/public/legal/<slug>.pdf with headless Chrome (printToPDF).
 *   node scripts/build-legal-pdfs.mjs            (brand from NEXT_PUBLIC_BRAND_NAME, default Zerventa)
 * Needs: packages/shared built (pnpm --filter @spova/shared build) and google-chrome / chromium on PATH.
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

// resolve ws and @spova/shared through the worker package, which depends on both
const require = createRequire(resolve(process.cwd(), 'apps/worker/package.json'));
const WebSocket = require('ws');
const { LEGAL_DOCS, legalText } = require('@spova/shared');
const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || 'Zerventa';
const OUT = resolve(process.cwd(), 'apps/web/public/legal');
mkdirSync(OUT, { recursive: true });

const chromeBin = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].find((b) => {
  try {
    execSync(`command -v ${b}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
});
if (!chromeBin) throw new Error('Chrome/Chromium not found');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const logo = `<svg width="34" height="34" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset=".55" stop-color="#2563eb"/><stop offset="1" stop-color="#1e40af"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 9h15"/><path d="M8.5 23h15"/><path d="M8.5 23 L13.5 16.5 L16.5 19.5 L23.5 9"/><path d="M18.5 9h5v5"/></g></svg>`;

const html = (d) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)} · ${esc(BRAND)}</title>
<style>
  @page { size: A4; margin: 22mm 18mm 24mm 18mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.55 "Helvetica Neue", Arial, sans-serif; color: #141b2c; margin: 0; }
  .head { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 22px; }
  .brand { font-size: 17pt; font-weight: 800; letter-spacing: -0.02em; }
  .meta { margin-left: auto; text-align: right; font-size: 8.5pt; color: #55617a; line-height: 1.4; }
  h1 { font-size: 22pt; letter-spacing: -0.02em; margin: 0 0 4px; }
  .sub { color: #55617a; margin: 0 0 20px; font-size: 10pt; }
  h2 { font-size: 12.5pt; margin: 18px 0 6px; page-break-after: avoid; color: #0b1220; }
  p { margin: 0 0 8px; text-align: justify; }
  .notice { margin-top: 26px; padding: 10px 12px; border: 1px solid #e2e7f0; border-radius: 8px; background: #f5f7fb; font-size: 9pt; color: #3f4a62; }
</style></head><body>
<div class="head">${logo}<span class="brand">${esc(BRAND)}</span><div class="meta">${esc(d.version)}<br>${esc(d.effective)}</div></div>
<h1>${esc(d.title)}</h1>
<p class="sub">${esc(legalText(d.note, BRAND))}</p>
${d.sections.map((s) => `<h2>${esc(s.h)}</h2>${s.p.map((p) => `<p>${esc(legalText(p, BRAND))}</p>`).join('')}`).join('')}
<div class="notice">This document forms part of the Legal Documents of ${esc(BRAND)}. The current version is always the one published at /legal on the website. CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.</div>
</body></html>`;

const port = 9444;
const chrome = spawn(chromeBin, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/legal-pdf-profile', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {
    /* booting */
  }
  if (!target) await sleep(250);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.on('open', r));
let id = 0;
const pending = new Map();
ws.on('message', (m) => {
  const j = JSON.parse(m);
  if (j.id && pending.has(j.id)) {
    pending.get(j.id)(j);
    pending.delete(j.id);
  }
});
const send = (method, params = {}) => new Promise((r) => {
  pending.set(++id, r);
  ws.send(JSON.stringify({ id, method, params }));
});
await send('Page.enable');
const footer = `<div style="font:7.5pt Arial;color:#6b778f;width:100%;padding:0 18mm;display:flex;justify-content:space-between"><span>${esc(BRAND)} · Legal Documents</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
for (const d of LEGAL_DOCS) {
  await send('Page.navigate', { url: `data:text/html;charset=utf-8,${encodeURIComponent(html(d))}` });
  await sleep(400);
  const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer });
  const file = resolve(OUT, `${d.slug}.pdf`);
  writeFileSync(file, Buffer.from(pdf.result.data, 'base64'));
  console.log('wrote', file);
}
chrome.kill('SIGKILL');
process.exit(0);
