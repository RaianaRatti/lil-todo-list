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
};

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
  // little one-colour icons for buttons
  box: {
    rows: [
      'kkkkkkk',
      'k.....k',
      'k.....k',
      'k.....k',
      'k.....k',
      'k.....k',
      'kkkkkkk',
    ],
  },
  plus: {
    rows: [
      '..k..',
      '..k..',
      'kkkkk',
      '..k..',
      '..k..',
    ],
  },
  plusPaper: { base: 'plus', pal: { k: '#f4ecd8' } },
  cross: {
    rows: [
      'k...k',
      '.k.k.',
      '..k..',
      '.k.k.',
      'k...k',
    ],
  },
  trash: {
    rows: [
      '...kkk...',
      'kkkkkkkkk',
      '.........',
      '.kkkkkkk.',
      '.k.k.k.k.',
      '.k.k.k.k.',
      '.k.k.k.k.',
      '.k.k.k.k.',
      '.kkkkkkk.',
    ],
  },
  trashLight: { base: 'trash', pal: { k: '#efe4cc' } },
  revert: {
    rows: [
      '..k......',
      '.kk......',
      'kkkkkkk..',
      '.kk....k.',
      '..k.....k',
      '........k',
      '.......k.',
      '..kkkkk..',
    ],
  },
  revertGold: { base: 'revert', pal: { k: '#e0b24c' } },
  // gold scrollwork for the book covers and the header
  vine: {
    rows: [
      '.......Y.....y.....Y.......',
      '.yy.....yy..yYy..yy.....yy.',
      'y..y.....yY..y..Yy.....y..y',
      'y.yyyyyyyyyyyyyyyyyyyyyyy.y',
      'y.....Yy.....Y.....yY.....y',
      '.yy..yy.............yy..yy.',
      '....Y.................Y....',
    ],
  },
  // a gold stud with a leafy sprig along each edge, for the top-left corner
  // (flipped with CSS for the others)
  corner: {
    rows: [
      'yyy..Y..',
      'yYyyyyY.',
      'yyy..y..',
      '.y......',
      '.y.Y....',
      'Yy......',
      '.y......',
      '.Y......',
    ],
  },
  // light / dark toggle
  sun: {
    rows: [
      '....y....',
      '.y.....y.',
      '...yyy...',
      '..yyyyy..',
      'y.yyyyy.y',
      '..yyyyy..',
      '...yyy...',
      '.y.....y.',
      '....y....',
    ],
  },
  moon: {
    rows: [
      '..kkk...',
      '.kk.....',
      'kk......',
      'kk......',
      'kk......',
      'kk.....k',
      '.kk..kk.',
      '..kkkk..',
    ],
  },
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
};

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
