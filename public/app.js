import { mountSprites, spriteURL, spriteSize } from './sprites.js';

const KEY = 'lil-todos-v3';
const V2_KEY = 'lil-todos-v2'; // one book's worth of lists
const V1_KEY = 'lil-todos-v1'; // a single list

const CHEERS = [
  'nice.', 'crossed off.', 'smooth.', 'one less thing', 'next!', 'too easy',
  'keep it moving', 'look at you go',
];

const $ = (sel) => document.querySelector(sel);
const card = $('#card');
const list = $('#list');
const form = $('#new');
const input = $('#new-text');
const nameInput = $('#list-name');
const tabs = $('#tabs');
const bubble = $('#bubble');
const peekBunny = $('#peek-bunny');
const toast = $('#toast');
const carousel = $('#carousel');

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const task = (text) => ({ id: uid(), text });
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- state ----------
// { book: index of the book on the shelf, open: whether it's open,
//   books: [{ id, name, cover: colour 0-5, current: index of the open list, lists: [list] }] }
// list: { id, name, tasks: [task], titles: [{ id, text, tasks: [task] }],
//         done: [{ id, text, from: title id | null, fromText, index }], doneBefore: count }
// `done` is newest first; `doneBefore` counts finishes from before they were kept.

const DONE_LIMIT = 200;
const COVERS = 6;
const newList = (name) => ({ id: uid(), name, tasks: [], titles: [], done: [], doneBefore: 0 });
const newBook = (name, cover, lists) => ({ id: uid(), name, cover, current: 0, lists });

function starterState() {
  return {
    book: 0,
    open: true,
    books: [
      newBook('life', 0, [
        {
          id: uid(), name: 'today', done: [], doneBefore: 0,
          tasks: [task('water the flowers'), task('be kind to yourself')],
          titles: [
            { id: uid(), text: 'groceries', tasks: [task('strawberries'), task('carrots for the bunny'), task('oat milk')] },
            { id: uid(), text: 'self care', tasks: [task('drink a glass of water'), task('stretch for 5 min')] },
          ],
        },
        {
          id: uid(), name: 'someday', done: [], doneBefore: 0,
          tasks: [task('learn to crochet')],
          titles: [{ id: uid(), text: 'trips', tasks: [task('picnic in the park'), task('visit a flower farm')] }],
        },
      ]),
      newBook('classes', 1, [
        {
          id: uid(), name: 'this week', done: [], doneBefore: 0,
          tasks: [task('email the study group')],
          titles: [
            { id: uid(), text: 'math', tasks: [task('problem set 3')] },
            { id: uid(), text: 'history', tasks: [task('read chapter 4'), task('essay outline')] },
          ],
        },
      ]),
    ],
  };
}

const clampIndex = (i, arr) => Math.min(Math.max(Number(i) || 0, 0), arr.length - 1);

function normalizeLists(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const cleanTasks = (arr) => (Array.isArray(arr) ? arr : [])
    .filter((t) => t && typeof t.text === 'string')
    .map((t) => ({ id: String(t.id || uid()), text: t.text }));
  return raw.map((l) => ({
    id: String(l.id || uid()),
    name: typeof l.name === 'string' && l.name.trim() ? l.name : 'my list',
    // older saves kept only a count of finished tasks
    done: (Array.isArray(l.done) ? l.done : [])
      .filter((d) => d && typeof d.text === 'string')
      .slice(0, DONE_LIMIT)
      .map((d) => ({
        id: String(d.id || uid()),
        text: d.text,
        from: d.from ? String(d.from) : null,
        fromText: typeof d.fromText === 'string' ? d.fromText : null,
        index: Number(d.index) || 0,
      })),
    doneBefore: Array.isArray(l.done) ? Number(l.doneBefore) || 0 : Number(l.done) || 0,
    tasks: cleanTasks(l.tasks),
    titles: (Array.isArray(l.titles) ? l.titles : [])
      .filter((t) => t && typeof t.text === 'string')
      .map((t) => ({ id: String(t.id || uid()), text: t.text, tasks: cleanTasks(t.tasks) })),
  }));
}

function normalize(raw) {
  if (!raw || !Array.isArray(raw.books)) return null;
  const books = raw.books.map((b) => {
    const lists = normalizeLists(b?.lists);
    if (!lists) return null;
    return {
      id: String(b.id || uid()),
      name: typeof b.name === 'string' && b.name.trim() ? b.name : 'my book',
      cover: Math.abs(Math.trunc(Number(b.cover) || 0)) % COVERS,
      current: clampIndex(b.current, lists),
      lists,
    };
  }).filter(Boolean);
  if (!books.length) return null;
  return { book: clampIndex(raw.book, books), open: raw.open !== false, books };
}

function load() {
  try {
    const saved = normalize(JSON.parse(localStorage.getItem(KEY)));
    if (saved) return saved;
    // lists from before there were books go into the first one
    const v2 = JSON.parse(localStorage.getItem(V2_KEY));
    const lists = normalizeLists(v2?.lists);
    if (lists) return { book: 0, open: true, books: [{ ...newBook('my journal', 0, lists), current: clampIndex(v2.current, lists) }] };
    // carry over unfinished todos from the single-list version
    const old = JSON.parse(localStorage.getItem(V1_KEY));
    if (Array.isArray(old) && old.length) {
      const tasks = old.filter((t) => t && !t.done && typeof t.text === 'string').map((t) => task(t.text));
      return { book: 0, open: true, books: [newBook('my journal', 0, [{ ...newList('my list'), tasks }])] };
    }
  } catch {
    // fall through to the starter books
  }
  return null;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode etc.) — everything still works for this visit
  }
}

let state = load() ?? starterState();
let openSubFor = null; // title id whose "add subtask" field is open
let showDone = false;
let rendering = false;
let animating = false;

const bk = () => state.books[state.book];
const cur = () => bk().lists[bk().current];

// ---------- undo ----------

let undoSnapshot = null;
let toastTimer = null;

function offerUndo(message, before) {
  undoSnapshot = before;
  $('#toast-text').textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; undoSnapshot = null; }, 5000);
}

$('#undo').addEventListener('click', () => {
  if (!undoSnapshot) return;
  state = JSON.parse(undoSnapshot);
  undoSnapshot = null;
  toast.hidden = true;
  commit();
  say('phew. back again');
});

// ---------- bunny ----------

function say(text) {
  bubble.textContent = text;
  peekBunny.classList.remove('wiggle');
  void peekBunny.offsetWidth; // restart the animation
  peekBunny.classList.add('wiggle');
}

function remaining(l = cur()) {
  return l.tasks.length + l.titles.reduce((n, t) => n + t.tasks.length, 0);
}

const doneCount = (l = cur()) => l.done.length + l.doneBefore;

function moodText() {
  const l = cur();
  const left = remaining(l);
  if (!left) return doneCount(l) ? 'all done. nap time' : 'blank page...';
  if (left === 1) return 'one left. easy.';
  return 'you got this.';
}

// ---------- rendering ----------

function iconButton(className, sprite, label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `icon-btn ${className}`;
  b.setAttribute('aria-label', label);
  const icon = document.createElement('i');
  icon.dataset.sprite = sprite;
  icon.dataset.scale = '2';
  b.append(icon);
  return b;
}

const delButton = (label) => iconButton('del', 'cross', label);

function taskEl(t) {
  const li = document.createElement('li');
  li.className = 'todo';
  li.dataset.task = t.id;

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.setAttribute('aria-label', `finish "${t.text}"`);

  const text = document.createElement('span');
  text.className = 'text';
  text.textContent = t.text;

  li.append(box, text, delButton(`delete "${t.text}"`));
  return li;
}

function subForm(title) {
  const f = document.createElement('form');
  f.className = 'sub-form';
  f.autocomplete = 'off';
  const field = document.createElement('input');
  field.className = 'line-field';
  field.placeholder = `add to ${title.text}`;
  field.maxLength = 140;
  field.setAttribute('aria-label', `New subtask under "${title.text}"`);
  f.append(field);
  return f;
}

function groupEl(title) {
  const li = document.createElement('li');
  li.className = 'group';
  li.dataset.title = title.id;

  const row = document.createElement('div');
  row.className = 'title-row';
  const mark = document.createElement('i');
  mark.dataset.sprite = 'mark';
  mark.dataset.scale = '2';
  mark.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('h3');
  heading.className = 'title-text';
  heading.title = 'double-click to rename';
  const inner = document.createElement('span');
  inner.textContent = title.text;
  heading.append(inner);
  const addSub = iconButton('add-sub', 'plus', `add a subtask under "${title.text}"`);
  row.append(mark, heading, addSub, delButton(`delete title "${title.text}" and its subtasks`));

  const subs = document.createElement('ul');
  subs.className = 'subs';
  subs.append(...title.tasks.map(taskEl));

  // the new-subtask field only appears once you ask for it
  const tail = document.createElement('li');
  tail.className = 'sub-tail';
  if (openSubFor === title.id) tail.append(subForm(title));
  subs.append(tail);

  li.append(row, subs);
  return li;
}

function tabsRender() {
  const newTab = iconButton('tab-new', 'plusPaper', 'New list');
  newTab.id = 'add-list';
  newTab.title = 'new list';

  tabs.replaceChildren(
    ...bk().lists.map((l, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.dataset.index = i;
      b.textContent = l.name;
      b.title = 'drag to reorder';
      if (i === bk().current) b.setAttribute('aria-current', 'true');
      return b;
    }),
    newTab,
  );
  mountSprites(tabs);
  const active = tabs.querySelector('[aria-current="true"]');
  if (active) tabs.scrollLeft = active.offsetLeft - tabs.clientWidth / 2 + active.offsetWidth / 2;
}

function doneRender(l) {
  $('#done-panel').hidden = !showDone;
  if (!showDone) return;
  $('#done-list').replaceChildren(...l.done.map((d) => {
    const li = document.createElement('li');
    li.className = 'done-item';
    li.dataset.done = d.id;
    const tick = document.createElement('i');
    tick.dataset.sprite = 'check';
    tick.dataset.scale = '2';
    tick.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'done-text';
    text.textContent = d.text;
    const back = iconButton('bring-back', 'revert', `bring back "${d.text}"`);
    back.title = 'bring back';
    li.append(tick, text, back);
    return li;
  }));
  mountSprites($('#done-list'));
  const older = $('#done-older');
  older.hidden = !l.doneBefore;
  older.textContent = `+${l.doneBefore} older`;
}

function render() {
  rendering = true;
  const l = cur();

  list.replaceChildren(...l.tasks.map(taskEl), ...l.titles.map(groupEl));
  mountSprites(list);

  const isEmpty = !l.tasks.length && !l.titles.length;
  const finished = doneCount(l);
  $('#empty').hidden = !isEmpty;
  $('#empty-text').textContent = finished ? 'all done. the bunny is napping' : 'blank page...';
  $('#count').textContent = remaining(l);
  $('#done-count').textContent = finished;
  const showBtn = $('#show-done');
  showBtn.hidden = !finished;
  if (!finished) showDone = false;
  showBtn.setAttribute('aria-expanded', String(showDone));
  $('#clear-done').hidden = !showDone || !l.done.length;
  doneRender(l);

  if (document.activeElement !== nameInput) nameInput.value = l.name;
  $('#del-list').hidden = bk().lists.length === 1;
  tabsRender();

  document.body.dataset.view = state.open ? 'book' : 'shelf';
  $('#shelf-view').hidden = state.open;
  $('#book').hidden = !state.open;
  $('#book').dataset.cover = bk().cover;
  $('#book-title').textContent = bk().name;
  if (!state.open) shelfRender();

  if (openSubFor) list.querySelector('.sub-form .line-field')?.focus();
  rendering = false;
}

function commit() {
  save();
  render();
}

function burst(rect) {
  if (reducedMotion()) return;
  for (let i = 0; i < 7; i++) {
    const bit = document.createElement('i');
    bit.className = 'sprite burst';
    const name = i % 3 === 0 ? 'spark' : 'sparkle';
    const { w, h } = spriteSize(name);
    const scale = 2 + (i % 2);
    bit.style.width = `${w * scale}px`;
    bit.style.height = `${h * scale}px`;
    bit.style.backgroundImage = spriteURL(name);
    bit.style.left = `${rect.left + rect.width / 2 - (w * scale) / 2}px`;
    bit.style.top = `${rect.top + rect.height / 2 - (h * scale) / 2}px`;
    const angle = (Math.PI * 2 * i) / 7 - Math.PI / 2;
    bit.style.setProperty('--dx', `${Math.round(Math.cos(angle) * 48)}px`);
    bit.style.setProperty('--dy', `${Math.round(Math.sin(angle) * 48) - 16}px`);
    bit.addEventListener('animationend', () => bit.remove());
    document.body.append(bit);
  }
}

// ---------- lookups ----------

function findTask(id) {
  const l = cur();
  for (const [title, arr] of [[null, l.tasks], ...l.titles.map((t) => [t, t.tasks])]) {
    const i = arr.findIndex((t) => t.id === id);
    if (i !== -1) return { arr, i, task: arr[i], title };
  }
  return null;
}

const findTitle = (id) => cur().titles.find((t) => t.id === id);

// ---------- adding ----------

// enter (or +) adds a task; the bookmark button adds it as a section title instead
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  if (e.submitter?.dataset.as === 'title') {
    const title = { id: uid(), text, tasks: [] };
    cur().titles.push(title);
    openSubFor = title.id; // jump straight into adding its subtasks
    commit();
    say('new section.');
  } else {
    cur().tasks.push(task(text));
    commit();
    list.querySelector(`:scope > .todo:nth-child(${cur().tasks.length})`)?.classList.add('pop');
    say('noted.');
  }
});

list.addEventListener('submit', (e) => {
  if (!e.target.matches('.sub-form')) return;
  e.preventDefault();
  const text = e.target.querySelector('.line-field').value.trim();
  const title = findTitle(e.target.closest('.group').dataset.title);
  if (!title) return;
  if (!text) return closeSubForm(e.target); // enter on an empty field means "done adding"
  title.tasks.push(task(text));
  commit(); // the field re-opens focused, ready for the next subtask
  say('noted.');
});

// opens the new-subtask field under a title without re-rendering the list
// (re-rendering would swallow a double-click meant for renaming the title)
function openSubForm(group) {
  const title = findTitle(group.dataset.title);
  const tail = group.querySelector('.sub-tail');
  if (!title || !tail) return;
  openSubFor = title.id;
  if (!tail.querySelector('.sub-form')) tail.replaceChildren(subForm(title));
  tail.querySelector('.line-field').focus();
}

function closeSubForm(form) {
  if (form.dataset.closing) return; // removing it fires focusout, which lands back here
  form.dataset.closing = '1';
  if (openSubFor === form.closest('.group')?.dataset.title) openSubFor = null;
  form.remove();
}

list.addEventListener('keydown', (e) => {
  const form = e.target.closest('.sub-form');
  if (e.key === 'Escape' && form) closeSubForm(form);
  // enter on the last subtask's checkbox starts the next one
  if (e.key === 'Enter' && e.target.matches('.todo input[type="checkbox"]')) {
    const row = e.target.closest('.todo');
    if (row.closest('.subs') && !row.nextElementSibling?.matches('.todo')) {
      e.preventDefault();
      openSubForm(row.closest('.group'));
    }
  }
});

list.addEventListener('focusout', (e) => {
  const form = e.target.closest('.sub-form');
  if (!rendering && form) closeSubForm(form);
});

// ---------- finishing / deleting ----------

list.addEventListener('change', (e) => {
  if (!e.target.matches('input[type="checkbox"]')) return;
  const found = findTask(e.target.closest('.todo').dataset.task);
  if (!found) return;
  const before = JSON.stringify(state);
  burst(e.target.getBoundingClientRect());
  found.arr.splice(found.i, 1);
  // remember where it came from so it can be brought back later
  cur().done.unshift({
    id: found.task.id,
    text: found.task.text,
    from: found.title?.id ?? null,
    fromText: found.title?.text ?? null,
    index: found.i,
  });
  cur().done.length = Math.min(cur().done.length, DONE_LIMIT);
  commit();
  offerUndo('crossed off', before);
  say(remaining() ? CHEERS[Math.floor(Math.random() * CHEERS.length)] : 'all done. nap time');
});

list.addEventListener('click', (e) => {
  if (e.target.closest('.title-text, .add-sub')) {
    openSubForm(e.target.closest('.group'));
    return;
  }
  const del = e.target.closest('.del');
  if (!del) return;
  const before = JSON.stringify(state);
  if (del.closest('.title-row')) {
    const id = del.closest('.group').dataset.title;
    cur().titles = cur().titles.filter((t) => t.id !== id);
    offerUndo('title deleted', before);
  } else {
    const found = findTask(del.closest('.todo').dataset.task);
    if (found) found.arr.splice(found.i, 1);
    offerUndo('task deleted', before);
  }
  commit();
  say(moodText());
});

// ---------- editing (double-click) ----------

list.addEventListener('dblclick', (e) => {
  const span = e.target.closest('.text, .title-text');
  if (!span) return;
  const isTitle = span.classList.contains('title-text');
  const item = isTitle
    ? findTitle(span.closest('.group').dataset.title)
    : findTask(span.closest('.todo').dataset.task)?.task;
  // pressing enter after editing the last subtask under a title starts a new one
  const row = span.closest('.todo');
  const nextUnder = row?.closest('.subs') && !row.nextElementSibling?.matches('.todo')
    ? row.closest('.group').dataset.title
    : null;
  if (item) startEdit(span, item, isTitle, nextUnder);
});

function startEdit(span, item, isTitle, nextUnder = null) {
  const field = document.createElement('input');
  field.className = 'edit' + (isTitle ? ' title-edit' : '');
  field.value = item.text;
  field.maxLength = 140;
  field.setAttribute('aria-label', 'Edit');
  span.replaceWith(field);
  field.focus();
  field.select();

  let finished = false;
  const finish = (keep) => {
    if (finished) return;
    finished = true;
    const text = field.value.trim();
    if (keep && text) item.text = text;
    commit();
  };
  field.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault(); // or this same keypress would submit the field that opens next
      if (nextUnder) openSubFor = nextUnder;
      finish(true);
    }
    if (ev.key === 'Escape') finish(false);
  });
  field.addEventListener('blur', () => finish(true));
}

// ---------- lists ----------

nameInput.addEventListener('input', () => {
  cur().name = nameInput.value.trim() || 'untitled';
  save();
  const tab = tabs.querySelector('[aria-current="true"]');
  if (tab) tab.textContent = cur().name;
});
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });
nameInput.addEventListener('blur', () => { nameInput.value = cur().name; });

function go(index, dir = index > bk().current ? 1 : -1) {
  const n = bk().lists.length;
  index = (index + n) % n;
  if (index === bk().current || animating) return;
  openSubFor = null;
  showDone = false;
  if (document.activeElement === nameInput) nameInput.blur();
  const swap = () => {
    bk().current = index;
    commit();
    say(moodText());
  };
  if (reducedMotion()) return swap();

  // going forward, the page turns over at the spine to show the next one underneath;
  // going back, the previous page swings back over
  // (timers rather than animationend, which never fires in background tabs)
  animating = true;
  if (dir < 0) swap();
  const turn = dir > 0 ? 'turn-out' : 'turn-in';
  card.classList.add(turn);
  setTimeout(() => {
    card.classList.remove(turn);
    if (dir > 0) swap();
    animating = false;
  }, 280);
}


tabs.addEventListener('click', (e) => {
  if (justDragged) return;
  if (e.target.closest('#add-list')) {
    bk().lists.push(newList(`list ${bk().lists.length + 1}`));
    save();
    go(bk().lists.length - 1, 1);
    // name it right away once the new card is showing
    setTimeout(() => { nameInput.focus(); nameInput.select(); }, reducedMotion() ? 0 : 320);
    return;
  }
  const tab = e.target.closest('[data-index]');
  if (tab) go(Number(tab.dataset.index));
});

// ---------- reordering lists ----------
// drag a tab along the others (hold it first on touch screens, so the strip can still scroll),
// or focus a tab and press alt + an arrow key

let drag = null;
let justDragged = false;

function moveList(from, to) {
  const keep = cur();
  const [moved] = bk().lists.splice(from, 1);
  bk().lists.splice(to, 0, moved);
  bk().current = bk().lists.indexOf(keep);
  commit();
}

function startDrag() {
  drag.active = true;
  drag.tab.classList.add('dragging');
  say('moving pages around');
}

tabs.addEventListener('pointerdown', (e) => {
  const tab = e.target.closest('[data-index]');
  if (!tab || e.button !== 0 || animating) return;
  drag = { tab, x: e.clientX, y: e.clientY, active: false, touch: e.pointerType === 'touch' };
  if (drag.touch) drag.hold = setTimeout(startDrag, 350);
});

window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.active) {
    const far = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8;
    if (!far) return;
    if (drag.touch) { clearTimeout(drag.hold); drag = null; return; } // it's a scroll, not a drag
    startDrag();
  }
  const vertical = getComputedStyle(tabs).flexDirection === 'column';
  const pos = vertical ? e.clientY : e.clientX;
  const others = [...tabs.querySelectorAll('[data-index]')].filter((t) => t !== drag.tab);
  const before = others.find((t) => {
    const r = t.getBoundingClientRect();
    return pos < (vertical ? r.top + r.height / 2 : r.left + r.width / 2);
  });
  tabs.insertBefore(drag.tab, before ?? $('#add-list'));
});

function endDrag() {
  if (!drag) return;
  const { tab, active, hold } = drag;
  clearTimeout(hold);
  drag = null;
  if (!active) return;
  tab.classList.remove('dragging');
  justDragged = true; // the click that follows the drop shouldn't also open the tab
  setTimeout(() => { justDragged = false; });
  const order = [...tabs.querySelectorAll('[data-index]')].map((t) => Number(t.dataset.index));
  const from = Number(tab.dataset.index);
  const to = order.indexOf(from);
  if (to === from) return render();
  moveList(from, to);
  say('reordered.');
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

// once a touch drag has started, stop the tab strip from scrolling under your finger
tabs.addEventListener('touchmove', (e) => { if (drag?.active) e.preventDefault(); }, { passive: false });
tabs.addEventListener('contextmenu', (e) => { if (drag) e.preventDefault(); });

tabs.addEventListener('keydown', (e) => {
  const tab = e.target.closest('[data-index]');
  if (!tab || !e.altKey) return;
  const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const from = Number(tab.dataset.index);
  const to = from + step;
  if (to < 0 || to >= bk().lists.length) return;
  moveList(from, to);
  tabs.querySelector(`[data-index="${to}"]`)?.focus();
});

$('#del-list').addEventListener('click', () => {
  if (bk().lists.length === 1) return;
  const before = JSON.stringify(state);
  const name = cur().name;
  bk().lists.splice(bk().current, 1);
  bk().current = Math.min(bk().current, bk().lists.length - 1);
  commit();
  offerUndo(`"${name}" deleted`, before);
  say(moodText());
});

// arrow keys slide between books on the shelf and turn pages in an open one,
// when you're not typing; escape closes the book
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea') || e.altKey || e.metaKey || e.ctrlKey) return;
  if (!state.open) {
    if (e.key === 'ArrowLeft') slideTo(state.book - 1);
    if (e.key === 'ArrowRight') slideTo(state.book + 1);
    return;
  }
  if (e.key === 'Escape') closeBook();
  if (e.key === 'ArrowLeft') go(bk().current - 1, -1);
  if (e.key === 'ArrowRight') go(bk().current + 1, 1);
});

// swipe the card on touch screens
let touchX = null;
card.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
card.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 60) go(bk().current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
});

// ---------- books ----------

const ornament = (sprite, scale, className) => {
  const i = document.createElement('i');
  i.className = className;
  i.dataset.sprite = sprite;
  i.dataset.scale = scale;
  i.setAttribute('aria-hidden', 'true');
  return i;
};

// a gilt cover: double gold frame (CSS), leafy corners, and the title plate between two vines
function coverEl() {
  const el = document.createElement('div');
  el.className = 'cover';
  for (const corner of ['tl', 'tr', 'bl', 'br']) el.append(ornament('corner', '2', `corner ${corner}`));
  const plate = document.createElement('div');
  plate.className = 'plate px';
  const name = document.createElement('input');
  name.className = 'book-name';
  name.maxLength = 24;
  name.spellcheck = false;
  name.setAttribute('aria-label', 'Book title');
  plate.append(name);
  el.append(ornament('vine', '3', 'vine'), plate, ornament('vine', '3', 'vine vine-under'));
  return el;
}

function newCoverEl() {
  const el = iconButton('cover cover-new', 'plusPaper', 'New book');
  el.title = 'new book';
  el.querySelector('i').dataset.scale = '4';
  return el;
}

// slides keep working because the covers are only rebuilt when books come or go
function shelfRender() {
  const key = state.books.map((b) => b.id).join();
  if (carousel.dataset.key !== key) {
    carousel.replaceChildren(...state.books.map(coverEl), newCoverEl());
    mountSprites(carousel);
    carousel.dataset.key = key;
  }
  [...carousel.children].forEach((el, i) => {
    const d = i - state.book;
    el.dataset.pos = d === 0 ? 'center' : d === -1 ? 'left' : d === 1 ? 'right' : d < 0 ? 'far-left' : 'far-right';
    el.dataset.index = i;
    const b = state.books[i];
    if (!b) return;
    const center = d === 0;
    el.dataset.cover = b.cover;
    el.tabIndex = center ? 0 : -1;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', center ? `open "${b.name}"` : b.name);
    const name = el.querySelector('.book-name');
    if (document.activeElement !== name) name.value = b.name;
    name.readOnly = !center;
    name.tabIndex = center ? 0 : -1;
  });

  $('#swatches').querySelectorAll('[data-cover]').forEach((s) =>
    s.setAttribute('aria-pressed', String(Number(s.dataset.cover) === bk().cover)));
  $('#del-book').hidden = state.books.length === 1;
  $('#book-prev').disabled = state.book === 0;
  $('#book-next').disabled = state.book === state.books.length - 1;
}

function slideTo(i) {
  if (animating || i < 0 || i >= state.books.length || i === state.book) return;
  if (document.activeElement?.matches('.book-name')) document.activeElement.blur();
  state.book = i;
  showDone = false;
  openSubFor = null;
  commit();
}

function openBook() {
  if (animating) return;
  const reveal = () => {
    state.open = true;
    showDone = false;
    openSubFor = null;
    commit();
    say(moodText());
  };
  if (reducedMotion()) return reveal();
  // the cover swings open at the spine, then the first page settles in
  animating = true;
  const cover = carousel.children[state.book];
  cover.classList.add('opening');
  setTimeout(() => {
    cover.classList.remove('opening');
    reveal();
    card.classList.add('turn-in');
    setTimeout(() => { card.classList.remove('turn-in'); animating = false; }, 280);
  }, 320);
}

function closeBook() {
  if (animating) return;
  if (document.activeElement === nameInput) nameInput.blur();
  state.open = false;
  commit();
  if (reducedMotion()) return;
  const cover = carousel.children[state.book];
  cover.classList.add('closing');
  setTimeout(() => cover.classList.remove('closing'), 320);
}

$('#close-book').addEventListener('click', closeBook);
$('#book-prev').addEventListener('click', () => slideTo(state.book - 1));
$('#book-next').addEventListener('click', () => slideTo(state.book + 1));

carousel.addEventListener('click', (e) => {
  const cover = e.target.closest('.cover');
  if (!cover) return;
  if (cover.classList.contains('cover-new')) {
    state.books.push(newBook('new book', state.books.length % COVERS, [newList('notes')]));
    slideTo(state.books.length - 1);
    // name it right away once it has slid into the middle
    setTimeout(() => {
      const name = carousel.children[state.book]?.querySelector('.book-name');
      name?.focus();
      name?.select();
    }, reducedMotion() ? 0 : 320);
    return;
  }
  const i = Number(cover.dataset.index);
  if (i !== state.book) return slideTo(i);
  if (!e.target.closest('.book-name')) openBook();
});

carousel.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.cover[data-pos="center"]:not(.cover-new)')) {
    e.preventDefault();
    openBook();
  }
  if (e.key === 'Enter' && e.target.matches('.book-name')) e.target.blur();
});

carousel.addEventListener('input', (e) => {
  if (!e.target.matches('.book-name')) return;
  bk().name = e.target.value.trim() || 'untitled';
  save();
});
carousel.addEventListener('focusout', (e) => {
  if (e.target.matches('.book-name')) e.target.value = bk().name;
});

$('#swatches').replaceChildren(...Array.from({ length: COVERS }, (_, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch';
  b.dataset.cover = i;
  b.setAttribute('aria-label', `cover colour ${i + 1}`);
  return b;
}));
$('#swatches').addEventListener('click', (e) => {
  const s = e.target.closest('[data-cover]');
  if (!s) return;
  bk().cover = Number(s.dataset.cover);
  commit();
});

$('#del-book').addEventListener('click', () => {
  if (state.books.length === 1) return;
  const before = JSON.stringify(state);
  const name = bk().name;
  state.books.splice(state.book, 1);
  state.book = Math.min(state.book, state.books.length - 1);
  commit();
  offerUndo(`"${name}" deleted`, before);
});

// swipe between books on touch screens
let shelfTouchX = null;
carousel.addEventListener('touchstart', (e) => { shelfTouchX = e.touches[0].clientX; }, { passive: true });
carousel.addEventListener('touchend', (e) => {
  if (shelfTouchX === null) return;
  const dx = e.changedTouches[0].clientX - shelfTouchX;
  shelfTouchX = null;
  if (Math.abs(dx) > 50) slideTo(state.book + (dx < 0 ? 1 : -1));
});

// ---------- finished tasks ----------

$('#show-done').addEventListener('click', () => {
  showDone = !showDone;
  render();
  if (showDone) $('#done-panel').scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
});

// puts a finished task back where it was: same title (re-created if it was deleted), same spot
function bringBack(id) {
  const l = cur();
  const i = l.done.findIndex((d) => d.id === id);
  if (i === -1) return;
  const [d] = l.done.splice(i, 1);
  let arr = l.tasks;
  if (d.from) {
    let title = l.titles.find((t) => t.id === d.from)
      ?? l.titles.find((t) => t.text === d.fromText);
    if (!title) {
      title = { id: d.from, text: d.fromText ?? 'brought back', tasks: [] };
      l.titles.push(title);
    }
    arr = title.tasks;
  }
  arr.splice(Math.min(d.index, arr.length), 0, { id: d.id, text: d.text });
  commit();
  list.querySelector(`[data-task="${CSS.escape(d.id)}"]`)?.classList.add('pop');
  say('back on the page');
}

$('#done-list').addEventListener('click', (e) => {
  const back = e.target.closest('.bring-back');
  if (back) bringBack(back.closest('.done-item').dataset.done);
});

$('#clear-done').addEventListener('click', () => {
  const before = JSON.stringify(state);
  cur().done = [];
  commit();
  offerUndo('finished list cleared', before);
});

peekBunny.addEventListener('click', () => say(['hm?', 'yo.', 'need something?', moodText()][Math.floor(Math.random() * 4)]));

// keep in sync across open tabs
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  state = load() ?? starterState();
  render();
});

// ---------- light / dark ----------

const THEME_KEY = 'lil-todos-theme';
const root = document.documentElement;

function applyTheme(theme) {
  root.dataset.theme = theme;
  const other = theme === 'light' ? 'dark' : 'light';
  const toggle = $('#theme-toggle');
  toggle.setAttribute('aria-label', `Switch to ${other} mode`);
  toggle.title = `${other} mode`;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(root).getPropertyValue('--bg').trim();
}

$('#theme-toggle').addEventListener('click', () => {
  const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* still switches for this visit */ }
  applyTheme(theme);
});

// until you pick one, follow the system setting as it changes
matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* treat as unset */ }
  if (!saved) applyTheme(e.matches ? 'light' : 'dark');
});

// ---------- boot ----------

mountSprites();
document.documentElement.style.setProperty('--sprite-check', spriteURL('check'));
document.documentElement.style.setProperty('--sprite-check-faint', spriteURL('checkFaint'));
const today = new Date()
  .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  .toLowerCase();
$('#date').textContent = today[0].toUpperCase() + today.slice(1);

applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
render();
bubble.textContent = moodText();
