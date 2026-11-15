// Hand-drawn pixel sprites. Each sprite is a grid of palette characters;
// "." is transparent. They're rendered to crisp SVG data URLs at runtime.

export const PALETTE = {
  k: '#231d2b', // outline (inky plum-black)
  w: '#fffaf0',
  a: '#6e6b88', // bunny fur
  A: '#a9a5c2', // fur highlight / inner ear
  c: '#efe4cc', // cream
  n: '#d98a8f', // nose
  r: '#c8453b', // red (scarf, ribbon, ticks)
  R: '#8f2e2c',
  y: '#f0c75e', // gold
  Y: '#c9962f',
  t: '#4f7d73', // teal
  T: '#33554d',
  o: '#5a3a2e', // coffee
  m: '#6c6684', // steam
  s: '#4f7d73', // book spine
  S: '#33554d',
};

// book spines for the shelf: w wide, h tall, gold bands near the ends and a label
function spineRows(w, h) {
  const fill = 'k' + 's'.repeat(w - 3) + 'Sk';
  const band = 'k' + 'y'.repeat(w - 2) + 'k';
  const label = 'k' + 'c'.repeat(w - 2) + 'k';
  const edge = 'k'.repeat(w);
  return Array.from({ length: h }, (_, y) => {
    if (y === 0 || y === h - 1) return edge;
    if (y === 2 || y === h - 4) return band;
    if (y >= 5 && y <= 7) return label;
    return fill;
  });
}

export const SPRITES = {
  bunny: {
    rows: [
      '....kk..........',
      '...kaak...kkkk..',
      '...kaAk..kaaaak.',
      '...kaAk..kaAkkk.',
      '...kaAk..kaAk...',
      '...kaAk..kaAk...',
      '...kaAk..kaAk...',
      '..kaaaaaaaaaak..',
      '.kaaaaaaaaaaaak.',
      '.kaakkaaaakkaak.',
      '.kaawkaaaawkaak.',
      '.kAaaccnnccaaAk.',
      '..kaaccccccaak..',
      '...kaaccccaak...',
      '.krrrrrrrrrrrrk.',
      '.kRRRRRrrRRRRrrk',
      '.kaaaaarRaaaakrk',
      '..kkkkkkkkkkk.k.',
    ],
  },
  bunnySleep: {
    rows: [
      '....kk..........',
      '...kaak...kkkk..',
      '...kaAk..kaaaak.',
      '...kaAk..kaAkkk.',
      '...kaAk..kaAk...',
      '...kaAk..kaAk...',
      '...kaAk..kaAk...',
      '..kaaaaaaaaaak..',
      '.kaaaaaaaaaaaak.',
      '.kaaaaaaaaaaaak.',
      '.kaakkaaaakkaak.',
      '.kAaaccnnccaaAk.',
      '..kaaccccccaak..',
      '...kaaccccaak...',
      '.krrrrrrrrrrrrk.',
      '.kRRRRRrrRRRRrrk',
      '.kaaaaarRaaaakrk',
      '..kkkkkkkkkkk.k.',
    ],
  },
  // section marker: a little bookmark
  mark: {
    rows: [
      'kkkkk',
      'krrrk',
      'krrrk',
      'krRrk',
      'krkrk',
      'kk.kk',
    ],
  },
  check: {
    rows: [
      '......rr',
      '.....rr.',
      'rr..rr..',
      '.rrrr...',
      '..rr....',
    ],
  },
  checkFaint: { base: 'check', pal: { r: '#cdbb94' } },
  sparkle: {
    rows: [
      '..y..',
      '..y..',
      'yywyy',
      '..y..',
      '..y..',
    ],
  },
  spark: {
    rows: [
      '.r.',
      'rRr',
      '.r.',
    ],
  },
  dot: {
    rows: [
      '.y.',
      'yyy',
      '.y.',
    ],
  },
  ribbon: {
    rows: [
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'kRrrrk',
      'krkkrk',
      'kk..kk',
    ],
  },
  // brass corner protector for the book cover (flipped with CSS for the other corners)
  corner: {
    rows: [
      'kkkkkkk',
      'kyyyyk.',
      'kyYyk..',
      'kyyk...',
      'kyk....',
      'kk.....',
      'k......',
    ],
  },
  moon: {
    pal: { y: '#f3e3a8', Y: '#d8c37e' },
    rows: [
      '...kkkk...',
      '.kkyyyykk.',
      '.kyyyYyyk.',
      'kyyYyyyyyk',
      'kyyyyyyYyk',
      'kyYyyyyyyk',
      'kyyyyYYyyk',
      '.kyyyyyyk.',
      '.kkyyyykk.',
      '...kkkk...',
    ],
  },
  pencil: {
    rows: [
      '.kkkkkkkkkkkk...',
      'krrAyyyyyyyyck..',
      'krrAYYYYYYYYcckk',
      'krrAyyyyyyyyck..',
      '.kkkkkkkkkkkk...',
    ],
  },
  mug: {
    rows: [
      '..m...m.....',
      '...m...m....',
      '..m...m.....',
      'kkkkkkkkk...',
      'koooooook...',
      'ktttttttkkk.',
      'ktttttttk.k.',
      'ktctttttk.k.',
      'ktttttttkkk.',
      'kTtttttTk...',
      '.kTTTTTk....',
      '..kkkkk.....',
    ],
  },
  carrot: {
    pal: { Y: '#e07b39', G: '#6fa36b' },
    rows: [
      '....kk.kk',
      '...kGGkGk',
      '....kGGk.',
      '...kYYk..',
      '..kYkYk..',
      '..kYYYk..',
      '.kYkYk...',
      '.kYYk....',
      'kYk......',
      'kk.......',
    ],
  },
  spine: { rows: spineRows(6, 24) },
  spineShort: { rows: spineRows(6, 18) },
  spineWide: { rows: spineRows(8, 21) },
};

// colour variants of every spine shape: spineRed, spineShortPlum, ...
const BOOK_COLORS = {
  Red: { s: '#c8453b', S: '#8f2e2c' },
  Gold: { s: '#d9a441', S: '#a87a2a', y: '#f4ecd8' },
  Plum: { s: '#6f5a8e', S: '#4f3f68' },
  Navy: { s: '#3f5f8a', S: '#2c4466' },
  Brown: { s: '#8a5a3c', S: '#64402a' },
};
for (const shape of ['spine', 'spineShort', 'spineWide']) {
  for (const [color, pal] of Object.entries(BOOK_COLORS)) SPRITES[shape + color] = { base: shape, pal };
}

function resolve(name) {
  const def = SPRITES[name];
  if (!def) throw new Error(`unknown sprite: ${name}`);
  if (def.base) {
    const base = resolve(def.base);
    return { rows: base.rows, pal: { ...base.pal, ...def.pal } };
  }
  return { rows: def.rows, pal: { ...def.pal } };
}

export function spriteSize(name) {
  const { rows } = resolve(name);
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length };
}

export function spriteSVG(name) {
  const { rows, pal } = resolve(name);
  const colors = { ...PALETTE, ...pal };
  const { w, h } = spriteSize(name);
  let rects = '';
  rows.forEach((row, y) => {
    // merge horizontal runs of the same color to keep the SVG small
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let len = 1;
      while (row[x + len] === c) len++;
      if (colors[c]) rects += `<rect x="${x}" y="${y}" width="${len}" height="1" fill="${colors[c]}"/>`;
      x += len;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${rects}</svg>`;
}

const cache = new Map();
export function spriteURL(name) {
  if (!cache.has(name)) cache.set(name, `url("data:image/svg+xml,${encodeURIComponent(spriteSVG(name))}")`);
  return cache.get(name);
}

// Turns every <i data-sprite="name" data-scale="n"> into a sized sprite.
export function mountSprites(root = document) {
  root.querySelectorAll('[data-sprite]').forEach((el) => {
    const name = el.dataset.sprite;
    const scale = Number(el.dataset.scale || 3);
    const { w, h } = spriteSize(name);
    el.classList.add('sprite');
    el.style.backgroundImage = spriteURL(name);
    el.style.width = `${w * scale}px`;
    el.style.height = `${h * scale}px`;
  });
}
