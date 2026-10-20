// Regenerates public/favicon.svg from the bunny sprite.
import { writeFileSync } from 'node:fs';
import { spriteSVG, SPRITES } from '../public/sprites.js';

for (const [name, def] of Object.entries(SPRITES)) {
  if (!def.rows) continue;
  const widths = new Set(def.rows.map((r) => r.length));
  if (widths.size > 1) console.warn(`sprite "${name}" has uneven rows: ${[...widths]}`);
}
writeFileSync(new URL('../public/favicon.svg', import.meta.url), spriteSVG('bunny'));
console.log('wrote public/favicon.svg');
