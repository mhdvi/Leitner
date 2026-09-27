// Leitner system with five boxes.
// A correct answer moves a card up one box; a wrong answer (or timeout) sends it back to box 1.
// Each box is reviewed on a longer interval, so well-known words come back less often.

import { getState, today, recordAnswer } from './store.js';
import { LEVELS, activeWords } from './words.js';

export const BOXES = 5;
export const INTERVALS = [0, 1, 2, 4, 8, 16]; // days until next review, indexed by box

export function intervalLabel(box) {
  const d = INTERVALS[box];
  return d === 1 ? 'Every day' : `Every ${d} days`;
}

// Word counts per box for the words being studied (disabled lists are paused and not counted):
// index 0 = not started yet, 1..5 = boxes.
export function boxCounts() {
  const { cards } = getState();
  const counts = [0, 0, 0, 0, 0, 0];
  for (const w of activeWords().all) counts[cards[w.key]?.b || 0] += 1;
  return counts;
}

export function dueCounts(day = today()) {
  const { cards } = getState();
  const counts = [0, 0, 0, 0, 0, 0];
  for (const w of activeWords().all) {
    const c = cards[w.key];
    if (c && c.d <= day) counts[c.b] += 1;
  }
  return counts;
}

// Level order for introducing new words: the chosen level first, then harder ones, then easier.
function levelOrder(level) {
  const i = Math.max(0, LEVELS.indexOf(level));
  return [...LEVELS.slice(i), ...LEVELS.slice(0, i).reverse()];
}

// Planned composition of the next session without building it.
export function plan(n = getState().settings.daily) {
  const due = dueCounts().reduce((a, b) => a + b, 0);
  const reviews = Math.min(due, n);
  const newAvail = boxCounts()[0];
  return { reviews, fresh: Math.min(n - reviews, newAvail), dueTotal: due };
}

export function buildSession(n) {
  const { cards, settings } = getState();
  const day = today();
  const { all, custom, bank } = activeWords();

  // 1. Due cards, lowest box first (the ones most at risk of being forgotten), oldest due first.
  const due = all
    .filter((w) => cards[w.key] && cards[w.key].d <= day)
    .sort((a, b) => cards[a.key].b - cards[b.key].b || cards[a.key].d - cards[b.key].d || Math.random() - 0.5)
    .slice(0, n);

  // 2. Fill the rest with new words: the user's own lists first (in list order),
  //    then the bank in level order, most frequent first.
  const picked = [...due];
  for (const w of custom) {
    if (picked.length >= n) break;
    if (!cards[w.key]) picked.push(w);
  }
  if (picked.length < n) {
    for (const lvl of levelOrder(settings.level)) {
      for (const w of bank) {
        if (picked.length >= n) break;
        if (w.lvl === lvl && !cards[w.key]) picked.push(w);
      }
      if (picked.length >= n) break;
    }
  }
  return shuffle(picked);
}

// Applies an answer to the card and returns the move it caused.
export function answer(word, correct) {
  const state = getState();
  const day = today();
  const card = state.cards[word.key];
  const from = card ? card.b : 0;
  // A new word answered correctly is already known, so it skips ahead to box 2.
  const to = correct ? Math.min(Math.max(from, 1) + 1, BOXES) : 1;
  const next = card || { b: 1, d: day, n: 0, c: 0, w: 0, t: day };
  next.b = to;
  next.d = day + INTERVALS[to];
  next.n += 1;
  next.t = day;
  if (correct) next.c += 1;
  else next.w += 1;
  state.cards[word.key] = next;
  recordAnswer(correct);
  return { from, to };
}

export function boxOf(word) {
  return getState().cards[word.key]?.b || 0;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
