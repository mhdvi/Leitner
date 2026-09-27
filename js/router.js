// Minimal hash router with animated view transitions.
// Each view is a function (params) => { el, mount?, unmount? }.

import { reduceMotion } from './ui.js';

const views = {};
let current = null;
let currentName = '';
let pendingParams = null;
let root;

export function register(name, view) {
  views[name] = view;
}

export function start(el, fallback) {
  root = el;
  window.addEventListener('hashchange', () => show(route(), pendingParams));
  show(route() || fallback);
  function route() {
    return location.hash.replace(/^#\/?/, '') || fallback;
  }
}

export function go(name, params = null, { replace = false } = {}) {
  pendingParams = params;
  const hash = '#/' + name;
  if (location.hash === hash) return show(name, params);
  if (replace) {
    history.replaceState(null, '', hash);
    show(name, params);
  } else {
    location.hash = hash;
  }
}

export function currentView() {
  return currentName;
}

function show(name, params) {
  pendingParams = null;
  const view = views[name] || views.home;
  const next = view(params || {});
  if (next.redirect) return go(next.redirect, null, { replace: true });

  const prev = current;
  const dir = name === 'home' ? 'back' : 'forward';
  current = next;
  currentName = name;
  next.el.classList.add('view', `view-${name}`);
  prev?.unmount?.();

  if (prev && !reduceMotion()) {
    const old = prev.el;
    old.classList.add('leaving', dir);
    old.setAttribute('aria-hidden', 'true');
    old.addEventListener('animationend', () => old.remove(), { once: true });
    setTimeout(() => old.remove(), 600);
    next.el.classList.add('entering', dir);
    next.el.addEventListener('animationend', () => next.el.classList.remove('entering', 'forward', 'back'), { once: true });
  } else if (prev) {
    prev.el.remove();
  }
  root.append(next.el);
  window.scrollTo(0, 0);
  next.mount?.();
}
