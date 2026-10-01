import { cancelRender, continueRender, delayRender } from 'remotion';

export const fontFamily = 'Outfit';
let loaded: Promise<unknown> | undefined;
/** The exact Latin WOFF2 referenced by @remotion/google-fonts 4.0.529, served locally. */
export function loadFont(_style: 'normal', options: {weights: string[]; subsets: string[]}) {
  if (typeof document !== 'undefined' && !loaded) {
    const handle = delayRender('Loading Outfit');
    const url = new URL('../../assets/fonts/Outfit-latin.woff2', import.meta.url).href;
    loaded = Promise.all(options.weights.map(weight => {
      const face = new FontFace(fontFamily, `url(${JSON.stringify(url)})`, {style: 'normal', weight});
      document.fonts.add(face);
      return face.load();
    })).then(() => continueRender(handle), error => cancelRender(error));
  }
  return {fontFamily};
}
