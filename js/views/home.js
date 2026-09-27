import { h, icon, fmt, countUp } from '../ui.js';
import { getState, settings, dayStats, streak } from '../store.js';
import { boxCounts, dueCounts, plan, buildSession } from '../leitner.js';
import { activeWords } from '../words.js';
import { boxChart } from '../charts.js';
import { go } from '../router.js';
import { sfx, unlock as unlockAudio } from '../sfx.js';
import { unlock as unlockSpeech } from '../speech.js';

export function homeView() {
  const s = settings();
  const counts = boxCounts();
  const due = dueCounts();
  const today = dayStats();
  const p = plan();
  const total = activeWords().all.length;
  const learning = total - counts[0];
  const goalDone = today.goal;
  const days = streak();

  const start = () => {
    unlockAudio();
    unlockSpeech();
    const words = buildSession(s.daily);
    if (!words.length) return;
    sfx.start();
    go('session', { words, before: boxCounts(), extra: goalDone });
  };

  const now = new Date();
  const dateLine = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const cardsToday = p.reviews + p.fresh;

  const heroNum = h('span.hero-num', '0');
  const startBtn = h(
    'button.btn.primary.xl.start',
    { onclick: start, disabled: !cardsToday },
    h('span', goalDone ? 'Practice more' : 'Start'),
    icon('arrowRight'),
  );

  const hero = h(
    'section.card.hero',
    h('div.hero-top', h('span.eyebrow', dateLine), goalDone && h('span.pill.good', icon('check'), 'Daily goal done')),
    h(
      'div.hero-main',
      h('div.hero-figure', heroNum, h('span.hero-unit', cardsToday === 1 ? 'card' : 'cards')),
      h(
        'p.hero-sub',
        !cardsToday
          ? 'You have learned every word. Remarkable.'
          : goalDone
            ? `An extra round: ${breakdown(p)}.`
            : `Today: ${breakdown(p)}.`,
      ),
    ),
    startBtn,
    h('div.hero-keys', h('kbd', 'Enter'), ' to start'),
  );

  const chart = boxChart(counts, due);
  const chartCard = h(
    'section.card.boxes-card',
    h(
      'header.card-head',
      h('div', h('h2', 'Your Leitner boxes'), h('p.muted', `${fmt(learning)} learning · ${fmt(counts[0])} not started · ${fmt(total)} total`)),
    ),
    chart,
    h('p.chart-note', 'A right answer moves a word up one box; a new word you already know starts in Box 2. A miss sends it back to Box 1. Higher boxes come back less often.'),
  );

  const acc = accuracy();
  const stats = h(
    'section.stats',
    stat('flame', days, days === 1 ? 'day streak' : 'day streak', 'streak'),
    stat('target', acc === null ? '—' : acc + '%', 'accuracy', 'acc'),
    stat('award', counts[5], 'in Box 5', 'master'),
  );

  const el = h(
    'main.home',
    h(
      'header.topbar',
      h('div.brand', logo(), h('span', 'Leitner', h('em', ' Words'))),
      h('button.icon-btn', { 'aria-label': 'Settings', onclick: () => (sfx.tap(), go('settings')) }, icon('settings')),
    ),
    hero,
    chartCard,
    stats,
    h('footer.privacy', icon('lock'), 'Your progress is stored only on this device.'),
  );

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.repeat && document.activeElement?.tagName !== 'BUTTON') start();
  };

  return {
    el,
    mount() {
      countUp(heroNum, cardsToday, { duration: 700, delay: 120 });
      chart.animateIn(200);
      el.querySelectorAll('[data-count]').forEach((n, i) => countUp(n, Number(n.dataset.count), { delay: 300 + i * 80 }));
      document.addEventListener('keydown', onKey);
    },
    unmount() {
      document.removeEventListener('keydown', onKey);
    },
  };
}

function breakdown(p) {
  const parts = [];
  if (p.reviews) parts.push(`${fmt(p.reviews)} review${p.reviews === 1 ? '' : 's'}`);
  if (p.fresh) parts.push(`${fmt(p.fresh)} new word${p.fresh === 1 ? '' : 's'}`);
  return parts.join(' + ') || 'nothing due';
}

function stat(iconName, value, label, cls) {
  const num = typeof value === 'number' ? h('b', { 'data-count': value }, '0') : h('b', value);
  return h('div.stat', { class: cls }, h('span.stat-icon', icon(iconName)), h('div', num, h('span', label)));
}

function accuracy() {
  let q = 0;
  let c = 0;
  for (const d of Object.values(getState().days)) {
    q += d.q;
    c += d.c;
  }
  return q ? Math.round((c / q) * 100) : null;
}

export function logo() {
  const el = h('span.logo', { 'aria-hidden': 'true' });
  for (let i = 1; i <= 5; i++) el.append(h('i', { style: { '--i': i } }));
  return el;
}
