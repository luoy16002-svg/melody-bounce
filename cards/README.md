# card.melodybounce.com

Singing cards: a ball bounces along a public-domain song in time with the piano and lands on the recipient's name.
The card lives entirely in its link (`/c/#o=birthday&to=Anna&from=Kai&m=...`), so there is no backend.

```sh
npm run cards          # dev server
npm run cards:build    # Vite build + occasion landing pages, sitemap and 404 into cards/dist
```

- `src/songs.ts`: lyrics, melodies and chords. One note per syllable; `~` marks a note sung on the same syllable.
- `src/score.ts`: melody, oom-pah accompaniment and the confetti finale as an engine `Score`, rendered to WAV in
  `src/audio-worker.ts` with the same piano samples as the main site.
- `src/Card.tsx`: the card, drawn on one canvas, so the browser renderer exports it exactly as previewed.
- `scripts/build-pages.mjs`: `/birthday/`, `/congratulations/` and `/christmas/` share the app and get their own copy.
- `dev/frame.html?o=birthday&to=Anna&t=18` renders one frame for stills; `dev/og.html` and `dev/og-card.html` are the
  share images.

Hosted on Cloudflare Pages (project `melodybounce-cards`, custom domain `card.melodybounce.com`).
