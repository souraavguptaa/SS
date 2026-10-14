// Render frames of the film with headless Chromium (software WebGL) in parallel workers.
// Usage: node tools/render.mjs --from 0 --to 120 --fps 24 --w 1920 --h 816 --workers 3 --out out/frames [--every 1] [--resume]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes('--' + k);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fps = +arg('fps', 24), W = +arg('w', 1920), H = +arg('h', 816);
const from = +arg('from', 0), to = arg('to') !== undefined ? +arg('to') : null;
const workers = +arg('workers', 3), every = +arg('every', 1), quality = +arg('quality', 94);
const out = path.resolve(arg('out', path.join(root, 'out/frames')));
const frameList = arg('frames'); // comma-separated list of explicit times (seconds)
const resume = flag('resume');
const edl = arg('edl');
const extra = arg('query', '');
fs.mkdirSync(out, { recursive: true });

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'];

const server = await serve(root);
const port = server.address().port;
const url = `http://127.0.0.1:${port}/index.html?w=${W}&h=${H}&fps=${fps}` + (edl ? `&edl=${encodeURIComponent(edl)}` : '') + (extra ? '&' + extra : '');

async function openPage() {
  const browser = await chromium.launch({ executablePath: exe, args, headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  return { browser, page };
}

// Build the job list
let jobs = [];
if (frameList) {
  jobs = frameList.split(',').map((s) => Math.round(+s * fps));
} else {
  const probe = await openPage();
  const filmLen = await probe.page.evaluate(() => window.FILM_LENGTH);
  await probe.browser.close();
  const end = to ?? filmLen;
  for (let f = Math.round(from * fps); f < Math.round(end * fps); f += every) jobs.push(f);
}
const name = (f) => path.join(out, `f_${String(f).padStart(5, '0')}.jpg`);
if (resume) jobs = jobs.filter((f) => !fs.existsSync(name(f)));
console.log(`rendering ${jobs.length} frames at ${W}x${H} with ${workers} workers -> ${out}`);

const t0 = Date.now();
let done = 0;
const chunks = Array.from({ length: workers }, (_, i) => jobs.slice(Math.floor((i * jobs.length) / workers), Math.floor(((i + 1) * jobs.length) / workers)));
await Promise.all(chunks.map(async (chunk, wi) => {
  if (!chunk.length) return;
  const { browser, page } = await openPage();
  // pre-build the sets this worker needs
  await page.evaluate(([a, b]) => window.prebuild(a, b), [chunk[0] / fps, chunk[chunk.length - 1] / fps]);
  for (const f of chunk) {
    await page.evaluate((t) => window.seek(t), f / fps);
    await page.screenshot({ path: name(f), type: 'jpeg', quality });
    done++;
    if (done % 24 === 0 || done === jobs.length) {
      const el = (Date.now() - t0) / 1000;
      const eta = (el / done) * (jobs.length - done);
      console.log(`${done}/${jobs.length} frames  ${(el / done).toFixed(2)}s/frame  eta ${(eta / 60).toFixed(1)} min`);
    }
  }
  await browser.close();
}));
server.close();
console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
