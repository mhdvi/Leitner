// Small DOM and motion helpers shared by the views.

import { sfx } from './sfx.js';

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// h('div.card#id', { onclick, style, ...attrs }, ...children)
export function h(tag, props, ...children) {
  if (props == null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) {
    children.unshift(props);
    props = {};
  }
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9-]*)(.*)$/i);
  const el = document.createElement(name || 'div');
  for (const part of rest.match(/[.#][^.#]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, val);
        else el.style[prop] = val;
      }
    }
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className += ' ' + v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function svg(markup, cls = '') {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  const el = t.content.firstChild;
  if (cls) el.classList.add(...cls.split(' '));
  return el;
}

const I = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const icons = {
  settings: I('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
  close: I('<path d="M18 6 6 18M6 6l12 12"/>'),
  back: I('<path d="m15 18-6-6 6-6"/>'),
  speaker: I('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path class="wave w1" d="M15.5 8.5a5 5 0 0 1 0 7"/><path class="wave w2" d="M19 5a10 10 0 0 1 0 14"/>'),
  check: I('<path d="M20 6 9 17l-5-5"/>', 'stroke-width="2.4"'),
  x: I('<path d="M18 6 6 18M6 6l12 12"/>', 'stroke-width="2.4"'),
  flame: I('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
  target: I('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  award: I('<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>'),
  play: I('<path d="m6 3 14 9-14 9V3z"/>', 'fill="currentColor"'),
  download: I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  upload: I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  trash: I('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  arrowUp: I('<path d="M12 19V5M5 12l7-7 7 7"/>', 'stroke-width="2.2"'),
  arrowDown: I('<path d="M12 5v14M19 12l-7 7-7-7"/>', 'stroke-width="2.2"'),
  arrowRight: I('<path d="M5 12h14M12 5l7 7-7 7"/>'),
  lock: I('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  clock: I('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  layers: I('<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'),
};

export const icon = (name, cls = 'icon') => svg(icons[name], cls);

export const fmt = (n) => n.toLocaleString('en-US');

// Animated number from its current value to `to`.
export function countUp(el, to, { from = Number(el.dataset.value ?? 0), duration = 900, delay = 0, format = fmt } = {}) {
  el.dataset.value = to;
  if (reduceMotion() || from === to) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now() + delay;
  const step = (now) => {
    const t = Math.min(1, Math.max(0, (now - start) / duration));
    const e = 1 - Math.pow(1 - t, 4);
    el.textContent = format(Math.round(from + (to - from) * e));
    if (t < 1) requestAnimationFrame(step);
  };
  el.textContent = format(from);
  requestAnimationFrame(step);
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Toast ------------------------------------------------------------------

export function toast(message, kind = 'info') {
  const el = h('div.toast', { class: kind, role: 'status' }, message);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600);
  }, 2800);
}

// ---- Modal dialog -------------------------------------------------------------

export function confirmDialog({ title, body, confirm = 'Confirm', cancel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const close = (result) => {
      sfx.tap();
      overlay.classList.remove('in');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => overlay.remove(), 260);
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(false);
      }
    };
    const ok = h('button.btn', { class: danger ? 'danger' : 'primary', onclick: () => close(true) }, confirm);
    const overlay = h(
      'div.overlay',
      { onclick: (e) => e.target === overlay && close(false) },
      h(
        'div.dialog',
        { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h2', title),
        body && h('p', body),
        h('div.dialog-actions', h('button.btn.ghost', { onclick: () => close(false) }, cancel), ok),
      ),
    );
    document.body.append(overlay);
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => {
      overlay.classList.add('in');
      ok.focus();
    });
  });
}

// ---- Celebration particles ------------------------------------------------------

export function burst(x, y, { count = 14, colors = ['var(--accent)'], spread = 90 } = {}) {
  if (reduceMotion()) return;
  const layer = document.getElementById('fx');
  for (let i = 0; i < count; i++) {
    const p = h('i.spark');
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.background = colors[i % colors.length];
    layer.append(p);
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const r = spread * (0.55 + Math.random() * 0.6);
    p.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(0.2)`, opacity: 0 },
      ],
      { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.15,.7,.3,1)' },
    ).onfinish = () => p.remove();
  }
}
