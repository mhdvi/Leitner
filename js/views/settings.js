import { h, icon, fmt, toast, confirmDialog } from '../ui.js';
import {
  getState, settings, updateSettings, exportData, importData, resetProgress, storageBytes, requestPersistence, dayKey,
} from '../store.js';
import { WORDS, LEVELS, LEVEL_NAMES, LEVEL_TAGS } from '../words.js';
import { englishVoices, onVoices, currentVoice, speak, supported as speechSupported } from '../speech.js';
import { sfx } from '../sfx.js';
import { applyTheme } from '../theme.js';
import { go } from '../router.js';
import { DAILY_PRESETS, estimate } from './welcome.js';
import { listsSection } from './lists.js';

export function settingsView() {
  const s = () => settings();
  const cleanups = [];

  // ---- Controls ----

  function stepper(value, { min, max, step, onChange, format = String }) {
    let v = value;
    const out = h('b.stepper-value', format(v));
    const set = (n) => {
      v = Math.max(min, Math.min(max, n));
      out.textContent = format(v);
      sfx.select();
      onChange(v);
    };
    return h(
      'div.stepper',
      h('button.icon-btn.sm', { 'aria-label': 'Decrease', onclick: () => set(v - step) }, '−'),
      out,
      h('button.icon-btn.sm', { 'aria-label': 'Increase', onclick: () => set(v + step) }, '+'),
    );
  }

  function segmented(options, value, onChange, label) {
    const btns = options.map(([val, text]) =>
      h(
        'button.seg',
        {
          'aria-pressed': String(val === value),
          onclick: () => {
            btns.forEach((b) => b.setAttribute('aria-pressed', String(b === btnFor(val))));
            sfx.select();
            onChange(val);
          },
        },
        text,
      ),
    );
    const btnFor = (val) => btns[options.findIndex((o) => o[0] === val)];
    return h('div.segmented', { role: 'group', 'aria-label': label }, btns);
  }

  function toggle(value, onChange, label) {
    const btn = h('button.switch', {
      role: 'switch',
      'aria-checked': String(value),
      'aria-label': label,
      onclick: () => {
        const on = btn.getAttribute('aria-checked') !== 'true';
        btn.setAttribute('aria-checked', String(on));
        onChange(on);
        sfx.toggle(on);
      },
    });
    return btn;
  }

  function range(value, { min, max, step, onChange, format }) {
    const out = h('span.range-value', format(value));
    const input = h('input', {
      type: 'range', min, max, step, value,
      oninput: (e) => {
        out.textContent = format(Number(e.target.value));
        onChange(Number(e.target.value));
      },
    });
    const sync = () => input.style.setProperty('--p', ((input.value - min) / (max - min)) * 100 + '%');
    input.addEventListener('input', sync);
    sync();
    return h('div.range', input, out);
  }

  const row = (title, desc, control) =>
    h('div.row', h('div.row-text', h('span.row-title', title), desc && h('span.row-desc', desc)), control);

  const section = (title, ...rows) => h('section.card.settings-group', h('h2', title), ...rows);

  // ---- Learning ----

  const dailyDesc = h('span', estimate(s().daily));
  const learning = section(
    'Learning',
    row('Questions per day', dailyDesc, stepper(s().daily, {
      min: 5, max: 200, step: 5,
      onChange: (v) => {
        updateSettings({ daily: v });
        dailyDesc.textContent = estimate(v);
      },
    })),
    row(
      'Start new words from',
      'Later levels follow, then earlier ones.',
      h(
        'select.select',
        { onchange: (e) => (updateSettings({ level: e.target.value }), sfx.select()), 'aria-label': 'Starting level' },
        LEVELS.map((l) => h('option', { value: l, selected: s().level === l }, `${LEVEL_TAGS[l]} · ${LEVEL_NAMES[l]}`)),
      ),
    ),
    row('Time per question', 'An unanswered card counts as wrong.', segmented(
      [[5, '5s'], [10, '10s'], [15, '15s'], [20, '20s']],
      s().timer,
      (v) => updateSettings({ timer: v }),
      'Seconds per question',
    )),
  );

  // ---- Sound ----

  const voiceSelect = h('select.select', {
    'aria-label': 'Voice',
    onchange: (e) => {
      updateSettings({ voice: e.target.value });
      speak('Pronunciation');
    },
  });
  const fillVoices = () => {
    const list = englishVoices();
    const cur = currentVoice();
    voiceSelect.replaceChildren(
      h('option', { value: '', selected: !s().voice }, `Automatic${cur && !s().voice ? ` (${cur.name})` : ''}`),
      ...list
        .slice()
        .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
        .map((v) => h('option', { value: v.voiceURI, selected: s().voice === v.voiceURI }, `${v.name} — ${v.lang}`)),
    );
  };
  fillVoices();
  cleanups.push(onVoices(fillVoices));

  const sound = section(
    'Sound',
    row('Pronounce words automatically', 'When each card appears.', toggle(s().autoSpeak, (v) => updateSettings({ autoSpeak: v }), 'Pronounce automatically')),
    row('Accent', 'Voice and phonetic spelling.', segmented([['us', 'American'], ['uk', 'British']], s().accent, (v) => {
      updateSettings({ accent: v, voice: '' });
      fillVoices();
      speak('Pronunciation');
    }, 'Accent')),
    speechSupported
      ? row('Voice', 'Voices come from your device.', voiceSelect)
      : row('Voice', 'This browser has no built-in speech voice.', h('span.muted', 'Unavailable')),
    speechSupported &&
      row('Speaking speed', null, range(s().rate, {
        min: 0.6, max: 1.2, step: 0.05,
        format: (v) => `${v.toFixed(2)}×`,
        onChange: (v) => updateSettings({ rate: v }),
      })),
    speechSupported &&
      row('Test the voice', null, h('button.btn.ghost', { onclick: () => speak('Remarkable') }, icon('speaker'), 'Play sample')),
    row('Sound effects', null, toggle(s().sfx, (v) => updateSettings({ sfx: v }), 'Sound effects')),
    row('Effects volume', null, range(s().volume, {
      min: 0, max: 1, step: 0.05,
      format: (v) => `${Math.round(v * 100)}%`,
      onChange: (v) => updateSettings({ volume: v }),
    })),
  );
  // Preview the volume when the slider is released.
  sound.querySelectorAll('input[type=range]').forEach((r, i, all) => {
    if (r === all[all.length - 1]) r.addEventListener('change', () => sfx.correct());
  });

  // ---- Appearance ----

  const appearance = section(
    'Appearance',
    row('Theme', null, segmented([['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']], s().theme, (v) => {
      updateSettings({ theme: v });
      applyTheme(v);
    }, 'Theme')),
  );

  // ---- Data ----

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: onImport });
  const learned = Object.keys(getState().cards).length;
  const persistNote = h('span', '');
  requestPersistence().then((ok) => {
    persistNote.textContent = ok ? ' Protected from automatic cleanup.' : '';
  });

  const data = section(
    'Your data',
    h(
      'p.group-note',
      icon('lock'),
      h('span', 'Progress is saved only in this browser (', fmt(Math.ceil(storageBytes() / 1024)), ' KB).', persistNote, ' Export a backup to move it to another device or keep it safe.'),
    ),
    row('Export progress', `${fmt(learned)} words with history.`, h('button.btn.ghost', { onclick: onExport }, icon('download'), 'Export')),
    row('Import progress', 'Replaces the progress on this device.', h('button.btn.ghost', { onclick: () => fileInput.click() }, icon('upload'), 'Import')),
    row('Reset progress', 'Start over from scratch.', h('button.btn.ghost.danger-text', { onclick: onReset }, icon('trash'), 'Reset')),
    fileInput,
  );

  const about = section(
    'About',
    h(
      'p.group-note',
      `${fmt(WORDS.length)} words: the Oxford 5000 plus the Academic Word List, New Academic Word List and Academic Vocabulary List — the core of IELTS and TOEFL reading and listening — and vocabulary for 12 IELTS topics. Phonetics from the Oxford word list and the CMU Pronouncing Dictionary.`,
    ),
  );

  const el = h(
    'main.settings',
    h(
      'header.topbar',
      h('button.icon-btn', { 'aria-label': 'Back', onclick: () => (sfx.tap(), go('home')) }, icon('back')),
      h('h1.topbar-title', 'Settings'),
      h('span.spacer'),
    ),
    learning,
    listsSection({ row, toggle }),
    sound,
    appearance,
    data,
    about,
  );

  function onExport() {
    sfx.tap();
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `leitner-words-backup-${dayKey()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Backup downloaded', 'good');
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let text;
    try {
      text = await file.text();
      const preview = JSON.parse(text);
      const n = Object.keys(preview.cards || {}).length;
      const ok = await confirmDialog({
        title: 'Replace your progress?',
        body: `This backup has ${fmt(n)} words in progress. Your current progress on this device will be replaced.`,
        confirm: 'Replace',
        danger: true,
      });
      if (!ok) return;
      importData(text);
      applyTheme();
      toast('Progress imported', 'good');
      go('home');
    } catch (err) {
      toast(err.message || 'Could not import this file', 'bad');
    }
  }

  async function onReset() {
    const ok = await confirmDialog({
      title: 'Reset all progress?',
      body: 'Every word goes back to not started. Export a backup first if you might want it later.',
      confirm: 'Reset',
      danger: true,
    });
    if (!ok) return;
    resetProgress();
    toast('Progress reset');
    go('home');
  }

  const onKey = (e) => {
    if (e.key === 'Escape' && !document.querySelector('.overlay')) go('home');
  };

  return {
    el,
    mount() {
      document.addEventListener('keydown', onKey);
    },
    unmount() {
      document.removeEventListener('keydown', onKey);
      cleanups.forEach((fn) => fn());
    },
  };
}
