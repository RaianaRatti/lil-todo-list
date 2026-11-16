// Picks light or dark before the page paints, so it never flashes the wrong one.
// Once you choose with the toggle it's remembered; until then it follows the system setting.
try {
  const saved = localStorage.getItem('lil-todos-theme');
  document.documentElement.dataset.theme = saved
    || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
} catch {
  document.documentElement.dataset.theme = 'dark';
}
