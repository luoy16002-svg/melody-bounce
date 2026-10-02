# melodybounce.com

The browser version of melody-bounce: pick a scene and a song, preview it, and export a 1080×1920 MP4 without
leaving the page. Everything runs client-side, so the site is a plain static build.

```sh
npm run site          # dev server on http://127.0.0.1:5173
npm run site:build    # engine build + Vite build + static pages into site/dist
npm run site:preview  # serve site/dist
```

## How it fits together

- `src/main.tsx` is the maker. It runs the simulation in the page and builds the soundtrack in `src/audio-worker.ts`,
  using five trimmed upright piano notes from VSCO-2 CE in `public/piano/`.
- `src/VideoScene.tsx` is what the Player shows. `src/ExportScene.tsx` is what `@remotion/web-renderer` records:
  it mixes the soundtrack through `@remotion/media` and paints the scene backdrop on a canvas, because the
  renderer skips CSS radial gradients.
- `scripts/build-pages.mjs` writes the scene pages, guides, legal pages and sitemap after the Vite build. The
  numbers on the scene pages come from running the simulations, so rebuild after changing the physics.
- `content/catalog.json` holds scene names, blurbs and the default variation for each scene.

## Regenerating assets

With `npm run site` running:

- `dev/thumbs.html?scene=hexagon&t=14` renders one full-size frame for thumbnails and posters.
- `dev/og.html` (1200×630) and `dev/icon.html` (180×180) are the share image and touch icon.
- The scene previews in `public/previews/` are exports from the maker, scaled to 288×512 with
  `ffmpeg -vf scale=288:512 -r 30 -c:v libx264 -crf 31 -c:a aac -b:a 64k -movflags +faststart`.

## Deploying

The site is hosted on Cloudflare Pages (project `melodybounce`). Deploy `site/dist` as a direct upload.
