// Settings section for the user's own word lists: add (paste or file), switch on/off, export, delete.

import { h, icon, fmt, toast, confirmDialog } from '../ui.js';
import { getState, settings, updateSettings, lists, addList, setListEnabled, removeList } from '../store.js';
import { WORDS } from '../words.js';
import { parseList, readTextFile, toCSV, templateCSV, downloadText, MAX_WORDS } from '../wordlists.js';
import PACKS from '../data/packs/index.js';
import { sfx } from '../sfx.js';
import { shuffle } from '../leitner.js';

// `row` and `toggle` are the settings view's own controls, so the section matches the page.
export function listsSection({ row, toggle }) {
  const el = h('section.card.settings-group');

  function started(list) {
    const cards = getState().cards;
    return list.words.filter(([w]) => cards[`${list.id}:${w}`]).length;
  }

  // At least one source has to stay on, or there would be nothing to study.
  function enabledCount() {
    return (settings().bank ? 1 : 0) + lists().filter((l) => l.enabled).length;
  }

  function sourceToggle(on, onChange, label) {
    const sw = toggle(on, (v) => {
      if (!v && enabledCount() <= 1) {
        sw.setAttribute('aria-checked', 'true');
        toast('Keep at least one word list switched on');
        return;
      }
      onChange(v);
      render();
    }, label);
    return sw;
  }

  function render() {
    const rows = [
      row(
        'Built-in words',
        `${fmt(WORDS.length)} IELTS & TOEFL words`,
        sourceToggle(settings().bank, (v) => updateSettings({ bank: v }), 'Built-in words'),
      ),
      ...lists().map((list) =>
        row(
          list.name,
          `${fmt(list.words.length)} words · ${fmt(started(list))} started${list.enabled ? '' : ' · paused'}`,
          h(
            'div.list-controls',
            h('button.icon-btn.sm', { 'aria-label': `Export ${list.name}`, title: 'Export as CSV', onclick: () => exportList(list) }, icon('download')),
            h('button.icon-btn.sm.danger-text', { 'aria-label': `Delete ${list.name}`, title: 'Delete list', onclick: () => deleteList(list) }, icon('trash')),
            sourceToggle(list.enabled, (v) => setListEnabled(list.id, v), `Study ${list.name}`),
          ),
        ),
      ),
    ];
    const available = PACKS.filter((p) => !lists().some((l) => l.pack === p.id));
    // h() skips false children, replaceChildren() doesn't, so build the section through h().
    el.replaceChildren(
      ...h('div', h('h2', 'Word lists'),
      h(
        'p.group-note',
        icon('layers'),
        h('span', 'Add your own words to study them in the same Leitner boxes. New cards come from your lists first. A list that is switched off is paused: its words keep their boxes.'),
      ),
      ...rows,
      available.length > 0 &&
        h(
          'div.available',
          h('h3', 'Ready-made lists'),
          available.map((pack) =>
            row(
              pack.name,
              `${fmt(pack.count)} words · ${pack.description}`,
              h('button.btn.ghost.add-pack', { onclick: (e) => addPack(pack, e.currentTarget) }, '+ Add'),
            ),
          ),
        ),
      h(
        'div.list-actions',
        h('button.btn.primary', { onclick: () => openAddDialog(render) }, icon('upload'), 'Add a word list'),
        h('button.btn.ghost', { onclick: () => downloadText(templateCSV(), 'word-list-template.csv') }, icon('download'), 'Template'),
      ),
      ).childNodes,
    );
  }

  async function addPack(pack, button) {
    button.disabled = true;
    button.textContent = 'Adding…';
    try {
      const { default: data } = await import(`../data/packs/${pack.id}.js`);
      // Ready-made lists are stored in random order, so new cards don't march through the alphabet.
      const list = addList(pack.name, shuffle(data.words), { pack: pack.id, packVersion: data.version });
      if (!list) throw new Error('storage');
      sfx.correct();
      toast(`Added “${pack.name}” · ${fmt(data.words.length)} words`, 'good');
      render();
    } catch (e) {
      button.disabled = false;
      button.textContent = '+ Add';
      toast(e.message === 'storage' ? 'Not enough storage space in this browser for this list' : 'Could not load the list. Check your connection.', 'bad');
    }
  }

  function exportList(list) {
    sfx.tap();
    downloadText(toCSV(list.words), `${list.name.replace(/[\\/:*?"<>|]+/g, '-')}.csv`);
  }

  async function deleteList(list) {
    const n = started(list);
    const ok = await confirmDialog({
      title: `Delete “${list.name}”?`,
      body: `Its ${fmt(list.words.length)} words${n ? ` and the progress on ${fmt(n)} of them` : ''} will be removed. Export it first if you might want it again.`,
      confirm: 'Delete',
      danger: true,
    });
    if (!ok) return;
    if (!list.enabled || enabledCount() > 1) {
      removeList(list.id);
    } else {
      // Deleting the only enabled source: fall back to the built-in words.
      removeList(list.id);
      updateSettings({ bank: true });
    }
    toast('List deleted');
    render();
  }

  render();
  return el;
}

// ---- Add-a-list dialog ----------------------------------------------------------

function defaultName() {
  const names = new Set(lists().map((l) => l.name));
  let n = lists().length + 1;
  while (names.has(`My list ${n}`)) n += 1;
  return `My list ${n}`;
}

function openAddDialog(onAdded) {
  const bankWords = new Set(WORDS.map((w) => w.w.toLowerCase()));
  let parsed = { words: [], skipped: [], duplicates: 0, truncated: false };

  const name = h('input.text-input', { type: 'text', value: defaultName(), maxlength: 60, 'aria-label': 'List name' });
  const text = h('textarea.text-area', {
    rows: 8,
    spellcheck: false,
    placeholder: 'ubiquitous, همه‌جا حاضر\nmitigate = کاهش دادن\nresilient\tمقاوم، انعطاف‌پذیر',
    'aria-label': 'Words and meanings',
    oninput: update,
  });
  const file = h('input', {
    type: 'file',
    accept: '.csv,.txt,.tsv,text/csv,text/plain',
    hidden: true,
    onchange: async (e) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      text.value = await readTextFile(f);
      if (name.value.startsWith('My list')) name.value = f.name.replace(/\.[^.]+$/, '').slice(0, 60);
      update();
    },
  });
  const summary = h('div.import-summary', { 'aria-live': 'polite' });
  const add = h('button.btn.primary', { onclick: submit, disabled: true }, 'Add list');

  function update() {
    parsed = parseList(text.value);
    const n = parsed.words.length;
    const known = parsed.words.filter(([w]) => bankWords.has(w.toLowerCase())).length;
    const parts = [];
    if (n) parts.push(h('span.ok', icon('check'), `${fmt(n)} word${n === 1 ? '' : 's'} ready`));
    if (parsed.skipped.length) {
      const lines = parsed.skipped.slice(0, 5).join(', ') + (parsed.skipped.length > 5 ? '…' : '');
      parts.push(h('span.warn', `${fmt(parsed.skipped.length)} line${parsed.skipped.length === 1 ? '' : 's'} skipped (line ${lines}): each line needs a word and a meaning`));
    }
    if (parsed.duplicates) parts.push(h('span', `${fmt(parsed.duplicates)} repeated word${parsed.duplicates === 1 ? '' : 's'} ignored`));
    if (known) parts.push(h('span', `${fmt(known)} also in the built-in words — you'll study ${known === 1 ? 'it' : 'them'} from this list, with your meaning`));
    if (parsed.truncated) parts.push(h('span.warn', `Only the first ${fmt(MAX_WORDS)} words are kept`));
    summary.replaceChildren(...parts);
    add.disabled = !n || !name.value.trim();
  }
  name.addEventListener('input', update);

  function close() {
    overlay.classList.remove('in');
    document.removeEventListener('keydown', onKey, true);
    setTimeout(() => overlay.remove(), 260);
  }

  function submit() {
    if (!parsed.words.length) return;
    const list = addList(name.value.trim(), parsed.words);
    if (!list) {
      toast('Not enough storage space in this browser for this list', 'bad');
      return;
    }
    sfx.correct();
    toast(`Added “${list.name}” · ${fmt(list.words.length)} words`, 'good');
    close();
    onAdded();
  }

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };

  const overlay = h(
    'div.overlay',
    { onclick: (e) => e.target === overlay && close() },
    h(
      'div.dialog.wide',
      { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Add a word list' },
      h('h2', 'Add a word list'),
      h('p', 'Paste your words below, or choose a CSV or text file. One word per line, then its meaning, separated by a comma, tab or =.'),
      h('label.field', h('span', 'Name'), name),
      text,
      h(
        'div.dialog-tools',
        h('button.btn.ghost', { onclick: () => file.click() }, icon('upload'), 'Choose file'),
        h('button.link-btn', { onclick: () => downloadText(templateCSV(), 'word-list-template.csv') }, 'Download template'),
        file,
      ),
      summary,
      h('div.dialog-actions', h('button.btn.ghost', { onclick: close }, 'Cancel'), add),
    ),
  );
  document.body.append(overlay);
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => {
    overlay.classList.add('in');
    text.focus();
  });
}
