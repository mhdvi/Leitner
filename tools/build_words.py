"""Builds js/data/words.js from the Farsi translation files in tools/fa/.

Sources (downloaded into tools/.cache on first run):
  - Oxford 5000 word list with CEFR levels and UK/US IPA
  - CMU Pronouncing Dictionary (IPA fallback for academic words)
  - Academic Vocabulary List (part-of-speech hints for academic words)
  - OpenSubtitles frequency list (ordering new words by frequency)

Usage:  python tools/build_words.py
"""
import csv, glob, json, os, re, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(ROOT, '.cache')
OUT = os.path.join(ROOT, '..', 'js', 'data', 'words.js')

SOURCES = {
    'ox5000.csv': 'https://raw.githubusercontent.com/winterdl/oxford-5000-vocabulary-audio-definition/main/data/oxford_5000.csv',
    'cmudict.dict': 'https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict',
    'AVL.json': 'https://raw.githubusercontent.com/lpmi-13/machine_readable_wordlists/master/Academic/AVL/AVL.json',
    'en_50k.txt': 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
}

POS_ABBR = {'noun': 'n', 'verb': 'v', 'adjective': 'adj', 'adverb': 'adv', 'preposition': 'prep',
            'conjunction': 'conj', 'exclamation': 'excl', 'pronoun': 'pron', 'determiner': 'det',
            'number': 'num', 'ordinal number': 'num', 'modal verb': 'v', 'linking verb': 'v',
            'auxiliary verb': 'v', 'infinitive marker': 'prep'}
AVL_POS = {'n': 'n', 'v': 'v', 'j': 'adj', 'r': 'adv'}
LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'ac']

ARPA = {'AA': 'ɑː', 'AE': 'æ', 'AO': 'ɔː', 'AW': 'aʊ', 'AY': 'aɪ', 'EH': 'e', 'EY': 'eɪ', 'IH': 'ɪ',
        'IY': 'iː', 'OW': 'oʊ', 'OY': 'ɔɪ', 'UH': 'ʊ', 'UW': 'uː', 'B': 'b', 'CH': 'tʃ', 'D': 'd',
        'DH': 'ð', 'F': 'f', 'G': 'ɡ', 'HH': 'h', 'JH': 'dʒ', 'K': 'k', 'L': 'l', 'M': 'm', 'N': 'n',
        'NG': 'ŋ', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'ʃ', 'T': 't', 'TH': 'θ', 'V': 'v', 'W': 'w',
        'Y': 'j', 'Z': 'z', 'ZH': 'ʒ'}
ONSETS = {'pl', 'pr', 'bl', 'br', 'tr', 'dr', 'kl', 'kr', 'ɡl', 'ɡr', 'fl', 'fr', 'θr', 'ʃr', 'sp', 'st',
          'sk', 'sm', 'sn', 'sl', 'sw', 'tw', 'kw', 'dw', 'spl', 'spr', 'str', 'skr', 'skw', 'pj', 'bj',
          'kj', 'fj', 'mj', 'vj', 'hj'}


def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print('downloading', name)
        urllib.request.urlretrieve(SOURCES[name], path)
    return path


def arpa_to_ipa(phones):
    """Convert CMU ARPAbet phones to IPA with stress marks placed at the syllable onset."""
    segs = []  # (ipa, is_vowel, stress)
    for p in phones:
        m = re.match(r'([A-Z]+)(\d)?$', p)
        base, stress = m.group(1), m.group(2)
        if stress is None:
            segs.append([ARPA[base], False, None])
            continue
        if base == 'AH':
            ipa = 'ə' if stress == '0' else 'ʌ'
        elif base == 'ER':
            ipa = 'ər' if stress == '0' else 'ɜːr'
        elif base == 'IY' and stress == '0':
            ipa = 'i'
        elif base == 'UW' and stress == '0':
            ipa = 'u'
        else:
            ipa = ARPA[base]
        segs.append([ipa, True, stress])
    vowels = [i for i, s in enumerate(segs) if s[1]]
    marks = {}
    for n, vi in enumerate(vowels):
        stress = segs[vi][2]
        if stress not in ('1', '2') or (stress == '2' and len(vowels) < 2):
            continue
        if n == 0:
            start = 0
        else:
            prev = vowels[n - 1]
            cons = [segs[i][0] for i in range(prev + 1, vi)]
            k = 0
            for take in range(len(cons), 0, -1):
                cluster = ''.join(cons[-take:])
                if take == 1 or cluster in ONSETS:
                    k = take
                    break
            start = vi - k
        marks[start] = 'ˈ' if stress == '1' else 'ˌ'
    if len(vowels) == 1:
        marks = {}
    return ''.join(marks.get(i, '') + s[0] for i, s in enumerate(segs))


def read_topics():
    """tools/topics.txt: "## Topic" headings, then lines "word=meaning|pos|level"."""
    topics, current = {}, None
    for n, line in enumerate(open(os.path.join(ROOT, 'topics.txt'), encoding='utf-8'), 1):
        line = line.strip()
        if not line or (line.startswith('#') and not line.startswith('##')):
            continue
        if line.startswith('##'):
            current = line[2:].strip()
            continue
        w, _, rest = line.partition('=')
        fa, pos, lvl = (rest.split('|') + ['', '', ''])[:3]
        if not current or not fa or lvl not in LEVELS:
            raise SystemExit(f'topics.txt line {n}: expected "word=meaning|pos|level" under a "## Topic"')
        topics.setdefault(w.strip(), (current, fa.strip(), pos.strip(), lvl))
    return topics


def guess_pos(w):
    if re.search(r'(tion|sion|ment|ness|ity|ism|ance|ence|ship|hood|ist|er|or|ogy|age|ure)$', w):
        return 'n'
    if re.search(r'(ly)$', w):
        return 'adv'
    if re.search(r'(ive|al|ous|ic|able|ible|ful|less|ary|ent|ant)$', w):
        return 'adj'
    if re.search(r'(ize|ise|ate|ify|en)$', w):
        return 'v'
    return ''


def main():
    translations = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'fa', '*.txt'))):
        for line in open(f, encoding='utf-8'):
            line = line.strip()
            if not line:
                continue
            w, _, fa = line.partition('=')
            if fa != '-':
                translations[w] = fa

    oxford = {}
    ox_ipa = {}  # every Oxford entry's phonetics, for topic words that are not in the bank yet
    for row in csv.DictReader(open(fetch('ox5000.csv'), encoding='utf-8')):
        w = row['word'].strip()
        ox_ipa.setdefault(w, (row['phon_n_am'].strip('/'), row['phon_br'].strip('/')))
        if w not in translations or not row['type']:
            continue
        e = oxford.setdefault(w, {'pos': [], 'lvl': row['cefr'],
                                  'us': row['phon_n_am'].strip('/'), 'uk': row['phon_br'].strip('/')})
        p = POS_ABBR.get(row['type'], row['type'])
        if p not in e['pos']:
            e['pos'].append(p)
        e['lvl'] = min(e['lvl'], row['cefr'])

    cmu = {}
    for line in open(fetch('cmudict.dict'), encoding='utf-8'):
        parts = line.split('#')[0].split()
        if parts and '(' not in parts[0]:
            cmu[parts[0]] = parts[1:]

    avl = {}
    for band in json.load(open(fetch('AVL.json'), encoding='utf-8')).values():
        for w, v in band.items():
            if v['POS'] in AVL_POS:
                avl.setdefault(w, AVL_POS[v['POS']])

    freq = {}
    for i, line in enumerate(open(fetch('en_50k.txt'), encoding='utf-8')):
        freq.setdefault(line.split()[0], i)

    words = []
    for w, fa in translations.items():
        if w in oxford:
            e = oxford[w]
            us, uk = e['us'], e['uk']
            words.append([w, fa, us, '' if uk == us else uk, '/'.join(e['pos']), e['lvl']])
        else:
            if w not in cmu:
                raise SystemExit(f'no pronunciation for {w}')
            words.append([w, fa, arpa_to_ipa(cmu[w]), '', avl.get(w) or guess_pos(w), 'ac'])

    # IELTS topics: tag bank words with their topic, and add the ones the bank doesn't have.
    topics = read_topics()
    index = {r[0]: r for r in words}
    added = 0
    no_ipa = []
    for w, (topic, fa, pos, lvl) in topics.items():
        if w in index:
            if len(index[w]) == 6:
                index[w].append(topic)
            continue
        if w in ox_ipa:
            us, uk = ox_ipa[w]
        else:
            parts = [cmu.get(p.lower()) for p in re.split(r'[ -]', w) if p]
            if all(parts):
                us, uk = ' '.join(arpa_to_ipa(p) for p in parts), ''
            else:
                us, uk = '', ''  # shown without phonetics
                no_ipa.append(w)
        row = [w, fa, us, '' if uk == us else uk, pos, lvl, topic]
        words.append(row)
        index[w] = row
        added += 1
    for r in words:
        if len(r) == 6:
            r.append('')
    print(f'topics: {len(topics)} entries, {added} new words, {len(topics) - added} bank words tagged')
    if no_ipa:
        print('  without phonetics:', ', '.join(no_ipa))

    # Abbreviations (IT, ID, TV) would borrow the frequency of unrelated lowercase words.
    # Multi-word topic phrases take the frequency of their rarest word.
    def rank(w):
        if w.isupper():
            return 20000
        return max(freq.get(p.lower(), 99999) for p in re.split(r'[ -]', w) if p)
    words.sort(key=lambda r: (LEVELS.index(r[5]), rank(r[0]), r[0]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// Generated by tools/build_words.py. Do not edit by hand.\n')
        f.write('// [word, farsi, ipa (US), ipa (UK, empty when same as US), part of speech, level, IELTS topic]\n')
        f.write('export default [\n')
        for r in words:
            f.write(json.dumps(r, ensure_ascii=False, separators=(',', ':')) + ',\n')
        f.write('];\n')
    counts = {l: sum(1 for r in words if r[5] == l) for l in LEVELS}
    print(f'{len(words)} words written to {os.path.relpath(OUT)}', counts)


if __name__ == '__main__':
    main()
