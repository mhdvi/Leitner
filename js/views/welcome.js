import { h, icon, fmt } from '../ui.js';
import { settings, updateSettings, setOnboarded, requestPersistence } from '../store.js';
import { WORDS, LEVELS, LEVEL_NAMES, LEVEL_TAGS } from '../words.js';
import { speak, unlock as unlockSpeech, supported as speechSupported } from '../speech.js';
import { sfx, unlock as unlockAudio } from '../sfx.js';
import { go } from '../router.js';
import { logo } from './home.js';

export const DAILY_PRESETS = [10, 20, 30, 50];

export function welcomeView() {
  const draft = { ...settings() };
  let step = 0;
  const steps = [intro, daily, level, sound];

  const dots = h('div.steps', steps.map((_, i) => h('i', { class: i === 0 ? 'on' : '' })));
  const backBtn = h('button.icon-btn', { 'aria-label': 'Back', onclick: () => show(step - 1), style: { visibility: 'hidden' } }, icon('back'));
  const body = h('div.onb-body');
  const el = h('main.onboarding', h('header.onb-top', backBtn, dots, h('span.spacer')), body);

  function show(i, first = false) {
    if (i < 0 || i >= steps.length) return;
    if (!first) sfx.tap();
    const dir = i > step ? 'fwd' : 'bwd';
    step = i;
    const panel = steps[i]();
    panel.classList.add('onb-panel', first ? 'first' : dir);
    body.replaceChildren(panel);
    [...dots.children].forEach((d, j) => d.classList.toggle('on', j <= i));
    backBtn.style.visibility = i > 0 ? 'visible' : 'hidden';
    panel.querySelector('.btn.primary')?.focus({ preventScroll: true });
  }

  function intro() {
    return h(
      'section',
      h('div.onb-hero', logo()),
      h('h1.onb-title', `${fmt(WORDS.length)} words.`, h('br'), 'Five boxes.', h('br'), h('span.accent-text', 'A few minutes a day.')),
      h(
        'p.onb-lead',
        'Master the essential IELTS & TOEFL vocabulary, English to Farsi, with the Leitner spaced-repetition method.',
      ),
      h(
        'ul.onb-points',
        h('li', icon('layers'), h('span', 'Words you know climb to higher boxes and come back less often.')),
        h('li', icon('clock'), h('span', 'Ten seconds per card keeps recall honest.')),
        h('li', icon('lock'), h('span', 'Everything stays in this browser. No account, no server.')),
      ),
      h('button.btn.primary.lg.block', { onclick: () => show(1) }, 'Get started', icon('arrowRight')),
    );
  }

  function daily() {
    const value = h('b.stepper-value', String(draft.daily));
    const minutes = h('span');
    const chips = DAILY_PRESETS.map((n) =>
      h('button.chip', { onclick: () => set(n), 'aria-pressed': String(draft.daily === n) }, String(n)),
    );
    function set(n) {
      draft.daily = Math.max(5, Math.min(200, n));
      value.textContent = draft.daily;
      minutes.textContent = estimate(draft.daily);
      chips.forEach((c) => c.setAttribute('aria-pressed', String(Number(c.textContent) === draft.daily)));
      sfx.select();
      value.animate([{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
    }
    minutes.textContent = estimate(draft.daily);
    return h(
      'section',
      h('span.eyebrow', 'Step 1 of 3'),
      h('h1.onb-title.sm', 'How many questions a day?'),
      h('p.onb-lead', 'Reviews that are due come first; the rest are new words. You can change this any time.'),
      h(
        'div.stepper.big',
        h('button.icon-btn', { 'aria-label': 'Fewer', onclick: () => set(draft.daily - 5) }, '−'),
        value,
        h('button.icon-btn', { 'aria-label': 'More', onclick: () => set(draft.daily + 5) }, '+'),
      ),
      h('p.muted.center', minutes),
      h('div.chips.center', chips),
      h('button.btn.primary.lg.block', { onclick: () => show(2) }, 'Continue', icon('arrowRight')),
    );
  }

  function level() {
    const options = LEVELS.filter((l) => l !== 'ac').map((l) => {
      const count = WORDS.filter((w) => w.lvl === l).length;
      return h(
        'button.level-opt',
        {
          'aria-pressed': String(draft.level === l),
          onclick: (e) => {
            draft.level = l;
            sfx.select();
            e.currentTarget.parentElement.querySelectorAll('.level-opt').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          },
        },
        h('span.lvl-tag', LEVEL_TAGS[l]),
        h('span.lvl-name', LEVEL_NAMES[l]),
        h('span.lvl-count', `${fmt(count)} words`),
      );
    });
    return h(
      'section',
      h('span.eyebrow', 'Step 2 of 3'),
      h('h1.onb-title.sm', 'Where should we start?'),
      h('p.onb-lead', 'New words are introduced from this level upward, most common first. Academic words follow C1.'),
      h('div.level-list', options),
      h('button.btn.primary.lg.block', { onclick: () => show(3) }, 'Continue', icon('arrowRight')),
    );
  }

  function sound() {
    const play = h(
      'button.sound-test',
      {
        onclick: async () => {
          unlockAudio();
          unlockSpeech();
          play.classList.add('speaking');
          await speak('Welcome', { rate: draft.rate });
          play.classList.remove('speaking');
        },
        disabled: !speechSupported,
      },
      icon('speaker'),
      h('span', speechSupported ? 'Tap to hear' : 'Speech not available'),
    );
    const accents = ['us', 'uk'].map((a) =>
      h(
        'button.seg',
        {
          'aria-pressed': String(draft.accent === a),
          onclick: (e) => {
            draft.accent = a;
            updateSettings({ accent: a });
            sfx.select();
            accents.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
            play.click();
          },
        },
        a === 'us' ? 'American' : 'British',
      ),
    );
    return h(
      'section',
      h('span.eyebrow', 'Step 3 of 3'),
      h('h1.onb-title.sm', 'Turn your sound on'),
      h(
        'p.onb-lead',
        speechSupported
          ? 'Each word is pronounced by your device’s built-in voice. Pick the accent you want to learn.'
          : 'This browser has no speech voice, so words will be shown without audio. Phonetics are always shown.',
      ),
      play,
      speechSupported && h('div.segmented.center', accents),
      h('button.btn.primary.lg.block', { onclick: finish }, 'Start learning', icon('arrowRight')),
    );
  }

  function finish() {
    unlockAudio();
    updateSettings({ daily: draft.daily, level: draft.level, accent: draft.accent });
    setOnboarded();
    requestPersistence();
    sfx.start();
    go('home', null, { replace: true });
  }

  return {
    el,
    mount() {
      show(0, true);
    },
  };
}

export function estimate(n) {
  const m = Math.max(1, Math.round((n * 7) / 60));
  return `About ${m} minute${m === 1 ? '' : 's'} a day`;
}
