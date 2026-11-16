# lil todo list

A small, minimal pixel-art todo journal: cream pages framed in coloured book covers on a dark
background, and a cool bunny in a red scarf keeping you on track.
Plain static HTML/CSS/JS with no build step. Everything is saved in the browser (localStorage).

- Several **books** (say one for classes, one for everything else), each with its own title and
  cover colour. On the shelf, slide between them with the arrows, the arrow keys or a swipe; click
  a cover to open it, click its label to rename it. `< book name` above an open book (or esc) puts
  it back on the shelf.
- Inside a book, several lists, each a page. Turn pages with the tabs under the page, the
  left/right arrow keys or a swipe. Click a list's name to rename it.
- `+` on the tabs makes a new list; the bin next to the list name deletes it. Drag a tab to
  reorder lists (press and hold first on touch screens), or focus one and press alt + an arrow key.
- Enter (or `+`) adds a task. The bookmark button at the end of the row adds it as a section **title** instead;
  the `+` on a title adds subtasks under it.
- Tasks disappear as soon as you check them off (there's a 5-second undo). The little key at the
  bottom of the page shows how many are left and done; click the tick to see finished tasks and
  bring any of them back.
- Double-click any task or title to edit it.
- Light and dark themes: the sun / moon in the corner switches them. Until you pick one it follows
  your system setting.

## Demo
![alt text](images/top-page.png)
![alt text](images/bottom-page.png)

## Run locally

```sh
npm run dev
python3 -m http.server -d public 8000
```

## Deploy to Cloudflare Pages

Pick one:

1. **Drag & drop.** In the Cloudflare dashboard, go to Workers & Pages → Create → Pages →
   Upload assets, then drop in the `public/` folder.
2. **CLI.** Run `npm run deploy`. The first run asks you to log in to Cloudflare and creates the
   `lil-todo-list` project.
3. **Git.** Push this repo to GitHub/GitLab, then connect it in Workers & Pages →
   Create → Pages → Connect to Git. Use framework preset **None**, leave the build command
   empty, and set the output directory to `public`.

`public/_headers` sets security headers and long-term caching for fonts on Cloudflare.

## Files

- `public/sprites.js`: all the pixel art, hand-drawn as character grids (edit them to make new
  sprites). `npm run favicon` regenerates `favicon.svg` and checks the sprite grids.
- `public/app.js`: the app logic (lists, titles, subtasks, check-off, undo, editing, page turning).
- `public/theme.js`: picks light or dark before the page paints, so it never flashes the wrong one.
- `public/style.css`: pixel borders, colors and animations. Colors are variables at the top.

## Credits

The pixel art is original and drawn in code. The fonts are [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P)
and [VT323](https://fonts.google.com/specimen/VT323), both under the SIL Open Font License and
self-hosted in `public/fonts/`.
