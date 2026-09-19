#!/usr/bin/env node
/**
 * build-css.mjs — compile the Tailwind CDN runtime away.
 *
 * Every page used to load https://cdn.tailwindcss.com and compile its CSS in
 * the browser, which Tailwind itself warns against in production: it ships the
 * whole engine and blocks the first paint. This does that work once, at commit
 * time, and leaves a plain <link> behind.
 *
 * Pages do not all share a theme (/membership/ has its own ink shade and
 * container widths, /kashf/ disables preflight), so themes live in
 * scripts/css/themes.mjs, each page is assigned one, and one stylesheet is
 * compiled per theme scanning only that theme's pages.
 *
 * Adding a page: give it <link rel="stylesheet" href="/css/wedeepen.css"> like
 * its neighbours and run the build. Changing a color: edit themes.mjs, never a
 * page. Adding a class: just use it, then run the build.
 *
 *   npm run css:build     compile and rewrite
 *   npm run css:check     fail if anything is stale (CI)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { THEMES, DEFAULT_THEME, themeFor } from './css/themes.mjs';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS_DIR = path.join(ROOT, 'css');
const SKIP_DIRS = new Set(['node_modules', 'tmp', 'scripts', 'images', 'infra', '.git', 'css']);
const CDN_TAG = '<script src="https://cdn.tailwindcss.com"></script>';
const CONFIG_RE = /\n?[ \t]*<script>\s*\n\s*tailwind\.config\s*=\s*\{[\s\S]*?\n\s*\}\s*\n\s*<\/script>\n?/;
const LINK_RE = /<link rel="stylesheet" href="\/css\/([a-z0-9-]+)\.css">/;
const CHECK = process.argv.includes('--check');

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(full));
    else if (e.isFile() && e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

async function compile(theme, files, outFile) {
  const cfg = path.join(CSS_DIR, '.tailwind.config.cjs');
  const input = path.join(CSS_DIR, '.input.css');
  const content = JSON.stringify(files.map(f => path.relative(ROOT, f)));
  await fs.writeFile(cfg, `module.exports = ${JSON.stringify({ ...theme, content }, null, 2)
    .replace(`"content": ${JSON.stringify(content)}`, `"content": ${content}`)};\n`);
  await fs.writeFile(input, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  try {
    await execFileAsync('npx', ['tailwindcss', '-c', cfg, '-i', input, '-o', outFile, '--minify'], { cwd: ROOT });
  } finally {
    await fs.rm(cfg, { force: true });
    await fs.rm(input, { force: true });
  }
}

async function main() {
  const files = (await walk(ROOT)).sort();
  const byTheme = new Map(Object.keys(THEMES).map(n => [n, []]));
  const pageTheme = new Map();

  for (const file of files) {
    const html = await fs.readFile(file, 'utf-8');
    const linked = html.match(LINK_RE);
    const usesTailwind = html.includes(CDN_TAG) || linked;
    if (!usesTailwind) continue;
    const rel = '/' + path.relative(ROOT, file).replace(/index\.html$/, '').replace(/\\/g, '/');
    // An existing <link> is authoritative; otherwise fall back to the path map.
    const name = linked ? linked[1] : themeFor(rel);
    if (!byTheme.has(name)) throw new Error(`${rel}: unknown theme "${name}" (not in scripts/css/themes.mjs)`);
    byTheme.get(name).push(file);
    pageTheme.set(file, name);
  }

  await fs.mkdir(CSS_DIR, { recursive: true });
  const stale = [];

  for (const [name, themeFiles] of byTheme) {
    if (!themeFiles.length) { console.warn(`  ⚠ theme "${name}" has no pages`); continue; }
    const out = path.join(CSS_DIR, `${name}.css`);
    const scratch = path.join(CSS_DIR, `.build-${name}.css`);
    await compile(THEMES[name], themeFiles, scratch);
    const css = await fs.readFile(scratch, 'utf-8');
    await fs.rm(scratch);
    const current = await fs.readFile(out, 'utf-8').catch(() => null);
    if (current !== css) {
      if (CHECK) stale.push(`css/${name}.css`);
      else await fs.writeFile(out, css);
    }
    console.log(`  css/${name}.css  ${themeFiles.length} page(s), ${(css.length / 1024).toFixed(0)} KB`);
  }

  let rewritten = 0;
  for (const [file, name] of pageTheme) {
    const html = await fs.readFile(file, 'utf-8');
    const tag = `<link rel="stylesheet" href="/css/${name}.css">`;
    const next = html.includes(CDN_TAG)
      ? html.replace(CDN_TAG, tag).replace(CONFIG_RE, '\n')
      : html.replace(LINK_RE, tag);
    if (next !== html) {
      if (CHECK) stale.push(path.relative(ROOT, file));
      else { await fs.writeFile(file, next); rewritten++; }
    }
  }

  if (CHECK && stale.length) {
    console.error(`\ncss: ${stale.length} file(s) out of date. Run \`npm run css:build\`.`);
    for (const s of stale.slice(0, 20)) console.error(`  - ${s}`);
    process.exit(1);
  }
  console.log(CHECK
    ? `css: up to date (${pageTheme.size} pages)`
    : `css: ${pageTheme.size} pages, ${rewritten} rewritten (default theme: ${DEFAULT_THEME})`);
}

main().catch(e => { console.error(e); process.exit(1); });
