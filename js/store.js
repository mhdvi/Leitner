// All progress lives in this browser's localStorage under one key.
// The whole state is small (a few hundred KB at most), so a single JSON blob
// written synchronously after every answer is both simple and crash-safe.

const KEY = 'leitner:v1';
const APP_ID = 'leitner-words';
const VERSION = 1;

export const DEFAULT_SETTINGS = {
  daily: 20,          // questions per daily session
  level: 'b1',        // CEFR level new words start from
  timer: 10,          // seconds per question
  accent: 'us',       // 'us' | 'uk' — voice and phonetics
  voice: '',          // voiceURI of the preferred speech voice ('' = auto)
  rate: 0.9,          // speech rate
  autoSpeak: true,    // pronounce each word when its card appears
  sfx: true,          // sound effects
  volume: 0.7,        // sound effect volume 0..1
  theme: 'auto',      // 'auto' | 'light' | 'dark'
  bank: true,         // study the built-in word bank (users may study only their own lists)
};

function fresh() {
  return {
    app: APP_ID,
    version: VERSION,
    createdAt: new Date().toISOString(),
    onboarded: false,
    settings: { ...DEFAULT_SETTINGS },
    cards: {},     // card key -> { b: box 1-5, d: due day, n: times seen, c: correct, w: wrong, t: last day }
                   // built-in words use the word itself as key; list words use "<list id>:<word>"
    lists: [],     // imported word lists: { id, name, enabled, created, words: [[word, meaning, ipa], ...] }
    days: {},      // 'YYYY-MM-DD' -> { q: answered, c: correct, goal: daily goal reached }
    sessions: [],  // recent session summaries, newest last
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {
    console.warn('Could not read saved progress', e);
  }
  return fresh();
}

function normalize(s) {
  const base = fresh();
  return {
    ...base,
    ...s,
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
    cards: s.cards || {},
    lists: Array.isArray(s.lists) ? s.lists.filter(validList) : [],
    days: s.days || {},
    sessions: Array.isArray(s.sessions) ? s.sessions : [],
  };
}

export function getState() {
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Could not save progress', e);
    return false;
  }
}

export function settings() {
  return state.settings;
}

export function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  save();
}

export function setOnboarded() {
  state.onboarded = true;
  save();
}

export function resetProgress() {
  const { settings: keep, lists } = state;
  state = fresh();
  state.settings = keep;
  state.lists = lists; // lists are content, not progress
  state.onboarded = true;
  save();
}

// ---- Word lists -------------------------------------------------------------

function validList(l) {
  return l && typeof l.id === 'string' && typeof l.name === 'string' && Array.isArray(l.words);
}

export function lists() {
  return state.lists;
}

// Returns false (and changes nothing) if the browser has no room left to save it.
// `extra` marks ready-made lists: { pack: 'gre', packVersion: 1 }.
export function addList(name, words, extra = {}) {
  const list = {
    id: 'l' + Date.now().toString(36),
    name,
    enabled: true,
    created: new Date().toISOString(),
    words,
    ...extra,
  };
  state.lists.push(list);
  if (save()) return list;
  state.lists.pop();
  return null;
}

export function setListEnabled(id, enabled) {
  const list = state.lists.find((l) => l.id === id);
  if (list) list.enabled = enabled;
  save();
}

// Removes the list and every card that came from it.
export function removeList(id) {
  state.lists = state.lists.filter((l) => l.id !== id);
  for (const key of Object.keys(state.cards)) if (key.startsWith(id + ':')) delete state.cards[key];
  save();
}

// ---- Days -------------------------------------------------------------------

// Local calendar day as an integer, so "due tomorrow" follows the user's midnight.
export function today() {
  const d = new Date();
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
}

export function dayKey(day = today()) {
  return new Date(day * 864e5).toISOString().slice(0, 10);
}

export function dayStats(day = today()) {
  return state.days[dayKey(day)] || { q: 0, c: 0, goal: false };
}

export function recordAnswer(correct) {
  const k = dayKey();
  const d = state.days[k] || { q: 0, c: 0, goal: false };
  d.q += 1;
  if (correct) d.c += 1;
  state.days[k] = d;
}

export function markGoal() {
  const k = dayKey();
  state.days[k] = { ...(state.days[k] || { q: 0, c: 0 }), goal: true };
}

// Consecutive days (ending today, or yesterday if today isn't done yet) with the goal reached.
export function streak() {
  let day = today();
  if (!dayStats(day).goal) day -= 1;
  let n = 0;
  while (dayStats(day).goal) {
    n += 1;
    day -= 1;
  }
  return n;
}

export function addSession(summary) {
  state.sessions.push(summary);
  if (state.sessions.length > 120) state.sessions.splice(0, state.sessions.length - 120);
}

// ---- Export / import ----------------------------------------------------------

export function exportData() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 1);
}

export function importData(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!data || data.app !== APP_ID || typeof data.cards !== 'object') {
    throw new Error('This file is not a Leitner Words backup.');
  }
  if (data.version > VERSION) {
    throw new Error('This backup was made by a newer version of the app.');
  }
  for (const [word, c] of Object.entries(data.cards)) {
    if (!c || !(c.b >= 1 && c.b <= 5) || typeof c.d !== 'number') {
      throw new Error(`The backup has an invalid entry for “${word}”.`);
    }
  }
  delete data.exportedAt;
  state = normalize(data);
  state.onboarded = true;
  save();
  return Object.keys(state.cards).length;
}

export function storageBytes() {
  try {
    return (localStorage.getItem(KEY) || '').length * 2;
  } catch {
    return 0;
  }
}

// Ask the browser not to evict our data under storage pressure.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) || false;
  } catch {
    return false;
  }
}
