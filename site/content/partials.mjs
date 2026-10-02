// Shared HTML pieces for the maker page (through a Vite plugin) and the static pages (scripts/build-pages.mjs).
import { readFileSync } from 'node:fs';

export const SITE = 'https://melodybounce.com';
export const GITHUB = 'https://github.com/luoy16002-svg/melody-bounce';
export const catalog = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'));
export const sceneOrder = ['hexagon', 'rings', 'galton', 'grow', 'multiply', 'shrink', 'strings', 'colorwar', 'race'];

export const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const logo = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12.5" fill="none" stroke="#eef0ff" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="66 12.5" transform="rotate(-62 16 16)"/><circle cx="12.2" cy="19.6" r="4.3" fill="#ffc857"/></svg>`;

export function header(current = '') {
  const link = (href, label) => `<a href="${href}"${current === href ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="top">
    <a class="brand" href="/">${logo}<span>Melody Bounce</span></a>
    <nav>${link('/', 'Maker')}${link('/scenes/', 'Scenes')}${link('/guides/', 'Guides')}${link('/about/', 'About')}<a href="${GITHUB}">GitHub</a></nav>
  </header>`;
}

export function footer() {
  return `<footer class="foot">
    <span>© 2026 Melody Bounce. Open-source engine, public-domain melodies.</span>
    <nav><a href="/scenes/">Scenes</a><a href="/guides/">Guides</a><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="${GITHUB}">GitHub</a></nav>
  </footer>`;
}

export function sceneCards() {
  return `<div class="cards">${sceneOrder.map(name => {
    const s = catalog.scenes[name];
    return `<a class="card" href="/scenes/${name}/"><img src="/thumbs/${name}.webp" alt="" width="64" height="64" loading="lazy"><span><b>${escapeHtml(s.name)}</b><span>${escapeHtml(s.short)}</span></span></a>`;
  }).join('')}</div>`;
}

export function fillPartials(html, current = '/') {
  return html.replace('<!--#header-->', header(current)).replace('<!--#footer-->', footer()).replace('<!--#scene-cards-->', sceneCards());
}

/** A full static page around an article body. */
export function page({path, title, description, body, image = '/og.png', jsonLd = [], current = ''}) {
  const url = `${SITE}${path}`;
  const ld = jsonLd.map(item => `<script type="application/ld+json">${JSON.stringify(item)}</script>`).join('\n  ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${url}" />
  <meta name="theme-color" content="#07080f" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preload" href="/fonts/Outfit-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/site.css" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Melody Bounce" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${SITE}${image}" />
  <meta name="twitter:card" content="summary_large_image" />
  ${ld}
</head>
<body>
  ${header(current)}
  <main>
    <article class="article">
${body}
    </article>
  </main>
  ${footer()}
</body>
</html>
`;
}
