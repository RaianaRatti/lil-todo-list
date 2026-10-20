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
// { current: index, lists: [{ id, name, done, tasks: [task], titles: [{ id, text, tasks: [task] }] }] }

function starterState() {
  return {
    current: 0,
    lists: [
      {
        id: uid(), name: 'today', done: 0,
        tasks: [task('water the flowers'), task('be kind to yourself')],
        titles: [
          { id: uid(), text: 'groceries', tasks: [task('strawberries'), task('carrots for the bunny'), task('oat milk')] },
          { id: uid(), text: 'self care', tasks: [task('drink a glass of water'), task('stretch for 5 min')] },
        ],
      },
      {
        id: uid(), name: 'someday', done: 0,
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
    done: Number(l.done) || 0,
    tasks: cleanTasks(l.tasks),
    titles: (Array.isArray(l.titles) ? l.titles : [])
      .filter((t) => t && typeof t.text === 'string')
      .map((t) => ({ id: String(t.id || uid()), text: t.text, tasks: cleanTasks(t.tasks) })),
  }));
  const current = Math.min(Math.max(Number(raw.current) || 0, 0), lists.length - 1);
  return { current, lists };
}

function load() {
  try {
    const saved = normalize(JSON.parse(localStorage.getItem(KEY)));
    if (saved) return saved;
    // carry over unfinished todos from the single-list version
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (Array.isArray(old) && old.length) {
      const tasks = old.filter((t) => t && !t.done && typeof t.text === 'string').map((t) => task(t.text));
      return { current: 0, lists: [{ id: uid(), name: 'my list', done: 0, tasks, titles: [] }] };
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
let mode = 'task';
let openSubFor = null; // title id whose "add subtask" field is open
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

function moodText() {
  const l = cur();
  const left = remaining(l);
  if (!left) return l.done ? 'all done! nap time' : 'add something~';
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

function addSubButton() {
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'add-sub';
  add.textContent = '+ add subtask';
  return add;
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
  const inner = document.createElement('span');
  inner.textContent = title.text;
  heading.append(inner);
  row.append(flower, heading, delButton(`delete title "${title.text}" and its subtasks`));

  const subs = document.createElement('ul');
  subs.className = 'subs';
  subs.append(...title.tasks.map(taskEl));

  const tail = document.createElement('li');
  tail.className = 'sub-tail';
  if (openSubFor === title.id) {
    const f = document.createElement('form');
    f.className = 'sub-form';
    f.autocomplete = 'off';
    const field = document.createElement('input');
    field.className = 'field px';
    field.placeholder = `add to ${title.text}...`;
    field.maxLength = 140;
    field.setAttribute('aria-label', `New subtask under "${title.text}"`);
    f.append(field);
    tail.append(f);
  } else {
    tail.append(addSubButton());
  }
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

function sizeName() {
  nameInput.style.width = `calc(${Math.max(nameInput.value.length, 6) + 1}ch + 20px)`;
}

function render() {
  rendering = true;
  const l = cur();

  list.replaceChildren(...l.tasks.map(taskEl), ...l.titles.map(groupEl));
  mountSprites(list);

  const isEmpty = !l.tasks.length && !l.titles.length;
  $('#empty').hidden = !isEmpty;
  $('#empty-text').textContent = l.done ? 'all done! the bunny is napping' : 'nothing here yet...';
  $('#count').textContent = `${remaining(l)} left${l.done ? ` · ${l.done} done <3` : ''}`;

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
  for (const arr of [l.tasks, ...l.titles.map((t) => t.tasks)]) {
    const i = arr.findIndex((t) => t.id === id);
    if (i !== -1) return { arr, i, task: arr[i] };
  }
  return null;
}

const findTitle = (id) => cur().titles.find((t) => t.id === id);

// ---------- adding ----------

function setMode(m) {
  mode = m;
  document.querySelectorAll('[data-mode]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  input.placeholder = mode === 'title' ? 'new title, e.g. groceries' : 'what needs doing?';
}

document.querySelectorAll('[data-mode]').forEach((b) =>
  b.addEventListener('click', () => { setMode(b.dataset.mode); input.focus(); }));

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  if (mode === 'title') {
    const title = { id: uid(), text, tasks: [] };
    cur().titles.push(title);
    openSubFor = title.id; // jump straight into adding its subtasks
    setMode('task');
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
  if (!text || !title) return;
  title.tasks.push(task(text));
  commit(); // the field re-opens focused, ready for the next subtask
  say('added! <3');
});

function closeSubForm() {
  openSubFor = null;
  const tail = list.querySelector('.sub-form')?.closest('.sub-tail');
  tail?.replaceChildren(addSubButton());
}

list.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && e.target.closest('.sub-form')) closeSubForm();
});

list.addEventListener('focusout', (e) => {
  if (!rendering && e.target.closest('.sub-form')) closeSubForm();
});

// ---------- finishing / deleting ----------

list.addEventListener('change', (e) => {
  if (!e.target.matches('input[type="checkbox"]')) return;
  const found = findTask(e.target.closest('.todo').dataset.task);
  if (!found) return;
  const before = JSON.stringify(state);
  burst(e.target.getBoundingClientRect());
  found.arr.splice(found.i, 1);
  cur().done += 1;
  commit();
  offerUndo('done! <3', before);
  say(remaining() ? CHEERS[Math.floor(Math.random() * CHEERS.length)] : 'all done! nap time');
});

list.addEventListener('click', (e) => {
  if (e.target.closest('.add-sub')) {
    openSubFor = e.target.closest('.group').dataset.title;
    render();
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
  if (item) startEdit(span, item, isTitle);
});

function startEdit(span, item, isTitle) {
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
    if (ev.key === 'Enter') finish(true);
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
    state.lists.push({ id: uid(), name: `list ${state.lists.length + 1}`, done: 0, tasks: [], titles: [] });
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
$('#date').textContent = new Date()
  .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  .toLowerCase();

render();
bubble.textContent = moodText();
