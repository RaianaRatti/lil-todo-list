// Hand-drawn pixel sprites. Each sprite is a grid of palette characters;
// "." is transparent. They're rendered to crisp SVG data URLs at runtime.

export const PALETTE = {
  k: '#4a3040', // outline (soft plum instead of black)
  w: '#ffffff',
  g: '#fbe9f1', // pale pink shade
  p: '#ffc2d9',
  P: '#ff8fb8',
  b: '#ffb0c8', // blush
  y: '#ffe07a',
  Y: '#ffc94d',
  G: '#8fd6a0',
  D: '#5fae72',
  r: '#ff6b8a',
  l: '#dcc8ff',
  L: '#b79cf2',
};

export const SPRITES = {
  bunny: {
    rows: [
      '....kk....kk....',
      '...kwpk..kwpk...',
      '...kwpk..kwpk...',
      '...kwpk..kwpk...',
      '...kwwk..kwwk...',
      '..kkwwkkkkwwkk..',
      '.kwwwwwwwwwwwwk.',
      '.kwwkwwwwwwkwwk.',
      '.kwwkwwwwwwkwwk.',
      '.kbbwwwPPwwwbbk.',
      '.kwwwwwkkwwwwwk.',
      '..kwwwwwwwwwwk..',
      '..kwwgwwwwgwwk..',
      '.kwwwgwwwwgwwwk.',
      '.kgwwwwwwwwwwgk.',
      '..kkkkkkkkkkkk..',
    ],
  },
  bunnySleep: {
    rows: [
      '................',
      '................',
      '..kkk......kkk..',
      '.kwppkk..kkppwk.',
      '..kkwwwkkwwwkk..',
      '..kkwwwwwwwwkk..',
      '.kwwwwwwwwwwwwk.',
      '.kwwwwwwwwwwwwk.',
      '.kwkkwwwwwwkkwk.',
      '.kbbwwwPPwwwbbk.',
      '.kwwwwwkkwwwwwk.',
      '..kwwwwwwwwwwk..',
      '..kwwgwwwwgwwk..',
      '.kwwwgwwwwgwwwk.',
      '.kgwwwwwwwwwwgk.',
      '..kkkkkkkkkkkk..',
    ],
  },
  flower: {
    rows: [
      '....kkk....',
      '...kPppk...',
      '...kpppk...',
      '.kkkpppkkk.',
      'kPppyyyppPk',
      'kpppyYyppPk',
      'kpppyyypppk',
      '.kkkpppkkk.',
      '...kpppk...',
      '...kpPpk...',
      '....kGk....',
      '..kkkGk.kk.',
      '.kGGkGkkGGk',
      '..kkkGkGGk.',
      '....kGkkk..',
      '....kkk....',
    ],
  },
  flowerLilac: { base: 'flower', pal: { p: '#dcc8ff', P: '#b79cf2' } },
  flowerSun: { base: 'flower', pal: { p: '#ffe07a', P: '#ffc94d', y: '#ff8fb8', Y: '#ff6b8a' } },
  heart: {
    rows: [
      '.kk.kk.',
      'kpwkppk',
      'kwppPpk',
      '.kpPPk.',
      '..kPk..',
      '...k...',
    ],
  },
  heartSolid: {
    rows: [
      '.PP.PP.',
      'PwPPPPP',
      'PPPPPPP',
      '.PPPPP.',
      '..PPP..',
      '...P...',
    ],
  },
  sparkle: {
    rows: [
      '..P..',
      '..P..',
      'PPwPP',
      '..P..',
      '..P..',
    ],
  },
  strawberry: {
    rows: [
      '...kkk...',
      '.kkGGGkk.',
      'kGGkGkGGk',
      'krrkkkrrk',
      'krwrrrwrk',
      'krrrrrrrk',
      '.krrwrrk.',
      '..krrrk..',
      '...krk...',
      '....k....',
    ],
  },
  cloud: {
    rows: [
      '.....kkkk.......',
      '...kkwwwwk.kk...',
      '..kwwwwwwwkwwk..',
      '.kwwwwwwwwwwwwk.',
      'kwwwwwwwwwwwwwgk',
      'kgwwwwwwwwwwwggk',
      '.kkkkkkkkkkkkkk.',
    ],
  },
  bow: {
    rows: [
      'kk.....kk',
      'kPkk.kkPk',
      'kPPPkPPPk',
      'kPkk.kkPk',
      'kk.....kk',
    ],
  },
  carrot: {
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
  grass: {
    rows: [
      '..G.....G...',
      '.GGG...GGG.G',
      'GGGGG.GGGGGG',
      'DGDGGGGDGGDG',
      'DDDDDDDDDDDD',
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
