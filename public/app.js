import { mountSprites, spriteURL, spriteSize } from './sprites.js';

const KEY = 'lil-todos-v2';
const OLD_KEY = 'lil-todos-v1';

const CHEERS = [
  'yay! good job!', 'you did it!', 'so proud of u', 'one less thing!', 'hop hop hooray',
  'keep going~', 'tiny wins!', 'look at you go',
];

const $ = (sel) => document.querySelector(sel);
const deck = $('#deck');
const card = $('#card');
const list = $('#list');
const form = $('#new');
const input = $('#new-text');
const nameInput = $('#list-name');
const tabs = $('#tabs');
const bubble = $('#bubble');
const peekBunny = $('#peek-bunny');
const toast = $('#toast');

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const task = (text) => ({ id: uid(), text });
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- state ----------
// { current: index, mode: 'task' | 'title',
//   lists: [{ id, name, tasks: [task], titles: [{ id, text, tasks: [task] }],
//             done: [{ id, text, from: title id | null, fromText, index }], doneBefore: count }] }
// `done` is newest first; `doneBefore` counts finishes from before they were kept.

const DONE_LIMIT = 200;
const newList = (name) => ({ id: uid(), name, tasks: [], titles: [], done: [], doneBefore: 0 });

function starterState() {
  return {
    current: 0,
    mode: 'task',
    lists: [
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
    ],
  };
}

function normalize(raw) {
  if (!raw || !Array.isArray(raw.lists) || !raw.lists.length) return null;
  const cleanTasks = (arr) => (Array.isArray(arr) ? arr : [])
    .filter((t) => t && typeof t.text === 'string')
    .map((t) => ({ id: String(t.id || uid()), text: t.text }));
  const lists = raw.lists.map((l) => ({
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
  const current = Math.min(Math.max(Number(raw.current) || 0, 0), lists.length - 1);
  return { current, mode: raw.mode === 'title' ? 'title' : 'task', lists };
}

function load() {
  try {
    const saved = normalize(JSON.parse(localStorage.getItem(KEY)));
    if (saved) return saved;
    // carry over unfinished todos from the single-list version
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (Array.isArray(old) && old.length) {
      const tasks = old.filter((t) => t && !t.done && typeof t.text === 'string').map((t) => task(t.text));
      return { current: 0, mode: 'task', lists: [{ ...newList('my list'), tasks }] };
    }
  } catch {
    // fall through to the starter lists
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

const cur = () => state.lists[state.current];

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
  say('phew, back again');
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
  if (!left) return doneCount(l) ? 'all done! nap time' : 'add something~';
  if (left === 1) return 'just one more!';
  return 'you got this!';
}

// ---------- rendering ----------

function delButton(label) {
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'del';
  del.textContent = 'x';
  del.setAttribute('aria-label', label);
  return del;
}

function taskEl(t) {
  const li = document.createElement('li');
  li.className = 'todo';
  li.dataset.task = t.id;

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.className = 'px';
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
  field.className = 'field px';
  field.placeholder = `add to ${title.text}...`;
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
  const flower = document.createElement('i');
  flower.dataset.sprite = 'flower';
  flower.dataset.scale = '2';
  flower.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('h3');
  heading.className = 'title-text';
  heading.title = 'click to add a subtask · double-click to rename';
  const inner = document.createElement('span');
  inner.textContent = title.text;
  heading.append(inner);
  row.append(flower, heading, delButton(`delete title "${title.text}" and its subtasks`));

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
  const newTab = document.createElement('button');
  newTab.type = 'button';
  newTab.className = 'chip px tab-new';
  newTab.id = 'add-list';
  newTab.textContent = '+ new list';

  tabs.replaceChildren(
    ...state.lists.map((l, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip px';
      b.dataset.index = i;
      b.textContent = l.name;
      if (i === state.current) b.setAttribute('aria-current', 'true');
      return b;
    }),
    newTab,
  );
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
    const text = document.createElement('span');
    text.className = 'done-text';
    text.textContent = d.text;
    const from = document.createElement('span');
    from.className = 'done-from';
    from.textContent = d.fromText ?? 'main list';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'link bring-back';
    back.textContent = 'bring back';
    back.setAttribute('aria-label', `bring back "${d.text}" to ${d.fromText ?? 'the main list'}`);
    li.append(text, from, back);
    return li;
  }));
  const older = $('#done-older');
  older.hidden = !l.doneBefore;
  older.textContent = `+ ${l.doneBefore} older ${l.doneBefore === 1 ? 'one' : 'ones'} (from before they were saved)`;
  $('#clear-done').hidden = !l.done.length;
}

function sizeName() {
  nameInput.style.width = `calc(${Math.max(nameInput.value.length, 6) + 1}ch + 20px)`;
}

function render() {
  rendering = true;
  const l = cur();

  list.replaceChildren(...l.tasks.map(taskEl), ...l.titles.map(groupEl));
  mountSprites(list);

  const isEmpty = !l.tasks.length && !l.titles.length;
  const finished = doneCount(l);
  $('#empty').hidden = !isEmpty;
  $('#empty-text').textContent = finished ? 'all done! the bunny is napping' : 'nothing here yet...';
  $('#count').textContent = `${remaining(l)} left${finished ? ' ·' : ''}`;
  const showBtn = $('#show-done');
  showBtn.hidden = !finished;
  showBtn.textContent = `${finished} done <3`;
  if (!finished) showDone = false;
  showBtn.setAttribute('aria-expanded', String(showDone));
  doneRender(l);
  syncMode();

  if (document.activeElement !== nameInput) nameInput.value = l.name;
  sizeName();
  $('#pager').textContent = `${state.current + 1} / ${state.lists.length}`;
  $('#del-list').hidden = state.lists.length === 1;
  $('#prev').disabled = $('#next').disabled = state.lists.length === 1;
  deck.dataset.count = Math.min(state.lists.length, 3);
  tabsRender();

  if (openSubFor) list.querySelector('.sub-form .field')?.focus();
  rendering = false;
}

function commit() {
  save();
  render();
}

function burst(rect) {
  if (reducedMotion()) return;
  const { w, h } = spriteSize('heartSolid');
  for (let i = 0; i < 7; i++) {
    const heart = document.createElement('i');
    heart.className = 'sprite burst';
    const scale = 2 + (i % 2);
    heart.style.width = `${w * scale}px`;
    heart.style.height = `${h * scale}px`;
    heart.style.backgroundImage = spriteURL(i % 3 === 0 ? 'sparkle' : 'heartSolid');
    heart.style.left = `${rect.left + rect.width / 2 - 7}px`;
    heart.style.top = `${rect.top + rect.height / 2 - 6}px`;
    const angle = (Math.PI * 2 * i) / 7 - Math.PI / 2;
    heart.style.setProperty('--dx', `${Math.round(Math.cos(angle) * 48)}px`);
    heart.style.setProperty('--dy', `${Math.round(Math.sin(angle) * 48) - 16}px`);
    heart.addEventListener('animationend', () => heart.remove());
    document.body.append(heart);
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

function syncMode() {
  document.querySelectorAll('[data-mode]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
  input.placeholder = state.mode === 'title' ? 'new title, e.g. groceries' : 'what needs doing?';
}

// remembered between visits, so the next add uses whatever you picked last
function setMode(m) {
  state.mode = m;
  save();
  syncMode();
}

document.querySelectorAll('[data-mode]').forEach((b) =>
  b.addEventListener('click', () => { setMode(b.dataset.mode); input.focus(); }));

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  if (state.mode === 'title') {
    const title = { id: uid(), text, tasks: [] };
    cur().titles.push(title);
    openSubFor = title.id; // jump straight into adding its subtasks
    commit();
    say('ooh, a new section!');
  } else {
    cur().tasks.push(task(text));
    commit();
    list.querySelector(`:scope > .todo:nth-child(${cur().tasks.length})`)?.classList.add('pop');
    say('added! <3');
  }
});

list.addEventListener('submit', (e) => {
  if (!e.target.matches('.sub-form')) return;
  e.preventDefault();
  const text = e.target.querySelector('.field').value.trim();
  const title = findTitle(e.target.closest('.group').dataset.title);
  if (!title) return;
  if (!text) return closeSubForm(e.target); // enter on an empty field means "done adding"
  title.tasks.push(task(text));
  commit(); // the field re-opens focused, ready for the next subtask
  say('added! <3');
});

// opens the new-subtask field under a title without re-rendering the list
// (re-rendering would swallow a double-click meant for renaming the title)
function openSubForm(group) {
  const title = findTitle(group.dataset.title);
  const tail = group.querySelector('.sub-tail');
  if (!title || !tail) return;
  openSubFor = title.id;
  if (!tail.querySelector('.sub-form')) tail.replaceChildren(subForm(title));
  tail.querySelector('.field').focus();
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
  offerUndo('done! <3', before);
  say(remaining() ? CHEERS[Math.floor(Math.random() * CHEERS.length)] : 'all done! nap time');
});

list.addEventListener('click', (e) => {
  if (e.target.closest('.title-text')) {
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
  field.className = 'edit px' + (isTitle ? ' title-edit' : '');
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
  sizeName();
  save();
  const tab = tabs.querySelector('[aria-current="true"]');
  if (tab) tab.textContent = cur().name;
});
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });
nameInput.addEventListener('blur', () => { nameInput.value = cur().name; sizeName(); });

function go(index, dir = index > state.current ? 1 : -1) {
  const n = state.lists.length;
  index = (index + n) % n;
  if (index === state.current || animating) return;
  openSubFor = null;
  showDone = false;
  if (document.activeElement === nameInput) nameInput.blur();
  const swap = () => {
    state.current = index;
    commit();
    say(moodText());
  };
  if (reducedMotion()) return swap();

  // the top card slides off, then the next one rises from the stack
  // (timers rather than animationend, which never fires in background tabs)
  animating = true;
  card.classList.add(dir > 0 ? 'out-next' : 'out-prev');
  setTimeout(() => {
    card.classList.remove('out-next', 'out-prev');
    swap();
    card.classList.add('in');
    setTimeout(() => {
      card.classList.remove('in');
      animating = false;
    }, 200);
  }, 240);
}

$('#prev').addEventListener('click', () => go(state.current - 1, -1));
$('#next').addEventListener('click', () => go(state.current + 1, 1));

tabs.addEventListener('click', (e) => {
  if (e.target.closest('#add-list')) {
    state.lists.push(newList(`list ${state.lists.length + 1}`));
    save();
    go(state.lists.length - 1, 1);
    // name it right away once the new card is showing
    setTimeout(() => { nameInput.focus(); nameInput.select(); }, reducedMotion() ? 0 : 480);
    return;
  }
  const tab = e.target.closest('[data-index]');
  if (tab) go(Number(tab.dataset.index));
});

$('#del-list').addEventListener('click', () => {
  if (state.lists.length === 1) return;
  const before = JSON.stringify(state);
  const name = cur().name;
  state.lists.splice(state.current, 1);
  state.current = Math.min(state.current, state.lists.length - 1);
  commit();
  offerUndo(`"${name}" deleted`, before);
  say(moodText());
});

// arrow keys flip cards when you're not typing
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea') || e.altKey || e.metaKey || e.ctrlKey) return;
  if (e.key === 'ArrowLeft') go(state.current - 1, -1);
  if (e.key === 'ArrowRight') go(state.current + 1, 1);
});

// swipe the card on touch screens
let touchX = null;
card.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
card.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 60) go(state.current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
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
  say('welcome back!');
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

peekBunny.addEventListener('click', () => say(['boop!', 'hehe', 'hi friend!', moodText()][Math.floor(Math.random() * 4)]));

// keep in sync across open tabs
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  state = load() ?? starterState();
  render();
});

// ---------- boot ----------

mountSprites();
document.documentElement.style.setProperty('--sprite-heart', spriteURL('heart'));
$('#grass').style.backgroundImage = spriteURL('grass');
const today = new Date()
  .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  .toLowerCase();
$('#date').textContent = today[0].toUpperCase() + today.slice(1);

render();
bubble.textContent = moodText();
