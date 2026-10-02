"""Builds the Assessments library from the PDFs gathered in private/assessments-src:

    cambridge-go/<course>/...   downloads from Cambridge GO (gather_downloads.py)
    drive/...                   the shared drive's Program curricula/*/Tests folders
    pra/<session>/...           PRA's own papers kept off the shared drive's Tests folders, e.g. in
                                pra/Quarter 1, 2026-27/: "Y7 Maths - Assessment - Units 1-3 - Test paper.pdf"
                                (and "- Mark scheme"), "Y7 Maths - Review packet - Units 1-3 - Student copy.pdf"
                                (and "- Answer key")

and writes
    <shared drive>/Program curricula/Assessments Library/<Subject>/Year N/<Type>/...
                                          every paper, mark scheme, insert and audioscript, under
                                          a clear name; only members of the shared drive can open them
    public/assessments/catalog.json       one row per assessment (titles, years, links), for the
                                          Assessments tab; no file content, so it can be public
    private/assessments/review.csv        every source file and what was done with it

    python scripts/assessments/build_catalog.py [--dry-run]

--dry-run writes the catalog and review but copies nothing to the shared drive. Run it again after
adding files: names and slugs stay the same and only new files are copied. Links to the files come
from private/assessments/drive_links.json ({"Maths/Year 5/End of unit/x.pdf": "<Drive file id>"},
read from drive.google.com once Drive has synced); until then the tab opens a Drive search for the
file's name.
"""
import csv
import hashlib
import json
import os
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'private' / 'assessments-src'
OUT = ROOT / 'private' / 'assessments'
PUBLIC = ROOT / 'public' / 'assessments'
DRIVE = Path(os.environ.get('PRA_DRIVE', r'G:\Shared drives\PRA Shared Drive\Program curricula')) / 'Assessments Library'
KIND_FOLDER = {
    'diagnostic': 'Diagnostic', 'end_of_unit': 'End of unit', 'mid_year': 'Mid-year', 'end_of_year': 'End of year',
    'progress_test': 'Progress tests', 'progress_review': 'PRA progress reviews', 'baseline': 'PRA baselines',
    'progression_test': 'Progression tests', 'sample_paper': 'Sample papers', 'checkpoint': 'Checkpoint',
    'review_packet': 'PRA review packets',
}

SUBJECT_NAME = {'math': 'Maths', 'science': 'Science', 'english': 'English'}
GE = 'Cambridge Global English'
EN = 'Cambridge English (first language)'


def course_name(subject, year, english=GE):
    if subject == 'english':
        return english
    level = 'Primary' if year <= 6 else 'Lower Secondary'
    return f"Cambridge {level} {'Mathematics' if subject == 'math' else 'Science'}"


# ---------------------------------------------------------------- Cambridge GO

GO_COURSE = re.compile(r'^(maths|science|english)-(p|ls|ge)(\d)$')


def classify_go(path):
    """One file from Cambridge GO. Returns a dict or a skip reason (str)."""
    folder = path.relative_to(SRC / 'cambridge-go').parts[0]
    m = GO_COURSE.match(folder)
    subject = {'maths': 'math', 'science': 'science', 'english': 'english'}[m.group(1)]
    year = int(m.group(3))
    name = path.stem
    low = name.lower().replace('_', ' ').replace('-', ' ')
    low = re.sub(r'\s+', ' ', low)
    base = dict(subject=subject, years=[year], course=course_name(subject, year), source='Cambridge GO', session=None)
    answers = bool(re.search(r'answer|mark ?scheme|\bms\b', low))
    part = 'mark_scheme' if answers else 'test'

    if 'audioscript' in low:
        return dict(base, kind='progress_test', unit=None, component=None, part='audioscript', attach='audioscript')

    if subject == 'english':
        quiz = 'quiz' in low
        if re.search(r'quiz answers|test answers', low):
            return dict(base, kind='*', unit=None, component=None, part='mark_scheme', attach='fallback')
        u = re.search(r'eou ?(\d+)', low)
        if u:
            return dict(base, kind='end_of_unit', unit=int(u.group(1)), component=None, part='test', quiz=quiz)
        p = re.search(r'prog (?:quiz|test) (\d)(?: (listening|reading|writing))?', low)
        if p:
            comp = p.group(2).title() if p.group(2) else None
            return dict(base, kind='progress_test', unit=int(p.group(1)), component=comp, part='test', quiz=quiz)
        return 'Global English file not recognised'

    # Maths and Science
    if 'diagnostic' in low or 'diag check' in low:
        comp = None
        c = re.search(r'diagnostic(?: test)? (biology|chemistry|earth(?: and space)?|physics)', low)
        if c:
            comp = c.group(1).title().replace('And', 'and')
            comp = 'Earth and space' if comp.startswith('Earth') else comp
        if re.search(r'diagnostic check (sa|tn)$', low):
            comp = {'sa': 'self-assessment', 'tn': 'teacher notes'}[low[-2:]]
            return dict(base, kind='diagnostic', unit=None, component=None, part='extra', label=comp.capitalize())
        if answers and not comp and subject == 'science':
            return dict(base, kind='diagnostic', unit=None, component=None, part='mark_scheme', attach='fallback')
        return dict(base, kind='diagnostic', unit=None, component=comp, part=part)

    if re.search(r'mid (?:point|year)|midpoint', low):
        comp = None
        c = re.search(r'(?:u|test )(\d) ?and ?(\d)', low)
        if c:
            comp = f'Units {c.group(1)} and {c.group(2)}'
        if answers and not comp and subject == 'science':
            return dict(base, kind='mid_year', unit=None, component=None, part='mark_scheme', attach='fallback')
        return dict(base, kind='mid_year', unit=None, component=comp, part=part)

    if re.search(r'end of year|end ?of ?year', low):
        return dict(base, kind='end_of_year', unit=None, component=None, part=part)

    u = re.search(r'(?:end of unit|unit) ?(\d+)(?: end of unit)?(?: test)?|end of unit (?:test )?(\d+)', low)
    if u and ('unit' in low):
        n = int(u.group(1) or u.group(2))
        return dict(base, kind='end_of_unit', unit=n, component=None, part=part)
    if re.search(r'unit test answers|end of unit (?:tests? )?answers|end of unit answers', low):
        return dict(base, kind='end_of_unit', unit=None, component=None, part='mark_scheme', attach='fallback')
    if re.search(r'^(?:s\d|p science \d|ls maths \d) ?test answers$|test answers$', low):
        return dict(base, kind='*', unit=None, component=None, part='mark_scheme', attach='fallback')
    return 'Cambridge GO file not recognised'


# ---------------------------------------------------------------- Cambridge papers on the drive

# Progression tests: <code>_<paper>[_<year>]_[MS_|INS_]...
PROG_CODES = {}
for i, y in enumerate(range(3, 7)):
    PROG_CODES[3119 + i] = ('english', y, GE)
    PROG_CODES[3123 + i] = ('english', y, EN)
    PROG_CODES[3127 + i] = ('math', y, None)
    PROG_CODES[3131 + i] = ('science', y, None)
for i, y in enumerate(range(7, 10)):
    PROG_CODES[3135 + i] = ('english', y, GE)
    PROG_CODES[3138 + i] = ('english', y, EN)
    PROG_CODES[3141 + i] = ('math', y, None)
    PROG_CODES[3144 + i] = ('science', y, None)
# Checkpoint: Primary (taken in Year 6) and Lower Secondary (taken in Year 9)
CHECKPOINT_CODES = {'0058': ('english', 6, EN), '0057': ('english', 6, GE), '0096': ('math', 6, None), '0097': ('science', 6, None),
                    '0861': ('english', 9, EN), '0876': ('english', 9, GE), '0862': ('math', 9, None), '0893': ('science', 9, None)}
CODED = re.compile(r'^(?:(\d\d)_)?(\d{4})_(\d\d)(?:_(\d{4}))?_(?:(MS|INS)_)?')


def tcm_session(name, checkpoint):
    m = re.search(r'tcm14[23]-(\d{6})', name)
    n = int(m.group(1)) if m else 0
    if checkpoint:
        if 686000 <= n < 690000:
            return 'April 2023'
        if 700000 <= n < 702000:
            return 'October 2023'
        if 712000 <= n < 713000:
            return 'April 2024'
        return None
    if 660000 <= n < 680000:
        return '2023'
    if 695000 <= n < 705000:
        return '2024'
    if 720000 <= n < 730000:
        return '2025'
    return None


def front_text(path):
    try:
        with fitz.open(path) as d:
            return ' '.join(d[0].get_text().split()) if len(d) else ''
    except Exception:
        return ''


def classify_coded(path, m):
    code, paper, year_in_name, kind_flag = m.group(2), int(m.group(3)), m.group(4), m.group(5)
    part = {'MS': 'mark_scheme', 'INS': 'insert'}.get(kind_flag, 'test')
    name = path.name
    if code in CHECKPOINT_CODES:
        subject, year, english = CHECKPOINT_CODES[code]
        session = tcm_session(name, True)
        kind = 'checkpoint'
    elif int(code) in PROG_CODES:
        subject, year, english = PROG_CODES[int(code)]
        session = year_in_name or tcm_session(name, False)
        kind = 'progression_test'
    else:
        return f'unknown Cambridge code {code}'
    # The front page names the paper: "Stage 3 Paper 2 Listening 2023".
    comp = None
    if part == 'test':
        t = front_text(path)
        # Some mark schemes were saved without _MS_ in the name; their front page says so.
        if re.search(r'mark scheme', t[:400], re.I):
            part = 'mark_scheme'
    if part == 'test':
        c = re.search(r'Paper ' + str(paper) + r'\s+(.{3,40}?)\s+(?:20\d\d|October|May|April|\d+ (?:hour|minutes))', t)
        if c and not re.match(r'^(?:20\d\d|\d|January|February|March|April|May|June|July|August|September|October|November|December)\b', c.group(1)):
            comp = c.group(1).strip(' –-')
        if not session:
            s = re.search(r'© UCLES (20\d\d)', t)
            session = s.group(1) if s else None
    course = course_name(subject, year, english or GE)
    return dict(subject=subject, years=[year], course=course, source='Shared drive', kind=kind, unit=None, paper=paper,
                session=session, component=comp, part=part, code=code)


SAMPLE = re.compile(r'(Mathematics|Maths|Science|English as a Second Language|English|E2L)[ _]Stage ?(\d)', re.I)


def classify_sample(path):
    name = path.name
    m = SAMPLE.search(name)
    if not m:
        return None
    word = m.group(1).lower()
    subject = 'math' if word.startswith('math') else 'science' if word == 'science' else 'english'
    english = GE if word in ('english as a second language', 'e2l') else EN
    year = int(m.group(2))
    p = re.search(r'Sample Paper (\d)|_0(\d)_', name)
    paper = int(p.group(1) or p.group(2)) if p else None
    part = 'mark_scheme' if re.search(r'Mark ?scheme|_MS_', name, re.I) else 'insert' if 'Insert' in name else 'test'
    return dict(subject=subject, years=[year], course=course_name(subject, year, english), source='Shared drive',
                kind='sample_paper', unit=None, paper=paper, session='Specimen', component=None, part=part)


# ---------------------------------------------------------------- PRA's own papers on the drive

CONTEXTS = [
    (r'2025 Semester 1 Assessments|Semester 1 Assessments 2025', 'Semester 1, 2025-26'),
    (r'Semester 1 Progress Reviews', 'Semester 1, 2024-25'),
    (r'2026 End of Year Progress Checks', 'End of year, 2025-26'),
    (r'End of Year Exams|End of Year Assessments 2024', 'End of year, 2024-25'),
    (r'Baselines 2024', 'Baseline, 2024-25'),
]
SKIP = [
    (r'End of Series Report', 'Checkpoint examiner report, not a paper'),
    (r'Teacher Guide|Guidance on writing', 'teacher guide, not a paper'),
    (r'Periodic Table', 'data sheet, not a paper'),
    (r'Intro to Business', 'not Maths, Science or English'),
]


def context_of(rel):
    for pat, label in CONTEXTS:
        if re.search(pat, rel):
            return label
    return None


def years_in(text):
    """Year numbers named in a file or folder name: 'Year 5', 'Y4', 'G5', 'Grade 3', 'PRAY8', 'Year 5-6', 'Year 3_4'."""
    m = re.search(r'(?:Year|Grade|Gr|PRAY|\bY|\bG|Stage|Science)\s?_?(\d)(?:\s?[-_&]\s?(\d))?(?!\d)', text, re.I)
    if not m:
        return []
    a = int(m.group(1))
    b = int(m.group(2)) if m.group(2) else a
    return list(range(a, b + 1)) if 1 <= a <= b <= 9 else [a] if 1 <= a <= 9 else []


def subject_in(text):
    t = text.lower()
    if re.search(r'math', t):
        return 'math'
    if re.search(r'science|\bgs\b', t):
        return 'science'
    if re.search(r'english|\bge\b|\besl\b|reading|writing|listening|ruoe', t):
        return 'english'
    return None


def classify_pra(path, rel, session):
    name = path.stem
    folders = rel.rsplit('/', 1)[0]
    years = years_in(name) or years_in(folders.split('/')[-1]) or years_in(folders)
    subject = subject_in(name) or subject_in(folders)
    if not years or not subject:
        return f'year or subject not clear (years {years}, subject {subject})'
    low = name.lower()
    if re.search(r'questions? (?:&|and) answers', low):
        part = 'test'
        label = 'Questions and answers'
    elif re.search(r'mark ?sch|markscheme|\bms\b|answers', low):
        part, label = 'mark_scheme', None
    elif 'insert' in low:
        part, label = 'insert', None
    else:
        part, label = 'test', None
    comp = None
    if subject == 'english':
        if re.search(r'ruoe|reading and usage|reading and use', low):
            comp = 'Reading and use of English'
        elif re.search(r'reading.?writing', low):
            comp = 'Reading and writing'
        else:
            for w in ('Listening', 'Writing', 'Reading'):
                if w.lower() in low:
                    comp = w
                    break
    p = re.search(r'paper (\d)', low)
    if p and subject != 'english':
        comp = f'Paper {p.group(1)}'
    kind = 'baseline' if session.startswith('Baseline') else 'progress_review'
    return dict(subject=subject, years=years, course=None, source='Shared drive', kind=kind, unit=None, paper=None,
                session=session, component=comp, part=part, label=label)


def classify_drive(path):
    rel = path.relative_to(SRC / 'drive').as_posix()
    name = path.name
    for pat, why in SKIP:
        if re.search(pat, rel):
            return why
    session = context_of(rel)
    m = CODED.match(name)
    if m:
        r = classify_coded(path, m)
        if isinstance(r, dict):
            # First-language English papers are only kept where PRA used them.
            if r['course'] == EN and not session and r['kind'] != 'checkpoint':
                return 'Cambridge English (first language) paper, not used by PRA'
            r['used'] = session
        return r
    if name.startswith('0057 English as a Second Language'):
        part = 'mark_scheme' if 'Mark Scheme' in name else 'test'
        return dict(subject='english', years=[6], course=GE, source='Shared drive', kind='progression_test', unit=None,
                    paper=2, session='2025', component=None, part=part, used=session)
    s = classify_sample(path)
    if s:
        if s['course'] == EN and not session:
            return 'Cambridge English (first language) sample paper, not used by PRA'
        s['used'] = session
        return s
    # Unit tests teachers saved from Cambridge GO ("Y5 Maths Unit 3.pdf")
    u = re.match(r'Y(\d) (Maths|Science) Unit (\d+)$', path.stem)
    if u:
        subject = 'math' if u.group(2) == 'Maths' else 'science'
        year = int(u.group(1))
        return dict(subject=subject, years=[year], course=course_name(subject, year), source='Shared drive', kind='end_of_unit',
                    unit=int(u.group(3)), paper=None, session=None, component=None, part='test', drive_copy=True)
    if re.search(r'GE_\d_test_answers', name):
        return 'copy of the Cambridge GO answers'
    if not session:
        return 'not in an assessment folder and not a Cambridge paper'
    return classify_pra(path, rel, session)


# ---------------------------------------------------------------- PRA's own papers (pra/)

PRA_OWN = re.compile(r'^Y(\d)(?:-(\d))? (Maths|Science|English) - (Assessment|Review packet)(?: - Units? (\d+)(?:-(\d+))?)?'
                     r' - (Test paper|Mark scheme|Student copy|Answer key)$')


def classify_pra_own(path):
    """A paper a PRA teacher wrote, filed by session (the folder name). An assessment is a progress
    review (the Year 7 Quarter 1 assessments, from Desktop/Y7Tests/<Subject>/Q1-Assessment); a review
    packet is the practice that goes home before it (lessons repo, homework/q1rev and q1sci)."""
    m = PRA_OWN.match(path.stem)
    if not m:
        return 'PRA paper name not recognised (see the docstring at the top)'
    a, b = int(m.group(1)), int(m.group(2) or m.group(1))
    subject = {'Maths': 'math', 'Science': 'science', 'English': 'english'}[m.group(3)]
    packet = m.group(4) == 'Review packet'
    comp = None
    if m.group(5):
        u1, u2 = int(m.group(5)), int(m.group(6) or m.group(5))
        comp = f'Unit {u1}' if u1 == u2 else f'Units {u1} and {u2}' if u2 == u1 + 1 else f'Units {u1}–{u2}'
    answers = m.group(7) in ('Mark scheme', 'Answer key')
    return dict(subject=subject, years=list(range(a, b + 1)), course=None, source='PRA',
                kind='review_packet' if packet else 'progress_review', unit=None, paper=None, session=path.parent.name,
                component=comp, part='mark_scheme' if answers else 'test', label=m.group(7) if packet else None)


# ---------------------------------------------------------------- titles and grouping

KIND_ORDER = ['diagnostic', 'end_of_unit', 'mid_year', 'end_of_year', 'progress_test', 'progress_review', 'baseline',
              'progression_test', 'sample_paper', 'checkpoint', 'review_packet']
PART_ORDER = {'test': 0, 'insert': 1, 'audioscript': 2, 'extra': 3, 'mark_scheme': 4}
PART_LABEL = {'test': 'Test paper', 'insert': 'Insert', 'audioscript': 'Audioscript', 'mark_scheme': 'Mark scheme', 'extra': 'Extra'}


def title_of(r):
    k, comp = r['kind'], r.get('component')
    if k == 'diagnostic':
        t = 'Diagnostic check' if r['subject'] == 'math' else 'Diagnostic test'
    elif k == 'end_of_unit':
        t = f"End-of-unit {'quiz' if r.get('quiz') else 'test'} {r['unit']}"
    elif k == 'mid_year':
        t = 'Mid-year test'
    elif k == 'end_of_year':
        t = 'End-of-year test'
    elif k == 'progress_test':
        t = f"Progress {'quiz' if r.get('quiz') else 'test'} {r['unit']}"
    elif k == 'progression_test':
        t = f"Progression test {r['session'] or ''}".strip() + (f" · Paper {r['paper']}" if r.get('paper') else '')
    elif k == 'sample_paper':
        t = f"Sample paper {r['paper']}" if r.get('paper') else 'Sample paper'
    elif k == 'checkpoint':
        t = f"Checkpoint {r['session'] or ''}".strip() + (f" · Paper {r['paper']}" if r.get('paper') else '')
    elif k == 'baseline':
        t = 'Baseline test'
    elif k == 'review_packet':
        t = f"{r['session'].split(',')[0]} review packet"
    elif r['session'].startswith('Quarter'):
        t = f"{r['session'].split(',')[0]} assessment"
    else:
        t = 'End-of-year progress review' if r['session'].startswith('End of year') else 'Semester 1 progress review'
    return f'{t} · {comp}' if comp else t


def group_key(r):
    # A Cambridge paper's section ("Listening") is read from the test's front page only, so its
    # mark scheme and insert are matched on code, paper and session alone.
    comp = '' if r.get('code') else (r.get('component') or '')
    return (r['subject'], tuple(r['years']), r.get('course') or '', r['kind'], r.get('unit'), r.get('paper'),
            r.get('session') or '', comp, bool(r.get('quiz')))


def slug_of(r):
    bits = [r['subject'], 'y' + '-'.join(map(str, r['years'])), r['kind'].replace('_', '-')]
    if r.get('course') == EN:
        bits.append('en')
    for k in ('session', 'paper', 'unit', 'component'):
        v = r.get(k)
        if v not in (None, ''):
            bits.append(str(v))
    if r.get('quiz'):
        bits.append('quiz')
    return re.sub(r'[^a-z0-9]+', '-', '-'.join(bits).lower()).strip('-')


def sha(path):
    h = hashlib.sha1()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def safe_name(text):
    return re.sub(r'\s+', ' ', re.sub(r'[<>:"/\\|?*·]+', '-', text)).strip(' -.')


def page_count(path):
    try:
        with fitz.open(path) as d:
            return len(d)
    except Exception:
        return None


def main():
    dry = '--dry-run' in sys.argv
    PUBLIC.mkdir(parents=True, exist_ok=True)
    links_path = OUT / 'drive_links.json'
    links = json.loads(links_path.read_text(encoding='utf-8')) if links_path.exists() else {}
    review = []
    items = []  # (path, rel, hash, classification)
    tops = [a for a in ('cambridge-go', 'drive', 'pra') if '--only' not in sys.argv or a in sys.argv]
    classify = {'cambridge-go': classify_go, 'drive': classify_drive, 'pra': classify_pra_own}
    for top in tops:
        for path in sorted((SRC / top).rglob('*')):
            if path.suffix.lower() != '.pdf' or not path.is_file():
                continue
            rel = path.relative_to(SRC).as_posix()
            r = classify[top](path)
            h = sha(path)
            if isinstance(r, str):
                review.append([rel, 'skipped', r, '', h[:12]])
                continue
            items.append((path, rel, h, r))

    # The same PDF can sit in several folders; keep one, preferring Cambridge GO, then the tidiest name.
    by_hash = defaultdict(list)
    for it in items:
        by_hash[it[2]].append(it)
    chosen = []
    for h, its in by_hash.items():
        its.sort(key=lambda it: (it[3]['source'] != 'Cambridge GO', it[3].get('used') is not None, '(' in it[0].name, 'Copy of' in it[0].name, len(it[1])))
        keep = its[0]
        used = sorted({it[3].get('used') for it in its if it[3].get('used')})
        keep[3]['used_in'] = used
        chosen.append(keep)
        for it in its[1:]:
            review.append([it[1], 'duplicate', f'same file as {keep[1]}', '', h[:12]])

    # Unit tests teachers copied from Cambridge GO are only kept when GO has no such test.
    go_units = {(it[3]['subject'], it[3]['years'][0], it[3]['unit']) for it in chosen
                if it[3]['source'] == 'Cambridge GO' and it[3]['kind'] == 'end_of_unit' and it[3]['part'] == 'test'}
    kept = []
    for it in chosen:
        r = it[3]
        if r.get('drive_copy') and (r['subject'], r['years'][0], r['unit']) in go_units:
            review.append([it[1], 'duplicate', 'a copy of the Cambridge GO unit test (Cambridge GO version kept)', '', it[2][:12]])
            continue
        kept.append(it)

    # Group the files into assessments.
    groups = {}
    fallbacks = []
    for it in kept:
        path, rel, h, r = it
        if r.get('attach'):
            fallbacks.append(it)
            continue
        key = group_key(r)
        g = groups.setdefault(key, dict(r, files=[]))
        g['used_in'] = sorted(set(g.get('used_in', [])) | set(r.get('used_in', [])))
        if r.get('component') and not g.get('component'):
            g['component'] = r['component']
        g['files'].append((it, r['part'], r.get('label')))

    # Answers for a whole set (all unit tests, or a whole book) and audioscripts go to every
    # assessment of that course and kind that has no mark scheme of its own.
    for it in fallbacks:
        path, rel, h, r = it
        targets = [g for g in groups.values() if g['source'] == 'Cambridge GO' and g['course'] == r['course'] and g['years'] == r['years']
                   and (r['kind'] == '*' or g['kind'] == r['kind'])]
        if r['attach'] == 'audioscript':
            # Listening is in progress test 3 (or the listening part of it).
            t3 = [g for g in targets if g['kind'] == 'progress_test' and g.get('unit') == 3 and g.get('component') in (None, 'Listening')]
            targets = t3 or [g for g in targets if g['kind'] == 'progress_test']
        else:
            targets = [g for g in targets if not any(p == 'mark_scheme' for _, p, _ in g['files'])]
        if not targets:
            review.append([rel, 'skipped', 'set answers with nothing left to attach to', '', h[:12]])
            continue
        for g in targets:
            g['files'].append((it, r['part'], r.get('label')))

    # Every file gets one place on the shared drive. A file used by one assessment is named after it;
    # a set of answers shared by several keeps its own (cleaned) name.
    users = defaultdict(list)
    for g in groups.values():
        for (path, rel, h, r), part, label in g['files']:
            if g not in users[h]:
                users[h].append((g, part, label))
    drive_name = {}
    taken = set()
    for h, us in users.items():
        g, part, label = us[0]
        ys = '-'.join(map(str, g['years']))
        folder = f"{SUBJECT_NAME[g['subject']]}/Year {g['years'][0]}/{KIND_FOLDER[g['kind']]}"
        if len(us) == 1:
            title = title_of(g)
            if g['kind'] in ('progress_review', 'baseline'):
                title = f"{g['session']} - {title}"
            elif g['kind'] == 'review_packet':
                title = f"{g['session']} - Review packet" + (f" - {g['component']}" if g.get('component') else '')
            name = f"Y{ys} {SUBJECT_NAME[g['subject']]} - {title} - {label or PART_LABEL[part]}"
        else:
            src = next(it for it, _, _ in g['files'] if it[2] == h)[0]
            name = f"Y{ys} {SUBJECT_NAME[g['subject']]} - " + re.sub(r'_tcm\d+-\d+|\s*\(\d\)', '', src.stem).replace('_', ' ')
        rel = f'{folder}/{safe_name(name)}.pdf'
        if rel.lower() in taken:
            rel = f'{folder}/{safe_name(name)} ({h[:6]}).pdf'
        taken.add(rel.lower())
        drive_name[h] = rel

    copied = 0
    pages_of = {}
    rows = []
    for g in groups.values():
        files = []
        seen = set()
        counts = defaultdict(int)
        for (path, rel, h, r), part, label in sorted(g['files'], key=lambda f: (PART_ORDER[f[1]], f[0][1])):
            if h in seen:
                continue
            seen.add(h)
            counts[part] += 1
            if h not in pages_of:
                pages_of[h] = page_count(path)
                out = DRIVE / drive_name[h]
                if not dry and not out.exists():
                    out.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(path, out)
                    copied += 1
            f = dict(part=part, label=label or PART_LABEL[part], pages=pages_of[h], size=path.stat().st_size, drive=drive_name[h])
            if links.get(drive_name[h]):
                f['id'] = links[drive_name[h]]
            files.append(f)
            review.append([rel, 'kept', title_of(g), slug_of(g), h[:12]])
        # Several files with the same label (PRA papers saved twice with changes): number them.
        same = defaultdict(int)
        for f in files:
            same[f['label']] += 1
        seen_label = defaultdict(int)
        for f in files:
            if same[f['label']] > 1:
                seen_label[f['label']] += 1
                f['label'] = f"{f['label']} ({seen_label[f['label']]})"
        note = None
        if g.get('used_in') and g['kind'] in ('progression_test', 'sample_paper', 'checkpoint'):
            note = 'PRA used this for: ' + '; '.join(g['used_in'])
        row = dict(
            slug=slug_of(g), title=title_of(g), years=g['years'], subject=g['subject'], course=g.get('course'),
            kind=g['kind'], unit=g.get('unit'), paper=g.get('paper'), session=g.get('session'), source=g['source'],
            files=files, note=note, sort=KIND_ORDER.index(g['kind']) * 1000 + (g.get('unit') or g.get('paper') or 0),
        )
        rows.append({k: v for k, v in row.items() if v not in (None, '')})

    # Slugs must be unique; two groups can only collide on odd PRA names, so number them.
    seen = defaultdict(int)
    for r in sorted(rows, key=lambda r: r['slug']):
        seen[r['slug']] += 1
        if seen[r['slug']] > 1:
            r['slug'] += f"-{seen[r['slug']]}"
    rows.sort(key=lambda r: (r['subject'], r['years'][0], r['sort'], r.get('session', ''), r['title']))
    for r in rows:
        del r['sort']

    catalog = dict(version=1, built=__import__('datetime').date.today().isoformat(),
                   folder='Program curricula/Assessments Library', items=rows)
    (PUBLIC / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    missing = sum(1 for n in drive_name.values() if not links.get(n))
    with open(OUT / 'review.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['source file', 'decision', 'reason / title', 'slug', 'hash'])
        w.writerows(sorted(review))
    print(f'{len(rows)} assessments, {len(drive_name)} files on the shared drive ({copied} copied now'
          f'{", dry run" if dry else ""}); {missing} without a Drive link yet; '
          f'skipped {sum(1 for r in review if r[1] == "skipped")}, duplicates {sum(1 for r in review if r[1] == "duplicate")}')

if __name__ == '__main__':
    sys.exit(main())
