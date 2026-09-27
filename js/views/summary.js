import { h, icon, svg, countUp, fmt, burst, reduceMotion, wait } from '../ui.js';
import { settings, streak } from '../store.js';
import { flowChart } from '../charts.js';
import { speak, supported as speechSupported } from '../speech.js';
import { sfx } from '../sfx.js';
import { go } from '../router.js';

const R = 52;
const C = 2 * Math.PI * R;

export function summaryView(params) {
  if (!params.results?.length) return { redirect: 'home' };
  const { results, before, moves, ms, completed } = params;
  const n = results.length;
  const correct = results.filter((r) => r.correct).length;
  const pct = Math.round((correct / n) * 100);
  const missed = results.filter((r) => !r.correct);
  const days = streak();
  const accent = settings().accent;

  const title = pct === 100 ? 'Flawless' : pct >= 85 ? 'Excellent session' : pct >= 60 ? 'Solid progress' : 'Every miss is a lesson';
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);

  const pctNum = h('span.ring-num', '0');
  const ring = svg(
    `<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="${R}"/><circle class="ring-fg" cx="60" cy="60" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>`,
  );
  const ringFg = ring.querySelector('.ring-fg');

  const flow = flowChart(before, moves);

  const el = h(
    'main.summary',
    h(
      'section.card.result',
      h('div.result-ring', ring, h('div.ring-label', pctNum, h('small', '%'))),
      h(
        'div.result-text',
        h('span.eyebrow', completed ? 'Session complete' : 'Session ended early'),
        h('h1', title),
        h(
          'p.muted',
          `${fmt(correct)} of ${fmt(n)} correct · ${mins ? `${mins}m ` : ''}${secs}s`,
        ),
        days > 0 && completed && h('span.pill.streak', icon('flame'), `${days}-day streak`),
      ),
    ),
    h(
      'section.card',
      h('header.card-head', h('div', h('h2', 'How your cards moved'), h('p.muted', 'Each dot is a word travelling to its new box.'))),
      flow,
    ),
    missed.length &&
      h(
        'section.card.missed',
        h('header.card-head', h('div', h('h2', 'Words to revisit'), h('p.muted', 'These are back in Box 1 and will return tomorrow.'))),
        h(
          'ul.word-list',
          missed.map((r, i) =>
            h(
              'li',
              { style: { '--i': i } },
              h(
                'div.wl-en',
                h('b', { lang: 'en' }, r.word.w),
                r.word.us && h('span.ipa', `/${accent === 'uk' ? r.word.uk : r.word.us}/`),
              ),
              h('span.wl-fa', { dir: 'rtl', lang: 'fa' }, r.word.fa),
              speechSupported &&
                h(
                  'button.icon-btn.sm',
                  {
                    'aria-label': `Pronounce ${r.word.w}`,
                    onclick: (e) => {
                      const b = e.currentTarget;
                      b.classList.add('speaking');
                      speak(r.word.w).then(() => b.classList.remove('speaking'));
                    },
                  },
                  icon('speaker'),
                ),
            ),
          ),
        ),
      ),
    h('div.summary-actions', h('button.btn.primary.lg', { onclick: () => (sfx.tap(), go('home')) }, 'Done')),
  );

  const onKey = (e) => {
    if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') go('home');
  };

  return {
    el,
    async mount() {
      document.addEventListener('keydown', onKey);
      sfx.complete();
      await wait(reduceMotion() ? 0 : 250);
      ringFg.style.transition = reduceMotion() ? 'none' : 'stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1)';
      ringFg.setAttribute('stroke-dashoffset', String(C * (1 - pct / 100)));
      countUp(pctNum, pct, { duration: 1300 });
      if (pct >= 85) {
        setTimeout(() => {
          const r = ring.getBoundingClientRect();
          burst(r.left + r.width / 2, r.top + r.height / 2, {
            count: 22,
            spread: 120,
            colors: ['var(--box-1)', 'var(--box-3)', 'var(--box-5)', 'var(--good)'],
          });
        }, 1100);
      }
      await wait(reduceMotion() ? 0 : 900);
      const r = flow.getBoundingClientRect();
      if (r.bottom > window.innerHeight) {
        flow.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
        await wait(reduceMotion() ? 0 : 550);
      }
      flow.play();
    },
    unmount() {
      document.removeEventListener('keydown', onKey);
    },
  };
}
