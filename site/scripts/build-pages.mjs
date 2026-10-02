// Writes the static pages (scenes, guides, about, legal, sitemap) into site/dist after `vite build`.
// Numbers on the scene pages come from running the real simulations, so they stay true if the physics changes.
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenes } from '../../dist/core/index.js';
import { naturalDuration } from '../../dist/core/timing.js';
import { createScore, timedCues } from '../../dist/core/audio/browser.js';
import { songs, defaultSongs } from '../../dist/core/songs/index.js';
import { page, catalog, sceneOrder, escapeHtml, SITE, GITHUB, ADSENSE, sceneCards } from '../content/partials.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const today = new Date().toISOString().slice(0, 10);
const urls = ['/'];

function write(path, html) {
  const dir = join(dist, path);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'index.html'), html);
  urls.push(path);
}

const fmt = (n, digits = 1) => Number(n).toFixed(digits);
const songTitle = scene => songs[defaultSongs[scene]].title;
const makerLink = scene => `/?scene=${scene}`;

// Run every scene for variations 1 to 40 and for its default variation.
const VARIATIONS = 40;
const facts = {};
for (const name of sceneOrder) {
  const runs = [];
  for (let seed = 1; seed <= VARIATIONS; seed++) {
    const data = scenes[name](seed), sim = {scene: name, data};
    runs.push({seed, data, seconds: naturalDuration(sim)});
  }
  const seed = catalog.scenes[name].seed, data = scenes[name](seed), sim = {scene: name, data};
  const seconds = naturalDuration(sim);
  const notes = timedCues(createScore(sim, songs[defaultSongs[name]].notes), seconds, 60).filter(c => c.role === 'melody').length;
  facts[name] = {runs, seed, data, seconds, notes};
}
const range = (values, digits = 0) => `${fmt(Math.min(...values), digits)} to ${fmt(Math.max(...values), digits)}`;
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const factBox = items => `<div class="facts">${items.map(([value, label]) => `<div><b>${value}</b><span>${label}</span></div>`).join('')}</div>`;

const sceneText = {
  hexagon: f => {
    const d = f.data, bounces = f.runs.map(r => r.data.bounces.length);
    return {
      title: 'Spinning hexagon bouncing ball video maker',
      description: `Make a spinning hexagon video where every bounce plays the next note of a song. The spin speeds up with each hit until the ball finds the gap. Free, in your browser.`,
      lede: `A ball bounces inside a spinning hexagon with a gap in one wall. The spin gets faster with every hit, and the ball has to find its way out. Each bounce plays the next note of ${songTitle('hexagon')}.`,
      facts: [[d.bounces.length, `bounces before it escapes (variation ${f.seed})`], [`${fmt(d.escaped)} s`, 'until the escape'], [range(bounces), `bounces to escape across ${VARIATIONS} variations`]],
      body: `
      <h2>What happens</h2>
      <p>The hexagon is 430 pixels from center to corner in a 1080×1920 frame. It starts turning at 1.3 radians per second, and every bounce makes it turn 1% faster, up to 3 radians per second. Gravity pulls the ball down the whole time. Because the walls are moving, a wall swinging into the ball throws it off faster than it arrived, so the bounces get livelier as the spin builds.</p>
      <p>One wall has a gap in the middle, 16% of the wall's length. The ball only gets out if it reaches the gap while moving outward. Sometimes that happens on the first bounce, sometimes after a hundred: across variations 1 to ${VARIATIONS} it took ${range(bounces)} bounces, with a median of ${median(bounces)}. When a variation ends too quickly, Shuffle in the maker skips it and only lands on runs where the ball stays in for at least 12 seconds.</p>
      <p>This is the ball-in-a-spinning-hexagon setup that turned into an informal coding test for AI models in early 2025, when people asked chatbots to write it and compared whose ball behaved. Here the physics runs at 960 steps a second, so the ball never tunnels through a wall.</p>
      <h2>What you hear</h2>
      <p>Each wall hit plays the next note of the melody on a sampled upright piano, panned toward the side of the hit. A bass line from the Minuet comes in under it. When the ball gets out, a quick arpeggio runs up and a chord rings out.</p>
      <h2>Songs that fit</h2>
      <p>The ball hits a wall about twice a second, and every note lands on a bounce, so the original rhythm of a tune is replaced by the rhythm of the bounces. Melodies made of even, steady notes survive that best. ${songTitle('hexagon')} is the default for that reason, and Ode to Joy works almost as well. Tunes that depend on a rhythm, like the short-short-long of Mozart's Symphony No. 40, are harder to recognise.</p>`,
    };
  },
  rings: f => {
    const broken = f.runs.map(r => r.data.breaks.length), all = broken.filter(b => b === 22).length;
    return {
      title: 'Escape the rings: bouncing ball music video maker',
      description: 'A ball breaks out of 22 spinning rings, and every bounce plays the next note of Für Elise or a song you choose. Make the video free in your browser.',
      lede: `A ball bounces inside 22 spinning rings, one inside the other. Each ring has a gap, and when the ball slips through it, that ring breaks. Each bounce plays the next note of ${songTitle('rings')}.`,
      facts: [['22', 'rings to break'], [`${fmt(f.data.escapedAt)} s`, `until the last ring breaks (variation ${f.seed})`], [`${all} of ${VARIATIONS}`, 'variations where the ball breaks all 22']],
      body: `
      <h2>What happens</h2>
      <p>The rings get bigger from the inside out, with radii from 150 to 780 pixels, and their gaps get narrower as they go. Neighbouring rings spin in opposite directions at different speeds. The ball falls under gravity and only ever touches the innermost ring that is still standing. When it gets through that ring's gap, the ring shatters and the next one out takes over.</p>
      <p>A run stops after 62 seconds whether or not the ball is free. Across variations 1 to ${VARIATIONS} the ball broke ${range(broken)} rings, and got through all 22 in ${all} of them. The maker's default, variation ${f.seed}, is one of the clean escapes, and Shuffle only picks variations that break at least 20 rings.</p>
      <h2>What you hear</h2>
      <p>Every bounce plays the next note of the melody. A ring breaking plays its note with an extra low note two octaves down and a soft bell on top, so you can hear the breaks without watching. When the last ring goes, a six-note chord plays and the video holds for a few seconds.</p>
      <h2>Songs that fit</h2>
      <p>This is the longest scene, often close to a minute, so it can carry a whole tune. ${songTitle('rings')} is the default because its opening comes back several times and is easy to recognise even when the bounces stretch the rhythm. Canon in D and Ode to Joy are good long choices too.</p>`,
    };
  },
  galton: f => {
    const counts = f.data.counts, expected = counts.map((_, k) => Math.round(300 * binomial(12, k) / 4096));
    return {
      title: 'Galton board music video: 300 balls, one bell curve',
      description: 'Watch 300 balls fall through 12 rows of pegs while each bin plays its own note. A Galton board video you can make and download free in your browser.',
      lede: '300 balls fall through 12 rows of pegs into 13 bins. Each bin plays its own note, so as the bins fill up you can hear the bell curve take shape.',
      facts: [['300', 'balls'], ['12', 'rows of pegs'], [`${fmt(f.seconds)} s`, 'video length']],
      body: `
      <h2>What happens</h2>
      <p>At every peg a ball goes left or right with equal chance. After 12 rows, the bin it lands in is simply the number of times it went right. That gives a binomial distribution: the middle bin collects about 23% of the balls and the outer bins almost none. A new ball drops every 0.08 seconds, so all 300 are down in under half a minute.</p>
      <table><tr><th>Bin</th>${counts.map((_, k) => `<th>${k}</th>`).join('')}</tr>
        <tr><td>Variation ${f.seed}</td>${counts.map(c => `<td>${c}</td>`).join('')}</tr>
        <tr><td>Expected</td>${expected.map(c => `<td>${c}</td>`).join('')}</tr></table>
      <p>${counts[0] + counts[12] > 0 ? `Variation ${f.seed} even put a ball in an end bin, a path with odds of 1 in 4,096 for a single ball.` : 'The end bins are rare: a single ball has a 1 in 4,096 chance of reaching each of them.'} With 300 balls, at least one lands in either end bin in roughly 1 run out of 7.</p>
      <h2>What you hear</h2>
      <p>Each landing plays the note for its bin, low on the left and high on the right, using a D major pentatonic scale. Most balls land in the middle, so the middle notes repeat most and the sound settles toward the center as the curve fills. Every peg hit adds a quiet tick, which turns into a soft rain once dozens of balls are falling at once.</p>
      <h2>Songs that fit</h2>
      <p>The bins take the first 13 notes of whatever melody you pick, left to right. A scale sounds the most natural because neighbouring bins get neighbouring notes. With a tune like Für Elise the board plays fragments of it in a scrambled order, which can sound good too, just less tidy.</p>`,
    };
  },
  grow: f => {
    const fill = f.runs.map(r => r.data.fillAt);
    return {
      title: 'Growing ball video maker: it gets bigger on every bounce',
      description: 'A ball that grows with every bounce until it fills the circle, with every bounce playing the next note of Canon in D. Make it free in your browser.',
      lede: `The ball gets a little bigger with every bounce until it fills the whole circle. Each bounce plays the next note of ${songTitle('grow')}.`,
      facts: [[f.data.count, 'bounces to fill the circle'], [`${fmt(f.data.fillAt)} s`, `until it's full (variation ${f.seed})`], [`${range(fill, 1)} s`, `to fill, across ${VARIATIONS} variations`]],
      body: `
      <h2>What happens</h2>
      <p>The ball starts with a radius of 26 pixels inside a circle of 440. Each bounce adds up to 8 pixels while the ball is small and less as it gets close to the wall, so the last few percent take the most bounces. The counter at the top shows how full the circle is. The ball always needs ${f.data.count} bounces, but how long they take depends on the variation: between ${range(fill, 1)} seconds.</p>
      <p>As the ball fills the circle there is less room to fall, so the bounces come faster and faster near the end. The scene keeps the speed up on purpose, so the last bounces sound like a drum roll before the ball locks in place.</p>
      <h2>What you hear</h2>
      <p>Each bounce plays the next melody note. Once the ball is a fifth of the way full, the Canon's bass line comes in underneath and follows the chord changes. Notes get shorter as the bounces speed up, and a full chord plays when the ball fills the circle.</p>
      <h2>Songs that fit</h2>
      <p>${songTitle('grow')} is the default because its bass line already repeats in a loop, which suits a scene that builds steadily. Any melody works, and the faster bounces near the end will speed it up whatever you choose.</p>`,
    };
  },
  multiply: f => {
    const seconds = f.runs.map(r => r.seconds);
    return {
      title: 'Every bounce adds a ball: multiplying balls video maker',
      description: 'One ball turns into 200 as every bounce spawns another, while a widening gap lets them out. Each hit plays a note. Make the video free in your browser.',
      lede: 'One ball becomes two, then four, then hundreds. Every bounce can add a new ball, and every hit plays the next note of the melody.',
      facts: [['200', 'balls by the end'], [`${fmt(f.seconds)} s`, `video length (variation ${f.seed})`], [f.notes, 'melody notes played']],
      body: `
      <h2>What happens</h2>
      <p>It starts with a single ball. Every bounce spawns a new ball until there are 24 of them, and after that each bounce adds one 22% of the time, up to 200 in total. The circle has a gap that rotates and, after the first 8 seconds, slowly gets wider. Balls that fall through it are gone. The video ends when the last of the 200 has left, which takes between ${range(seconds, 1)} seconds depending on the variation.</p>
      <h2>What you hear</h2>
      <p>With this many balls the hits would pile on top of each other, so hits closer together than 75 milliseconds share a note. The melody still runs fast, up to thirteen notes a second when the circle is crowded. Past 60 balls an octave doubles the melody, past 100 a low note joins in on every other hit, so the sound gets fuller as the circle gets crowded.</p>
      <h2>Songs that fit</h2>
      <p>${songTitle('multiply')} is the default because it starts slow and ends at a gallop, which is exactly what this scene does to any tune. Short melodies loop many times here, so pick something that still sounds good on its fifth repeat.</p>`,
    };
  },
  shrink: f => ({
    title: 'Shrinking ring video maker: how many bounces can it take?',
    description: 'The ring shrinks 1.5% on every hit until the ball no longer fits, and every bounce plays the next note. Make the shrinking ring video free in your browser.',
    lede: `The ring gets 1.5% smaller every time the ball hits it, until the ball no longer fits. Each bounce plays the next note of ${songTitle('shrink')}.`,
    facts: [[f.data.bounces.length, 'bounces until the ball is squeezed'], [`${fmt(f.data.squeezed)} s`, 'until it ends'], ['1.5%', 'smaller on every hit']],
    body: `
      <h2>What happens</h2>
      <p>The ring starts with a radius of 470 pixels and the ball's is 24. There is no gravity. The ball starts in the middle at 1,500 pixels a second and gets 0.3% faster on each hit. Every hit shrinks the ring by 1.5%, and when the ring is less than 1.7 times the ball's size the ball is stuck and the video ends.</p>
      <p>That takes ${f.data.bounces.length} bounces every time, because 470 × 0.985 to the power of ${f.data.bounces.length} is the first value under the limit. With no gravity and a start in the dead center, the ball flies back and forth along one diameter, so a different variation only rotates the line it travels on.</p>
      <h2>What you hear</h2>
      <p>The ring gets smaller and the ball gets faster, so the time between hits keeps shrinking and the melody accelerates on its own. By the end the notes come so close together that they blur into a trill before the final hit.</p>
      <h2>Songs that fit</h2>
      <p>${songTitle('shrink')} is the default because it is written to speed up, so the acceleration sounds deliberate. Anything with a strong repeating figure works well here.</p>`,
  }),
  strings: f => ({
    title: '100 strings video maker: can the ring hold them?',
    description: 'Each bounce ties a glowing string from the ring to the ball and speeds it up. At 100 strings the ring breaks. Make the video free in your browser.',
    lede: `Each bounce ties a string between the ring and the ball and makes the ball faster. The ring has to hold 100 of them. Each bounce plays the next note of ${songTitle('strings')}.`,
    facts: [['100', 'strings until the ring breaks'], [`${fmt(f.data.breakAt)} s`, `until it breaks (variation ${f.seed})`], ['2.2%', 'faster after every hit']],
    body: `
      <h2>What happens</h2>
      <p>There is no gravity in this one. The ball starts at 1,100 pixels a second and gets 2.2% faster with every hit. Each hit leaves a string from the point of impact to the ball, and all the strings stay tied to the ball as it moves, so they sweep around the circle like a web. After each bounce the ball's new direction is nudged a little so that its path keeps crossing the ring away from the center, which spreads the strings into a star.</p>
      <p>On the 100th hit the ring breaks into pieces and every string snaps back. Across variations the break comes ${range(f.runs.map(r => r.data.breakAt), 1)} seconds in.</p>
      <h2>What you hear</h2>
      <p>Every hit plays the melody note on piano with a plucked note an octave below. After 25 strings, a bass note follows the harmony underneath. The hits speed up with the ball, so the last twenty strings come quickly.</p>
      <h2>Songs that fit</h2>
      <p>${songTitle('strings')} is the default: it is simple, everyone knows it, and its steady notes hold up when the tempo climbs. Canon in D also works well.</p>`,
  }),
  colorwar: f => {
    const red = f.runs.filter(r => r.data.final[0] > r.data.final[1]).length, blue = f.runs.filter(r => r.data.final[1] > r.data.final[0]).length;
    const [r, b] = f.data.final;
    return {
      title: 'Color war video maker: red vs blue bouncing balls',
      description: 'Two balls paint a ring in their own colour for 30 seconds, and every bounce plays a note. Pick a side, then make the video free in your browser.',
      lede: 'Two balls, red and blue, paint the ring in their own colour every time they hit it. Whoever owns more of the ring after 30 seconds wins.',
      facts: [[`${r} : ${b}`, `final score in segments (variation ${f.seed})`], [`${red} / ${blue}`, `red and blue wins over ${VARIATIONS} variations`], ['72', 'segments in the ring']],
      body: `
      <h2>What happens</h2>
      <p>The ring is split into 72 segments. Each hit paints the segment it lands on and two on either side in the ball's colour, taking them over from the other side if needed. Both balls start at 1,250 pixels a second and get 0.4% faster with every hit, up to 2,300. After 30 seconds the paint is counted.</p>
      <p>It's a fair fight: across variations 1 to ${VARIATIONS}, red won ${red} times and blue ${blue}${red + blue < VARIATIONS ? `, with ${VARIATIONS - red - blue} draw${VARIATIONS - red - blue > 1 ? 's' : ''}` : ''}. The maker's default, variation ${f.seed}, ends ${r} to ${b}, close enough that the lead changes right up to the end. Shuffle never picks a variation that ends in a draw.</p>
      <h2>What you hear</h2>
      <p>Red plays its notes on piano from the left, blue on a plucked string from the right, so you can follow the score with your eyes closed. A bass note comes in on every fifth hit, and a woodblock knocks when the balls clash. The last five seconds tick down with a speeding woodblock and a rising tone, and the winner gets a closing arpeggio in its own sound.</p>
      <h2>Songs that fit</h2>
      <p>${songTitle('colorwar')} is the default because it is fast and a little playful, which suits a contest. This scene works best on TikTok and Shorts if the caption asks people to pick a colour before the end.</p>`,
    };
  },
  race: f => {
    const winners = [0, 0, 0, 0];
    f.runs.forEach(r => { if (r.data.winner !== null) winners[r.data.winner]++; });
    const names = ['red', 'blue', 'green', 'yellow'];
    return {
      title: 'Ball race video maker: four balls, one exit',
      description: 'Four balls race for one small spinning exit and every bounce plays a note. First one out wins. Make the race video free in your browser.',
      lede: 'Four balls, red, blue, green and yellow, bounce around a ring with one small spinning exit. The first ball out wins.',
      facts: [[names[f.data.winner].toUpperCase(), `wins variation ${f.seed}`], [`${fmt(f.data.winAt)} s`, 'winning time'], [winners.join(' / '), `wins by colour over ${VARIATIONS} variations`]],
      body: `
      <h2>What happens</h2>
      <p>The balls start near the top with random speeds and fall under gravity. The exit is a short opening in the ring that rotates at 0.55 radians per second, so it keeps moving away from wherever the balls are. The balls also knock into each other. The race ends the moment one ball is through.</p>
      <p>No colour has an edge: over variations 1 to ${VARIATIONS}, red won ${winners[0]} times, blue ${winners[1]}, green ${winners[2]} and yellow ${winners[3]}. Races can be over in a second or last more than half a minute, with a median of about ${fmt(median(f.runs.map(r => r.data.winAt)))} seconds, so Shuffle only picks races that last at least 8 seconds.</p>
      <h2>What you hear</h2>
      <p>Every hit on the ring plays the next note of the melody. Collisions between balls play a sharp clack, and a ball that only just misses the exit gets a swoosh and a high bell, so the near misses are easy to hear. Longer races build up as they go: a bass line joins after 5 seconds and bells double the melody after 12.</p>
      <h2>Songs that fit</h2>
      <p>${songTitle('race')} is the default. Races are short, so pick a melody that is recognisable from its first ten notes.</p>`,
    };
  },
};

function binomial(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }

for (const name of sceneOrder) {
  const f = facts[name], text = sceneText[name](f), meta = catalog.scenes[name];
  const others = sceneOrder.filter(other => other !== name);
  const body = `
      <p class="crumbs"><a href="/">Maker</a> / <a href="/scenes/">Scenes</a> / ${escapeHtml(meta.name)}</p>
      <div class="scene-hero">
        <video controls playsinline preload="none" poster="/posters/${name}.webp" src="/previews/${name}.mp4" aria-label="${escapeHtml(meta.name)} preview with sound"></video>
        <div>
          <p class="kicker">Scene</p>
          <h1>${escapeHtml(meta.name)}</h1>
          <p class="lede">${text.lede}</p>
          <a class="cta" href="${makerLink(name)}">Make this video</a>
          ${factBox(text.facts)}
        </div>
      </div>
      ${text.body}
      <h2>Make your own</h2>
      <p>Open <a href="${makerLink(name)}">${escapeHtml(meta.name)} in the maker</a>, pick a song or upload a MIDI file, and download the MP4. Variation ${f.seed} is the one in the preview above. The same variation number always gives the same video, so you can share a link and get identical results.</p>
      <h2>Other scenes</h2>
      <ul>${others.map(o => `<li><a href="/scenes/${o}/">${escapeHtml(catalog.scenes[o].name)}</a>: ${escapeHtml(catalog.scenes[o].summary)}</li>`).join('')}</ul>`;
  write(`/scenes/${name}/`, page({
    path: `/scenes/${name}/`, title: `${text.title} · Melody Bounce`, description: text.description, body, current: '/scenes/',
    jsonLd: [
      {'@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        {'@type': 'ListItem', position: 1, name: 'Scenes', item: `${SITE}/scenes/`},
        {'@type': 'ListItem', position: 2, name: meta.name, item: `${SITE}/scenes/${name}/`}]},
      {'@context': 'https://schema.org', '@type': 'VideoObject', name: `${meta.name}: every bounce plays a note`, description: meta.summary,
        thumbnailUrl: `${SITE}/posters/${name}.webp`, contentUrl: `${SITE}/previews/${name}.mp4`, uploadDate: '2026-10-02',
        duration: `PT${Math.round(f.seconds)}S`},
    ],
  }));
}

write('/scenes/', page({
  path: '/scenes/', title: 'Nine physics scenes for bouncing ball music videos · Melody Bounce', current: '/scenes/',
  description: 'The nine Melody Bounce scenes: spinning hexagon, escape the rings, Galton board, growing ball, multiplying balls, shrinking ring, 100 strings, color war and ball race.',
  body: `
      <p class="kicker">Scenes</p>
      <h1>Nine scenes, one rule: every bounce plays the next note</h1>
      <p class="lede">Each scene is a small physics simulation with a goal, a counter and an ending. Pick one, give it a melody, and the collisions play the tune.</p>
      ${sceneCards()}
      <h2>How the scenes are built</h2>
      <p>Every scene runs on fixed 60 Hz physics with several substeps per frame and a seeded random number generator. That makes them deterministic: the same scene and variation number give the same video down to the frame, on any computer. The collisions are recorded with exact timestamps, and the soundtrack is built from that list, which is why the notes land on the hits.</p>
      <p>The scenes started as Python scripts for the <a href="https://www.youtube.com/channel/UCiav9M2tUyFhAMkMJbLO0JQ">Melody Bounce channel</a> and were ported to TypeScript for this site and the <a href="${GITHUB}">open-source engine</a>, with tests that check the port against the original, event by event.</p>`,
}));

// Guides
const guides = [
  {
    slug: 'make-a-bouncing-ball-music-video',
    title: 'How to make a bouncing ball music video',
    teaser: 'From picking a scene to posting it, with what tends to work on TikTok, Shorts and Reels.',
    description: 'A practical guide to making a bouncing ball music video in your browser and posting it to TikTok, YouTube Shorts or Instagram Reels.',
    body: `
      <p>Bouncing ball videos where every hit plays a note have been a steady format on TikTok and YouTube Shorts for a few years. They work because they set up a question in the first second (will it get out? which colour wins?) and the music rewards people for watching to the end. Here's how to make one with Melody Bounce and what to check before you post.</p>
      <h2>1. Pick a scene with a question in it</h2>
      <p>The scenes that hold attention best have an outcome you can't predict: the <a href="/scenes/hexagon/">spinning hexagon</a> (when does it escape?), <a href="/scenes/race/">ball race</a> and <a href="/scenes/colorwar/">color war</a> (who wins?), <a href="/scenes/strings/">100 strings</a> (does the ring hold?). The <a href="/scenes/galton/">Galton board</a> and <a href="/scenes/grow/">growing ball</a> are calmer and do well as loops. Every scene already has a two-line hook at the start and a question near the bottom of the screen.</p>
      <h2>2. Pick a melody people recognise</h2>
      <p>The notes follow the bounces, so the tune's original rhythm is replaced by the rhythm of the hits. Melodies people know from the first few notes survive that best: Für Elise, Ode to Joy, the Mountain King, Canon in D. You can also <a href="/guides/use-your-own-midi/">upload a MIDI file</a>, as long as you have the rights to the music.</p>
      <h2>3. Try a few variations</h2>
      <p>The variation number changes the starting conditions. Some runs are more dramatic than others: a hexagon escape at the last second, a color war decided by two segments. Press Shuffle a few times and watch the preview. Shuffle already skips runs that end too fast.</p>
      <h2>4. Download</h2>
      <p>Choose 30 fps for the usual social upload, or 60 fps if you want smoother motion and don't mind a longer export. The video is 1080×1920, H.264 with AAC audio, which every platform accepts. The export runs in your browser and usually takes less time than the video itself on a recent laptop. Keep the tab in front while it runs.</p>
      <h2>5. Before you post</h2>
      <ul>
        <li><b>Use the video's question in your caption.</b> "Which colour are you?" or "Guess the bounce count" gets people answering in the comments, which helps the video travel.</li>
        <li><b>Don't add a second soundtrack.</b> The notes are the point. Platform music on top hides the sync.</li>
        <li><b>Post the escape, not the trailer.</b> Cutting the video short to make people visit your profile usually backfires with this format. Viewers want to see the ending.</li>
        <li><b>Credit the music if it isn't yours.</b> The built-in tunes are public domain. For anything else, check the rights first. <a href="/guides/public-domain-music-for-videos/">More on that here</a>.</li>
      </ul>
      <p><a class="cta" href="/">Open the maker</a></p>`,
  },
  {
    slug: 'use-your-own-midi',
    title: 'Using your own MIDI file',
    teaser: 'How the melody is pulled out of a MIDI file, how to fix it when it picks the wrong part, and where to find files you can use.',
    description: 'How Melody Bounce extracts a melody from a MIDI file, how to choose the right track, and where to find public-domain MIDI files for bouncing ball videos.',
    body: `
      <p>You can drop any standard MIDI file (.mid or .midi) into the maker. It stays on your computer: the file is read in your browser and never uploaded. Here's what happens to it and how to get a good result.</p>
      <h2>How the melody is chosen</h2>
      <p>A MIDI file usually has several tracks: melody, chords, bass, drums. A bouncing ball can only play one note at a time, so Melody Bounce needs a single line of notes. It does this in two steps:</p>
      <ol>
        <li><b>Pick a track.</b> It skips drum tracks and takes the track with the most notes, since that is usually the melody or the busiest part.</li>
        <li><b>Keep the top voice.</b> When several notes start together, it keeps the highest one, and it skips notes that start under a higher note that is still being held. That strips the chords out of a piano part and leaves the tune on top.</li>
      </ol>
      <p>The rhythm is not kept: every note waits for the next bounce. So what matters is the order of the pitches, not their timing.</p>
      <h2>When it picks the wrong part</h2>
      <p>If you hear the accompaniment instead of the tune, open the <b>Melody track</b> list that appears under the upload box and pick another track. Track names come from the file, so a file with tracks called "Melody" or "Right hand" makes this easy. If the melody and the accompaniment share one track, the top-voice rule normally finds the tune, unless the accompaniment sits above it.</p>
      <h2>Getting a good result</h2>
      <ul>
        <li><b>Short is fine.</b> The melody loops when it runs out, so a 30-note theme is enough. Long files just play further into the piece.</li>
        <li><b>Clean files work best.</b> Files sequenced by hand from sheet music give cleaner melodies than files converted from audio, which tend to have stray notes.</li>
        <li><b>Watch the range.</b> Very low melodies sound muddy on the piano. If your tune sits low, the synth sound can be clearer.</li>
      </ul>
      <h2>Where to find MIDI files you can use</h2>
      <p>A composition can be in the public domain while a particular MIDI file of it is not, because the person who sequenced the file may hold rights in it. Look for files with an explicit licence.</p>
      <ul>
        <li><a href="https://www.mutopiaproject.org/">The Mutopia Project</a> publishes classical pieces with MIDI files under public domain or Creative Commons licences.</li>
        <li><a href="https://musescore.com/">MuseScore</a> has many user arrangements that can be exported as MIDI. Check the licence on each score.</li>
        <li>Your own music: export MIDI from any notation program or DAW.</li>
      </ul>
      <p><a class="cta" href="/">Try it with your file</a></p>`,
  },
  {
    slug: 'why-the-sync-never-drifts',
    title: 'Why the notes always land on the bounces',
    teaser: 'The engine runs the physics first and writes the soundtrack from it, sample by sample. Here is how.',
    description: 'How Melody Bounce keeps sound and picture in sync: deterministic physics, exact collision timestamps, and audio placed to the sample.',
    body: `
      <p>A common way to make a physics music video is to play a sound whenever the game engine reports a collision. It works for a live demo but drifts in a recording, because the sound is triggered when the frame is processed, not at the moment of impact, and frames are never perfectly on time. Melody Bounce does it the other way round.</p>
      <h2>Physics first, sound second</h2>
      <p>Each scene runs its whole simulation before anything is drawn. The physics uses a fixed time step, between 360 and 960 steps per second depending on the scene, so fast balls can't skip through walls between steps. Each collision is written to a list with its time to a tenth of a millisecond.</p>
      <p>The soundtrack is built from that list. Each collision takes the next note of the melody, and its sample starts at exactly <code>time × 48,000</code>, the audio frame of the impact. Hits that land within a few dozen milliseconds of each other share a note, so dense moments stay musical rather than turning into noise.</p>
      <h2>Drawing from the same data</h2>
      <p>The picture is drawn from the same simulation, frame by frame: frame 437 of a 60 fps video shows the state at 7.283 seconds, and the note for a hit at 7.280 seconds starts 160 audio samples before that point. Nothing is played back live, so there is nothing to drift.</p>
      <h2>Why the same variation gives the same video</h2>
      <p>The randomness in each scene (starting positions, small nudges after a bounce) comes from a seeded random number generator. The variation number is the seed. Same seed, same events, same notes, same video, on any machine. That is also how the engine is tested: the TypeScript port is checked against the original Python scripts, event by event.</p>
      <h2>In the browser</h2>
      <p>The maker runs the simulation in the page and builds the soundtrack in a background thread. When you export, your browser renders each frame, encodes it with the WebCodecs API and muxes it with the audio into an MP4. The code is <a href="${GITHUB}">open source</a> if you want to look under the hood or render from the command line.</p>`,
  },
  {
    slug: 'public-domain-music-for-videos',
    title: 'Which songs can you use in a bouncing ball video?',
    teaser: 'Compositions, recordings and MIDI files have separate rights. A short, practical overview.',
    description: 'A plain-language overview of public domain music for social videos: compositions vs recordings, MIDI files, and the classical pieces built into Melody Bounce.',
    body: `
      <p>This is a practical overview, not legal advice. Copyright rules differ between countries, so check the rules where you live if you're unsure.</p>
      <h2>Three different things</h2>
      <p>A piece of music can carry rights at three levels, and a video can use one without touching the others:</p>
      <ul>
        <li><b>The composition</b>: the melody and harmony as written. Beethoven's Für Elise is a composition.</li>
        <li><b>A recording</b>: a specific performance. A 2015 recording of Für Elise has its own rights, even though the piece is public domain.</li>
        <li><b>An arrangement or transcription</b>, including a MIDI file someone sequenced, can also be protected if it adds creative work.</li>
      </ul>
      <p>Melody Bounce never uses a recording. It plays the notes of the melody on a piano sample, one note per bounce. So for the built-in songs the only question is whether the composition is free to use.</p>
      <h2>The built-in songs</h2>
      <table>
        <tr><th>Song</th><th>Composer</th></tr>
        ${Object.values(songs).map(s => `<tr><td>${escapeHtml(s.title)}</td><td>${escapeHtml(s.composer)}</td></tr>`).join('')}
      </table>
      <p>All of these composers died before 1910, Grieg last in 1907, and the pieces are in the public domain worldwide. The piano is the VSCO-2 Community Edition upright piano, released under CC0, so the sound itself is free to use too.</p>
      <h2>Your own MIDI files</h2>
      <p>When you upload a MIDI file, the composition inside it is your responsibility. Pieces by composers who died long ago are usually safe; songs from the last hundred years usually are not, even if the MIDI file was free to download. Platforms like YouTube and TikTok match melodies, not just recordings, so a copyrighted melody can be flagged even when it's played by a bouncing ball.</p>
      <p>See <a href="/guides/use-your-own-midi/">Using your own MIDI file</a> for places to find files with clear licences.</p>`,
  },
];

for (const g of guides) {
  write(`/guides/${g.slug}/`, page({
    path: `/guides/${g.slug}/`, title: `${g.title} · Melody Bounce`, description: g.description, current: '/guides/',
    body: `
      <p class="crumbs"><a href="/">Maker</a> / <a href="/guides/">Guides</a></p>
      <p class="kicker">Guide</p>
      <h1>${escapeHtml(g.title)}</h1>
      ${g.body}
      <h2>More guides</h2>
      <ul>${guides.filter(o => o !== g).map(o => `<li><a href="/guides/${o.slug}/">${escapeHtml(o.title)}</a></li>`).join('')}</ul>`,
    jsonLd: [{'@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, datePublished: '2026-10-02',
      dateModified: today, author: {'@type': 'Organization', name: 'Melody Bounce'}, publisher: {'@type': 'Organization', name: 'Melody Bounce'},
      mainEntityOfPage: `${SITE}/guides/${g.slug}/`}],
  }));
}

write('/guides/', page({
  path: '/guides/', title: 'Guides · Melody Bounce', current: '/guides/',
  description: 'Guides for making bouncing ball music videos: making and posting one, using your own MIDI, how the sync works, and which songs you can use.',
  body: `
      <p class="kicker">Guides</p>
      <h1>Guides</h1>
      <p class="lede">Short, practical notes on making bouncing ball music videos and on how the engine works.</p>
      <ul class="guide-list">${guides.map(g => `<li><a href="/guides/${g.slug}/"><b>${escapeHtml(g.title)}</b><span>${escapeHtml(g.teaser)}</span></a></li>`).join('')}</ul>`,
}));

write('/about/', page({
  path: '/about/', title: 'About · Melody Bounce', current: '/about/',
  description: 'Melody Bounce is a free browser tool and an open-source engine for physics videos where every collision plays the next note of a song.',
  body: `
      <p class="kicker">About</p>
      <h1>About Melody Bounce</h1>
      <p class="lede">Melody Bounce makes physics videos where every collision plays the next note of a song.</p>
      <p>The same engine also powers <a href="https://card.melodybounce.com/">singing cards</a>, where the ball bounces along a song and lands on someone's name.</p>
      <p>It started as a set of Python scripts for a YouTube channel of short physics music videos. The scripts grew into a TypeScript engine with nine scenes, a sampled piano and a test suite, released as <a href="${GITHUB}">open source on GitHub</a> under the MIT licence. This site is the browser version: the same engine, running entirely on your computer, with an export button.</p>
      <h2>What it costs</h2>
      <p>Nothing. There is no account and no paid tier. Ads from Google AdSense pay for the site, and the tool itself stays free.</p>
      <h2>What's inside</h2>
      <ul>
        <li>The physics and soundtrack engine from the <a href="${GITHUB}">melody-bounce</a> repository (MIT).</li>
        <li><a href="https://www.remotion.dev">Remotion</a> for drawing the scenes and rendering video in the browser.</li>
        <li>The VSCO-2 Community Edition upright piano (CC0) and the Outfit typeface (SIL Open Font Licence).</li>
        <li>Public-domain melodies by Beethoven, Petzold, Grieg, Pachelbel and Mozart.</li>
      </ul>
      <h2>Contact</h2>
      <p>Found a bug or have an idea for a scene? <a href="${GITHUB}/issues">Open an issue on GitHub</a>.</p>`,
}));

write('/privacy/', page({
  path: '/privacy/', title: 'Privacy · Melody Bounce', current: '',
  description: 'What Melody Bounce does and does not collect. Your files and videos stay in your browser.',
  body: `
      <p class="kicker">Privacy</p>
      <h1>Privacy</h1>
      <p class="lede">Short version: your songs and videos never leave your computer and there are no accounts. The site is paid for by ads from Google AdSense, which uses cookies.</p>
      <p>Last updated ${today}. This policy covers melodybounce.com and its subdomains, including card.melodybounce.com.</p>
      <h2>Your files and videos</h2>
      <p>MIDI files you load are read in your browser. The simulation, the soundtrack and the video export all run on your device. Nothing you make is uploaded to us or anyone else.</p>
      <h2>Singing cards</h2>
      <p>The name, sender and message you type into a singing card are written into the card's link, after the # sign. Browsers never send that part of a link to a server, so we don't receive or store them. Anyone who has the link can open the card.</p>
      <h2>What the servers see</h2>
      <p>The site is hosted on Cloudflare Pages. Like any web host, Cloudflare processes your IP address and basic request details to deliver the pages and protect the site from abuse. See <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a>.</p>
      <p>We use Cloudflare Web Analytics to count visits. It does not use cookies or fingerprinting and only reports aggregated numbers, such as page views, referring sites and countries.</p>
      <h2>Video export</h2>
      <p>When you export a video, the rendering library, Remotion, sends a single anonymous count to Remotion's server: the website's address and whether the render succeeded. No personal data and none of your content is included.</p>
      <h2>Settings in your browser</h2>
      <p>The address bar keeps your current scene, song and variation so you can share a link, and the video player remembers your volume setting in your browser's local storage. Nothing else is stored.</p>
      <h2>Advertising</h2>
      <p>We use Google AdSense to show ads, which is how the site pays for itself. Third-party vendors, including Google, use cookies to serve ads based on your earlier visits to this site and to other websites. Google's use of advertising cookies lets it and its partners serve ads to you based on those visits.</p>
      <p>You can turn off personalised advertising in <a href="https://adssettings.google.com">Google's Ads Settings</a>, and opt out of some other vendors' cookies at <a href="https://optout.aboutads.info">aboutads.info</a> or <a href="https://www.youronlinechoices.eu">youronlinechoices.eu</a>. Google explains how it uses data from sites that show its ads in <a href="https://policies.google.com/technologies/partner-sites">How Google uses information from sites or apps that use our services</a>.</p>
      <p>If you visit from the European Economic Area, the UK or Switzerland, you are asked for consent through Google's consent message before personalised ads are shown, and you can change your choice at any time from the link in that message.</p>
      <h2>Contact</h2>
      <p>Questions about privacy: <a href="${GITHUB}/issues">open an issue on GitHub</a>.</p>`,
}));

write('/terms/', page({
  path: '/terms/', title: 'Terms of use · Melody Bounce', current: '',
  description: 'The terms for using the Melody Bounce website and the videos you make with it.',
  body: `
      <p class="kicker">Terms</p>
      <h1>Terms of use</h1>
      <p>Last updated ${today}.</p>
      <h2>Using the tool</h2>
      <p>Melody Bounce is free to use for personal and commercial projects. You don't need an account.</p>
      <h2>Your videos</h2>
      <p>Videos you make are yours. You can post, share and monetise them. A credit or link back is appreciated but not required.</p>
      <h2>Music you upload</h2>
      <p>If you load your own MIDI file, you are responsible for having the right to use the music in it. The built-in melodies are public-domain compositions.</p>
      <h2>The code</h2>
      <p>The engine is open source under the MIT licence; see the <a href="${GITHUB}">repository</a>. Rendering uses Remotion, which has <a href="https://www.remotion.dev/license">its own licence</a>.</p>
      <h2>No warranty</h2>
      <p>The site is provided as is, without any warranty. We are not liable for any loss or damage from using it. We may change or discontinue the site at any time.</p>
      <h2>Changes</h2>
      <p>If these terms change, the new version will be posted here with a new date.</p>`,
}));

// 404
writeFileSync(join(dist, '404.html'), page({
  path: '/404', title: 'Page not found · Melody Bounce', description: 'This page does not exist.',
  body: `
      <h1>That page bounced off the wall</h1>
      <p class="lede">The address doesn't match any page here.</p>
      <p><a class="cta" href="/">Go to the maker</a></p>
      ${sceneCards()}`,
}).replace('<link rel="canonical" href="https://melodybounce.com/404" />\n', '').replace(`  ${ADSENSE}\n`, ''));

// FAQ structured data for the maker page, taken from its own questions.
const indexPath = join(dist, 'index.html');
const indexHtml = readFileSync(indexPath, 'utf8');
const stripTags = html => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const faq = [...indexHtml.matchAll(/<details[^>]*><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/gs)]
  .map(([, q, a]) => ({'@type': 'Question', name: stripTags(q), acceptedAnswer: {'@type': 'Answer', text: stripTags(a)}}));
writeFileSync(indexPath, indexHtml.replace('</head>', `  <script type="application/ld+json">${JSON.stringify({'@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq})}</script>\n</head>`));

// Sitemap
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);

// Cache-bust the shared stylesheet in every page.
const css = readFileSync(join(dist, 'site.css'));
const version = createHash('sha256').update(css).digest('hex').slice(0, 10);
const walk = dir => readdirSync(dir).flatMap(entry => {
  const path = join(dir, entry);
  return statSync(path).isDirectory() ? walk(path) : path.endsWith('.html') ? [path] : [];
});
for (const file of walk(dist)) writeFileSync(file, readFileSync(file, 'utf8').replaceAll('href="/site.css"', `href="/site.css?v=${version}"`));

console.log(`${urls.length} pages, css v${version}`);
