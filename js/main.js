import { getState } from './store.js';
import { register, start } from './router.js';
import { applyTheme } from './theme.js';
import { welcomeView } from './views/welcome.js';
import { homeView } from './views/home.js';
import { sessionView } from './views/session.js';
import { summaryView } from './views/summary.js';
import { settingsView } from './views/settings.js';

applyTheme();

const needsOnboarding = () => !getState().onboarded;
const guarded = (view) => (params) => (needsOnboarding() ? { redirect: 'welcome' } : view(params));

register('welcome', (p) => (needsOnboarding() ? welcomeView(p) : { redirect: 'home' }));
register('home', guarded(homeView));
register('session', guarded(sessionView));
register('summary', guarded(summaryView));
register('settings', guarded(settingsView));

start(document.getElementById('app'), needsOnboarding() ? 'welcome' : 'home');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker not registered', e));
  });
}
