# Leitner Words

A private, offline-first web app (PWA) for learning English → Farsi vocabulary with the five-box Leitner system. It ships with 6,255 essential IELTS & TOEFL words, including topic vocabulary for 12 common IELTS themes. You can also add the ready-made GRE (1,121 words) and Phrasal verbs (444) lists, or import your own.

## Run it

It's a static site with no build step. ES modules and the service worker need an `http://` origin, so opening `index.html` from disk won't work.

```sh
python tools/serve.py        # http://localhost:8000
```

`tools/serve.py` exists because Windows often serves `.js` as `text/plain`, and browsers refuse to run modules sent that way. Any static host works: GitHub Pages, Netlify, Cloudflare Pages.

## How it works

- **Leitner boxes.** A correct answer moves a word up one box (a new word you already know goes straight to Box 2). A wrong answer or a timeout sends it back to Box 1. Boxes are reviewed every 1, 2, 4, 8 and 16 days.
- **Daily session.** Due words come first, lowest box first. Any remaining slots are filled with new words: first from your enabled word lists, then from the built-in words, starting at the chosen CEFR level and taking the most frequent words first.
- **Word lists.** Settings → Word lists lets you switch the built-in words and each list on or off (at least one stays on). A switched-off list is paused and keeps its boxes. Deleting a list removes its words and their progress.
  - *Ready-made lists:* GRE vocabulary and Phrasal verbs, added with one tap.
  - *Your own lists:* paste words or choose a CSV/TXT file, one `word, meaning` per line. The separator can be a comma, tab, `=`, `:` or `;`, and an optional last column in `/slashes/` is used as the phonetics. There's a template to download, and each list can be exported as CSV. A list holds up to 5,000 words.
- **IELTS topics.** About 400 built-in words are tagged with one of 12 themes: environment, education, health, technology, crime and law, work and business, media and advertising, travel and tourism, cities and housing, government and society, science and research, culture and arts. The topic appears on the card.
- **Distractors.** Each question's four wrong options mix look-alike words (adapt/adopt/adept) with words that share the answer's part of speech and level. Words from a list are tested against other words in the same list, and topic words against the same topic. Options whose meanings overlap the answer's are excluded.
- **Storage.** Everything, including your word lists, is kept in `localStorage` under `leitner:v1`, and the app asks the browser to make that storage persistent. Settings → Your data has export and import (a JSON file).
- **Audio.** Words are pronounced with the browser's built-in `speechSynthesis`. Sound effects are synthesized with Web Audio, so there are no audio files to download.

## Project layout

```
index.html, manifest.webmanifest, sw.js
css/app.css             design tokens, light/dark themes, all motion
js/main.js              boot + routes
js/store.js             localStorage state, export/import
js/leitner.js           boxes, intervals, session building
js/words.js             active words (bank + lists), distractor selection
js/wordlists.js         parsing, CSV export and template for word lists
js/charts.js            box chart and the end-of-session flow animation
js/sfx.js, speech.js    sound effects and pronunciation
js/views/*.js           welcome, home, session, summary, settings, word lists
js/data/words.js        generated word bank (don't edit by hand)
js/data/packs/*.js      generated ready-made lists and their index
tools/fa/*.txt          Farsi meanings: `word=meaning`, `word=-` drops a word
tools/topics.txt        IELTS topic words: `## Topic`, then `word=meaning|pos|level`
tools/packs/<id>/*.txt  ready-made list sources: `word=meaning`
tools/build_words.py    rebuilds js/data/words.js
tools/build_packs.py    rebuilds js/data/packs/
tools/make_icons.py     renders the PNG icons
```

## Editing the word bank

1. Edit the meanings in `tools/fa/*.txt`, or the topic words in `tools/topics.txt`.
2. Run `python tools/build_words.py`. The source lists (Oxford 5000, CMU dict, AVL, frequency list) download into `tools/.cache` on the first run.
3. Change `VERSION` in `sw.js` so installed copies pick up the new data.

Progress is keyed by the English word, so editing a meaning keeps its progress. Removing a word leaves its progress unused but harmless.

## Editing the ready-made lists

1. Edit `tools/packs/<id>/*.txt`, or add a list to `PACKS` in `tools/build_packs.py`.
2. Run `python tools/build_packs.py`, and bump that list's `version` when its words change.
3. Change `VERSION` in `sw.js` so installed copies pick up the new list index. A list's words are fetched only when someone adds it, then kept in their browser.
