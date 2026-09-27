import { settings } from './store.js';

export function applyTheme(theme = settings().theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', dark ? '#111110' : '#f6f5f2');
  });
}

matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
