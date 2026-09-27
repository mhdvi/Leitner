// Reading and writing user word lists.
//
// Accepted input is forgiving, because lists come from Excel, Google Sheets, Notes or a keyboard:
// one word per line, then its meaning, separated by a tab, "=", ":", ";" or ",".
// An optional last column in slashes or brackets is taken as phonetics: /ˈwɜːrd/ or [wɜːd].
// Blank lines, lines starting with "#", and a header row ("word, meaning") are ignored.

export const MAX_WORDS = 5000;

const HEADER = /^(word|words|english|term|vocabulary|واژه|کلمه)$/i;
const PHONETIC = /^[/[].*[/\]]$/;

// Splits one line on `sep`, honouring "double quoted" fields as spreadsheets write them.
function splitLine(line, sep) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur.trim() === '') {
      quoted = true;
      cur = '';
    } else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function separatorOf(line) {
  if (line.includes('\t')) return '\t';
  const found = ['=', ':', ';', ','].map((s) => [s, line.indexOf(s)]).filter(([, i]) => i > 0);
  found.sort((a, b) => a[1] - b[1]);
  return found[0]?.[0] || null;
}

// Returns { words: [[word, meaning, ipa]], skipped: [line numbers], duplicates, truncated }.
export function parseList(text) {
  const words = [];
  const skipped = [];
  const seen = new Set();
  let duplicates = 0;
  let firstContent = true;
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const sep = separatorOf(line);
    const parts = sep ? splitLine(line, sep) : [line];
    const word = parts[0];
    if (firstContent) {
      firstContent = false;
      if (HEADER.test(word)) return;
    }
    let rest = parts.slice(1).filter(Boolean);
    let ipa = '';
    if (rest.length > 1 && PHONETIC.test(rest[rest.length - 1])) ipa = rest.pop().slice(1, -1).trim();
    // Extra columns are further meanings, e.g. "abandon, رها کردن, ترک کردن".
    const meaning = rest.join('، ').trim();
    if (!word || !meaning || word.length > 60) {
      skipped.push(i + 1);
      return;
    }
    const key = word.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    words.push(ipa ? [word, meaning, ipa] : [word, meaning]);
  });

  const truncated = words.length > MAX_WORDS;
  return { words: words.slice(0, MAX_WORDS), skipped, duplicates, truncated };
}

// Decodes an uploaded file. Excel on Windows often saves Farsi text as Windows-1256 rather than
// UTF-8; when UTF-8 decoding produces replacement characters, fall back to that encoding.
export async function readTextFile(file) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8;
  try {
    return new TextDecoder('windows-1256').decode(buf);
  } catch {
    return utf8;
  }
}

function csvField(s) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV with a byte-order mark so Excel opens Farsi text correctly.
export function toCSV(words) {
  const rows = [['word', 'meaning', 'phonetics'], ...words.map(([w, fa, ipa = '']) => [w, fa, ipa ? `/${ipa}/` : ''])];
  return '﻿' + rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

export function templateCSV() {
  return toCSV([
    ['ubiquitous', 'همه‌جا حاضر', 'juːˈbɪkwɪtəs'],
    ['mitigate', 'کاهش دادن، تسکین دادن'],
    ['resilient', 'مقاوم، انعطاف‌پذیر'],
  ]);
}

export function downloadText(text, filename, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
