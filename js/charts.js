// Leitner box charts: the home overview and the animated end-of-session flow.

import { h, icon, fmt, countUp, reduceMotion, wait } from './ui.js';
import { intervalLabel, INTERVALS } from './leitner.js';
import { sfx } from './sfx.js';

const TRACK = 150; // px height of a full bar

const short = (b) => (INTERVALS[b] === 1 ? 'Daily' : `${INTERVALS[b]} days`);

function barHeight(count, max) {
  if (!count) return 0;
  return Math.max(4, Math.round((count / max) * TRACK));
}

// ---- Home: words per box ------------------------------------------------------------

export function boxChart(counts, due) {
  const max = Math.max(1, ...counts.slice(1));
  const cols = [1, 2, 3, 4, 5].map((b) => {
    const num = h('div.col-count', '0');
    const bar = h('div.col-bar');
    const dueTag = due[b] ? h('span.col-due', `${fmt(due[b])} due`) : null;
    const col = h(
      'div.col',
      {
        style: { '--c': `var(--box-${b})`, '--i': b },
        tabindex: 0,
        'aria-label': `Box ${b}: ${counts[b]} words, ${due[b]} due today. Reviewed ${intervalLabel(b).toLowerCase()}.`,
      },
      h(
        'div.col-tip',
        h('strong', `Box ${b}`),
        h('span', `${fmt(counts[b])} word${counts[b] === 1 ? '' : 's'}`),
        h('span', `${fmt(due[b])} due today`),
        h('span.muted', intervalLabel(b)),
      ),
      num,
      h('div.col-track', bar, !counts[b] && h('div.col-empty')),
      h('div.col-label', `Box ${b}`),
      h('div.col-sub', dueTag || short(b)),
    );
    col._animate = (delay) => {
      countUp(num, counts[b], { duration: 900, delay });
      setTimeout(() => (bar.style.height = barHeight(counts[b], max) + 'px'), delay);
    };
    return col;
  });
  const empty = counts.slice(1).every((c) => !c);
  const el = h(
    'div.chart.box-chart',
    { role: 'group', 'aria-label': 'Words in each Leitner box', class: empty ? 'is-empty' : '' },
    cols,
    empty && h('div.chart-empty', 'Your boxes fill up as you learn.', h('br'), 'Press Start to add your first words.'),
  );
  el.animateIn = (base = 150) => cols.forEach((c, i) => c._animate(reduceMotion() ? 0 : base + i * 70));
  return el;
}

// ---- Summary: cards flowing between boxes ---------------------------------------------

export function flowChart(before, moves) {
  const after = [...before];
  for (const m of moves) {
    after[m.from] -= 1;
    after[m.to] += 1;
  }
  const max = Math.max(1, ...before.slice(1), ...after.slice(1));
  const live = [...before];

  const cols = [];
  const deckCount = h('div.col-count', fmt(before[0]));
  const deck = h(
    'div.col.deck-col',
    { style: { '--i': 0 } },
    h('div.col-delta'),
    deckCount,
    h('div.col-track', h('div.deck', h('i'), h('i'), h('i'))),
    h('div.col-label', 'New'),
    h('div.col-sub', 'Not started'),
  );
  deck._count = deckCount;
  deck._bar = deck.querySelector('.deck');
  cols.push(deck);

  for (let b = 1; b <= 5; b++) {
    const count = h('div.col-count', fmt(before[b]));
    const bar = h('div.col-bar', { style: { height: barHeight(before[b], max) + 'px' } });
    const col = h(
      'div.col',
      { style: { '--c': `var(--box-${b})`, '--i': b } },
      h('div.col-delta'),
      count,
      h('div.col-track', bar),
      h('div.col-label', `Box ${b}`),
      h('div.col-sub', short(b)),
    );
    col._count = count;
    col._bar = bar;
    cols.push(col);
  }

  const layer = h('div.flow-layer');
  const up = moves.filter((m) => m.correct && m.to > m.from).length;
  const down = moves.filter((m) => !m.correct).length;
  const stay = moves.length - up - down;
  const legend = h(
    'div.flow-legend',
    h('span.leg.up', icon('arrowUp'), h('b', fmt(up)), ' moved up'),
    h('span.leg.down', icon('arrowDown'), h('b', fmt(down)), ' back to Box 1'),
    stay ? h('span.leg.stay', h('i.dot'), h('b', fmt(stay)), ' stayed in Box 5') : null,
  );
  const el = h('div.flow', h('div.chart.flow-chart', cols, layer), legend);

  function setCount(b) {
    const c = cols[b];
    c._count.textContent = fmt(live[b]);
    if (b > 0) c._bar.style.height = barHeight(live[b], max) + 'px';
  }

  function point(b, rectBase) {
    const c = cols[b];
    const r = (b === 0 ? c._bar : c._bar.parentElement).getBoundingClientRect();
    const top = b === 0 ? r.top : r.bottom - barHeight(live[b], max);
    return { x: r.left + r.width / 2 - rectBase.left, y: top - rectBase.top };
  }

  function bump(b) {
    cols[b].animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }],
      { duration: 260, easing: 'ease-out' },
    );
    cols[b]._count.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.4)' });
  }

  function showDeltas() {
    cols.forEach((c, b) => {
      const d = after[b] - before[b];
      const tag = c.querySelector('.col-delta');
      if (!d) return;
      tag.textContent = (d > 0 ? '+' : '−') + fmt(Math.abs(d));
      tag.classList.add(d > 0 ? 'pos' : 'neg', 'in');
    });
    legend.classList.add('in');
  }

  el.play = async () => {
    const travel = moves.filter((m) => m.from !== m.to);
    if (reduceMotion() || !travel.length) {
      for (let b = 0; b <= 5; b++) {
        live[b] = after[b];
        setCount(b);
      }
      showDeltas();
      return;
    }
    const stagger = Math.max(40, Math.min(140, 2200 / travel.length));
    const flights = travel.map(
      (m, i) =>
        new Promise((resolve) =>
          setTimeout(() => {
            const base = el.querySelector('.flow-chart').getBoundingClientRect();
            const s = point(m.from, base);
            live[m.from] -= 1;
            setCount(m.from);
            const e = point(m.to, base);
            const dot = h('i.flow-dot', { class: m.correct ? 'up' : 'down' });
            layer.append(dot);
            const peak = Math.min(s.y, e.y) - 40 - Math.abs(e.x - s.x) * 0.22;
            const cx = (s.x + e.x) / 2;
            const frames = [];
            for (let k = 0; k <= 24; k++) {
              const lin = k / 24;
              const t = lin < 0.5 ? 4 * lin * lin * lin : 1 - Math.pow(-2 * lin + 2, 3) / 2;
              const x = (1 - t) * (1 - t) * s.x + 2 * (1 - t) * t * cx + t * t * e.x;
              const y = (1 - t) * (1 - t) * s.y + 2 * (1 - t) * t * peak + t * t * e.y;
              const sc = 0.6 + Math.sin(lin * Math.PI) * 0.6;
              frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${sc})`, opacity: k === 24 ? 0.4 : 1 });
            }
            dot.animate(frames, { duration: 720, easing: 'linear' }).onfinish = () => {
              dot.remove();
              live[m.to] += 1;
              setCount(m.to);
              bump(m.to);
              sfx.land(m.to, m.correct);
              resolve();
            };
          }, i * stagger),
        ),
    );
    await Promise.all(flights);
    await wait(150);
    showDeltas();
  };
  return el;
}
