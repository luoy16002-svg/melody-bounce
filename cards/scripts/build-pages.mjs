// After `vite build`: occasion landing pages (same app, own copy), sitemap, 404, stylesheet cache-busting.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const SITE = 'https://card.melodybounce.com';
const today = new Date().toISOString().slice(0, 10);
const base = readFileSync(join(dist, 'index.html'), 'utf8');

const swap = (html, marker, value) => html.replace(new RegExp(`<!--#${marker}-->[\\s\\S]*?<!--/${marker}-->`), value);
const setMeta = (html, {path, title, description}) => html
  .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  .replace(/(<meta name="description" content=")[^"]*/, `$1${description}`)
  .replace(/(<link rel="canonical" href=")[^"]*/, `$1${SITE}${path}`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}${path}`)
  .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title.split(' · ')[0]}`)
  .replace(/(<meta property="og:description" content=")[^"]*/, `$1${description}`);

const faq = items => `<section class="band faq"><h2>Questions</h2>${items.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>`;
const others = path => `<section class="band"><h2>Other cards</h2><div class="cards">${[
  ['/birthday/', 'Birthday', 'Happy Birthday, with their name in the third line.'],
  ['/congratulations/', 'Congratulations', 'For a new job, a graduation or a retirement.'],
  ['/christmas/', 'Christmas', 'We Wish You a Merry Christmas, with their name on top.'],
].filter(([p]) => p !== path).map(([p, t, d]) => `<a class="card" href="${p}"><span><b>${t}</b><span>${d}</span></span></a>`).join('')}</div></section>`;

const pages = [
  {
    path: '/birthday/',
    title: 'Happy Birthday song card with their name · Singing birthday card',
    description: 'Make a free singing birthday card: a ball bounces through Happy Birthday to You in time with the piano and lands on their name. Send the link or download the video.',
    h1: 'A birthday card that sings their name',
    lede: 'Type their name and a ball bounces through Happy Birthday to You, landing on their name in the third line. Send it as a link, or save the video for their story. Free, no sign-up.',
    content: `
    <section class="band article">
      <h2>Why a singing card</h2>
      <p>On a birthday people get a stream of near-identical messages. A card that sings to them by name takes a minute to make and is the one they open twice. The name stays dark until the ball gets to "dear…", then lights up on its own line and the card ends in a burst of confetti, with your message underneath.</p>
      <h2>About the song</h2>
      <p>The melody of Happy Birthday to You comes from "Good Morning to All", a kindergarten song by the sisters Mildred and Patty Hill, published in 1893. The birthday words spread in the early 1900s, and it became one of the best-known songs in English. Its copyright was disputed for decades: a US court case ended in 2016 with the song in the public domain, and in the European Union its protection ran out at the start of 2017. That's why you can send it, post it and share the video freely.</p>
      <h2>Tips</h2>
      <ul>
        <li><b>Use the name they answer to.</b> "Grandma", "Coach" or a nickname works better than a full name, and short names give the biggest letters.</li>
        <li><b>Keep the message short.</b> It appears after the confetti, under the name, and two lines read best on a phone.</li>
        <li><b>Send the link in any chat.</b> It opens in WhatsApp, Messenger, iMessage, Telegram or email without an app.</li>
        <li><b>Want it on a story?</b> Download the video. It's a vertical 1080×1920 MP4 with the music included.</li>
      </ul>
    </section>
    ${others('/birthday/')}
    ${faq([
      ['Is it really free?', 'Yes. No account, no watermark on the card and no limit on cards. Ads on the site pay for it.'],
      ['Does it work on iPhone and Android?', 'Yes, in any recent browser. They tap once to open the card because phones only play sound after a tap.'],
      ['Can I add a photo?', 'Not yet. The card is the song and their name, which keeps it quick to open on any connection.'],
      ['Is the name saved anywhere?', 'No. The name and message live in the link after the # sign, which browsers never send to a server.'],
    ])}`,
  },
  {
    path: '/congratulations/',
    title: "For he's a jolly good fellow card with their name · Congratulations card",
    description: "A free congratulations card that sings For He's a Jolly Good Fellow with their name in it, three times, then bursts into confetti. Send the link or download the video.",
    h1: 'A congratulations card that sings their name',
    lede: "The ball bounces through For He's a Jolly Good Fellow with their name in place of \"he\", three times over, then bursts into confetti. For a new job, a promotion, a graduation or a retirement.",
    content: `
    <section class="band article">
      <h2>When to send one</h2>
      <p>Anything that deserves a cheer: a new job or a promotion, passing an exam or a driving test, a graduation, a retirement, a finished marathon, a first house. Sign it from a whole team or class in the "From" field ("Everyone at the office") and drop the link in the group chat so everyone sees it land.</p>
      <h2>About the song</h2>
      <p>For He's a Jolly Good Fellow is sung to an old French tune, "Marlbrough s'en va-t-en guerre", that was already well known in the 18th century. It crossed into English as a toast and is now sung at birthdays, weddings, retirements and sports dinners across the English-speaking world. Here the "he" becomes their name, so it works for anyone. The song is in the public domain.</p>
      <h2>Tips</h2>
      <ul>
        <li><b>Short names sing best.</b> The name lands on a single note each time, so "Dan" swings more than "Daniel Alexander".</li>
        <li><b>Say what it's for in the message.</b> "Congrats on the new job!" appears under their name after the confetti.</li>
        <li><b>Posting it?</b> Download the video and share it on a story or in a team channel.</li>
      </ul>
    </section>
    ${others('/congratulations/')}
    ${faq([
      ['Is it free?', 'Yes. No account and no watermark on the card. Ads on the site pay for it.'],
      ['Why "jolly good fellow" for a woman?', 'The song has been sung for everyone for a long time, and on this card their name replaces "he", so it reads "For Anna\'s a jolly good fellow".'],
      ['Can several people sign it?', 'Put everyone in the From field, like "Mia, Tom and Sam" or "The whole team". It shows under their name at the end.'],
      ['Is the name stored?', 'No. Everything is in the link after the # sign, which browsers do not send to servers.'],
    ])}`,
  },
  {
    path: '/christmas/',
    title: 'We Wish You a Merry Christmas card with their name · Singing Christmas card',
    description: 'A free singing Christmas card: a bouncing ball sings We Wish You a Merry Christmas with their name lit up on top, in falling snow. Send the link or download the video.',
    h1: 'A Christmas card that sings',
    lede: 'We Wish You a Merry Christmas, sung by a bouncing ball in falling snow, with their name lit up at the top. Send it to family far away, drop it in the group chat, or save the video for your story.',
    content: `
    <section class="band article">
      <h2>For the people you won't see this year</h2>
      <p>A paper card takes a week to arrive and a text gets lost under all the others. A singing card arrives in seconds and opens with their name on top. Make one per person in a few minutes: change the name, copy the link, send, repeat.</p>
      <h2>About the song</h2>
      <p>We Wish You a Merry Christmas is a traditional English carol from the West Country, sung by carolers going door to door, which is where the verses about figgy pudding come from. It is in the public domain, so the card and the video are yours to share anywhere.</p>
      <h2>Tips</h2>
      <ul>
        <li><b>One card per person.</b> Their own name on top is the point. It takes seconds to change the name and copy a new link.</li>
        <li><b>Family abroad?</b> Links open on any phone, and the music is part of the page, so nothing to install.</li>
        <li><b>Posting a Christmas story?</b> Download the video with everyone's favourite name on it.</li>
      </ul>
    </section>
    ${others('/christmas/')}
    ${faq([
      ['Is it free?', 'Yes. No account and no watermark on the card. Ads on the site pay for it.'],
      ['Can I make a New Year card?', 'A New Year card is coming before the holidays. Until then the Christmas card ends with "and a happy New Year!"'],
      ['Does it work in group chats?', 'Yes. Everyone who opens the link sees the card with the name you typed.'],
      ['Is the name stored?', 'No. It lives in the link after the # sign, which browsers never send to a server.'],
    ])}`,
  },
];

const urls = ['/'];
for (const p of pages) {
  let html = setMeta(base, p);
  html = swap(html, 'h1', p.h1);
  html = swap(html, 'lede', p.lede);
  html = swap(html, 'content', p.content);
  mkdirSync(join(dist, p.path), {recursive: true});
  writeFileSync(join(dist, p.path, 'index.html'), html);
  urls.push(p.path);
}

writeFileSync(join(dist, '404.html'), swap(swap(swap(setMeta(base, {path: '/404', title: 'Page not found · Melody Bounce Cards', description: 'This page does not exist.'}),
  'h1', 'That card got lost in the post'), 'lede', 'The address does not match a page here. You can make a new card below.'), 'content', others('/'))
  .replace(/\s*<script async src="https:\/\/pagead2[^>]*><\/script>/, ''));

writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);

const version = file => createHash('sha256').update(readFileSync(join(dist, file))).digest('hex').slice(0, 10);
const v = {site: version('site.css'), cards: version('cards.css')};
const walk = dir => readdirSync(dir).flatMap(e => { const p = join(dir, e); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
for (const file of walk(dist)) {
  writeFileSync(file, readFileSync(file, 'utf8').replaceAll('href="/site.css"', `href="/site.css?v=${v.site}"`).replaceAll('href="/cards.css"', `href="/cards.css?v=${v.cards}"`));
}
console.log(`${urls.length} pages`);
