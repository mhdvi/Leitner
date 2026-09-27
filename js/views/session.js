import { h, icon, svg, burst, confirmDialog, reduceMotion, wait } from '../ui.js';
import { settings, save, markGoal, addSession, dayKey } from '../store.js';
import { answer, boxOf } from '../leitner.js';
import { buildQuestion, posLabel, LEVEL_TAGS } from '../words.js';
import { speak, stop as stopSpeech, supported as speechSupported } from '../speech.js';
import { sfx } from '../sfx.js';
import { go } from '../router.js';

const RING = 2 * Math.PI * 20;

export function sessionView(params) {
  if (!params.words?.length) return { redirect: 'home' };
  const s = settings();
  const words = params.words;
  const results = [];
  const startedAt = Date.now();
  let idx = -1;
  let card = null; // current card controller
  let finished = false;

  const progressFill = h('div.progress-fill');
  const progressText = h('span.progress-text', `0 / ${words.length}`);
  const scoreNum = h('b', '0');

  const stage = h('div.stage');
  const el = h(
    'main.session',
    h(
      'header.session-top',
      h('button.icon-btn', { 'aria-label': 'End session', onclick: quit }, icon('close')),
      h('div.progress', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': words.length }, progressFill),
      progressText,
      h('span.score', { title: 'Correct answers' }, icon('check'), scoreNum),
    ),
    stage,
    h(
      'footer.session-keys',
      h('span', h('kbd', '1'), '–', h('kbd', '5'), ' answer'),
      speechSupported && h('span', h('kbd', 'Space'), ' listen'),
      h('span', h('kbd', 'Enter'), ' next'),
    ),
  );

  function updateProgress() {
    const done = results.length;
    progressFill.style.transform = `scaleX(${done / words.length})`;
    progressText.textContent = `${Math.min(idx + 1, words.length)} / ${words.length}`;
    el.querySelector('.progress').setAttribute('aria-valuenow', done);
    scoreNum.textContent = results.filter((r) => r.correct).length;
  }

  function next() {
    if (finished) return;
    idx += 1;
    if (idx >= words.length) return finish();
    const prev = card;
    card = makeCard(words[idx]);
    stage.append(card.el);
    updateProgress();
    if (prev) {
      sfx.whoosh();
      prev.leave();
    }
    card.enter();
  }

  function makeCard(word) {
    const q = buildQuestion(word);
    const box = boxOf(word);
    let answered = false;
    let timer = null;

    const badgeText = h('span', box ? `Box ${box}` : 'New word');
    const badge = h('span.box-badge', { style: { '--c': box ? `var(--box-${box})` : 'var(--text-3)' } }, badgeText);

    const ringSvg = svg(
      `<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="ring-bg" cx="24" cy="24" r="20"/><circle class="ring-fg" cx="24" cy="24" r="20" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg>`,
    );
    const ringFg = ringSvg.querySelector('.ring-fg');
    const ringNum = h('span.timer-num', String(s.timer));
    const timerEl = h('div.timer', { role: 'timer', 'aria-label': `${s.timer} seconds` }, ringSvg, ringNum);

    const speakBtn = h(
      'button.speak',
      { 'aria-label': `Pronounce ${word.w}`, onclick: () => say(true), hidden: !speechSupported },
      icon('speaker'),
    );
    const ipa = s.accent === 'uk' ? word.uk : word.us;
    const len = word.w.length;

    const optionEls = q.options.map((opt, i) =>
      h(
        'button.option',
        { onclick: () => choose(i), style: { '--i': i }, dir: 'rtl', lang: 'fa' },
        h('span.opt-key', String(i + 1)),
        h('span.opt-text', opt.fa),
        h('span.opt-mark'),
      ),
    );

    const feedback = h('div.feedback');
    const el = h(
      'article.qcard',
      h(
        'div.qcard-meta',
        badge,
        h('span.meta-tags', word.listName || [posLabel(word), LEVEL_TAGS[word.lvl], word.topic].filter(Boolean).join(' · ')),
        timerEl,
      ),
      h(
        'div.word-block',
        h('div.word-row', h('h1.word', { class: len > 13 ? 'xlong' : len > 9 ? 'long' : '', lang: 'en' }, word.w), speakBtn),
        ipa && h('div.ipa', `/${ipa}/`),
      ),
      h('div.options', { role: 'group', 'aria-label': 'Choose the Farsi meaning' }, optionEls),
      feedback,
    );

    async function say(manual) {
      if (!speechSupported) return;
      if (manual) sfx.tap();
      speakBtn.classList.add('speaking');
      await speak(word.w);
      speakBtn.classList.remove('speaking');
    }

    // ---- Timer ----
    const total = s.timer * 1000;
    let elapsed = 0;
    let last = 0;
    let raf = 0;
    let lastSecond = s.timer;
    function tick(now) {
      if (!last) last = now;
      if (!document.hidden) elapsed += now - last;
      last = now;
      const left = Math.max(0, total - elapsed);
      ringFg.setAttribute('stroke-dashoffset', String(RING * (1 - left / total)));
      const sec = Math.ceil(left / 1000);
      if (sec !== lastSecond) {
        lastSecond = sec;
        ringNum.textContent = sec;
        if (sec <= 3 && sec > 0) {
          timerEl.classList.add('urgent');
          timerEl.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
          sfx.tick(true);
        }
      }
      if (left <= 0) return choose(-1);
      raf = requestAnimationFrame(tick);
    }
    const startTimer = () => {
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    const stopTimer = () => cancelAnimationFrame(raf);

    function choose(i) {
      if (answered) return;
      answered = true;
      stopTimer();
      const correct = i === q.answer;
      const timedOut = i === -1;
      const move = answer(word, correct);
      save();
      results.push({ word, correct, timedOut, choice: i >= 0 ? q.options[i] : null, ...move, ms: Math.round(elapsed) });
      updateProgress();

      el.classList.add('answered', correct ? 'is-correct' : 'is-wrong');
      optionEls.forEach((b, j) => {
        b.disabled = true;
        if (j === q.answer) {
          b.classList.add(correct ? 'correct' : 'reveal');
          b.querySelector('.opt-mark').append(icon('check'));
        } else if (j === i) {
          b.classList.add('wrong');
          b.querySelector('.opt-mark').append(icon('x'));
        } else b.classList.add('dim');
      });

      // The box badge shows where this word goes next.
      const to = move.to;
      badge.style.setProperty('--c', `var(--box-${to})`);
      badge.classList.add('moved', to > move.from ? 'up' : 'down');
      badgeText.replaceChildren(
        move.from ? `Box ${move.from}` : 'New',
        icon('arrowRight'),
        `Box ${to}`,
      );

      if (correct) {
        sfx.correct();
        const r = optionEls[i].getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, { count: 12, spread: 70, colors: ['var(--good)', 'var(--accent)', 'var(--box-2)'] });
        feedback.replaceChildren(h('span.fb.good', icon('check'), randomPraise()));
      } else {
        if (timedOut) {
          sfx.timeout();
          timerEl.classList.add('expired');
          feedback.replaceChildren(h('span.fb.bad', icon('clock'), "Time's up"));
        } else {
          sfx.wrong();
          feedback.replaceChildren(h('span.fb.bad', icon('x'), 'Not quite'));
        }
        if (!reduceMotion()) el.animate(shake, { duration: 420, easing: 'ease-out' });
        if (s.autoSpeak) setTimeout(() => say(false), 500);
      }
      feedback.append(h('button.btn.continue', { onclick: () => advance() }, 'Next', icon('arrowRight')));
      feedback.classList.add('in');

      autoTimer = setTimeout(advance, correct ? 1100 : 2600);
    }

    let autoTimer = 0;
    let advanced = false;
    function advance() {
      if (advanced) return;
      advanced = true;
      clearTimeout(autoTimer);
      next();
    }

    return {
      el,
      get answered() {
        return answered;
      },
      choose,
      advance,
      say: () => say(true),
      async enter() {
        if (s.autoSpeak) setTimeout(() => say(false), reduceMotion() ? 0 : 260);
        await wait(reduceMotion() ? 0 : 320);
        if (!answered && !finished) startTimer();
      },
      leave() {
        stopTimer();
        clearTimeout(autoTimer);
        el.classList.add('leaving');
        el.addEventListener('animationend', () => el.remove(), { once: true });
        setTimeout(() => el.remove(), 700);
      },
      destroy() {
        stopTimer();
        clearTimeout(autoTimer);
      },
    };
  }

  function finish() {
    if (finished) return;
    finished = true;
    card?.destroy();
    stopSpeech();
    const completed = results.length === words.length;
    if (completed && !params.extra) markGoal();
    const moves = results.map((r) => ({ from: r.from, to: r.to, correct: r.correct }));
    addSession({
      date: dayKey(),
      at: new Date().toISOString(),
      n: results.length,
      correct: results.filter((r) => r.correct).length,
      ms: Date.now() - startedAt,
    });
    save();
    if (!results.length) return go('home', null, { replace: true });
    go('summary', { results, before: params.before, moves, ms: Date.now() - startedAt, completed }, { replace: true });
  }

  async function quit() {
    sfx.tap();
    if (!results.length) {
      finished = true;
      card?.destroy();
      stopSpeech();
      return go('home', null, { replace: true });
    }
    const pausedCard = card;
    const ok = await confirmDialog({
      title: 'End this session?',
      body: `Your ${results.length} answer${results.length === 1 ? ' is' : 's are'} already saved.`,
      confirm: 'End session',
      cancel: 'Keep going',
    });
    if (ok && pausedCard === card) finish();
  }

  function onKey(e) {
    if (document.querySelector('.overlay')) return;
    if (!card) return;
    if (e.key >= '1' && e.key <= '5' && !card.answered) {
      e.preventDefault();
      card.choose(Number(e.key) - 1);
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      card.say();
    } else if ((e.key === 'Enter' || e.key === 'ArrowRight') && card.answered) {
      e.preventDefault();
      card.advance();
    } else if (e.key === 'Escape') {
      quit();
    }
  }

  return {
    el,
    mount() {
      document.addEventListener('keydown', onKey);
      next();
    },
    unmount() {
      document.removeEventListener('keydown', onKey);
      card?.destroy();
      stopSpeech();
      finished = true;
    },
  };
}

const shake = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-9px)' },
  { transform: 'translateX(7px)' },
  { transform: 'translateX(-4px)' },
  { transform: 'translateX(2px)' },
  { transform: 'translateX(0)' },
];

const PRAISE = ['Correct', 'Nice', 'Well done', 'Exactly', 'Spot on', 'Great'];
const randomPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
