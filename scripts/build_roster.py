"""Build the 2026-2027 roster from the PRA student information workbook.
Usage: python scripts/build_roster.py "<path to xlsx>"
Reads the 'REAL STUDENT LIST 26-27' sheet. Re-run whenever the workbook changes.

Writes two files:
  private/roster.json      every student's details, for Students > More > Load roster file.
                           Git-ignored and never part of the website: it holds children's
                           dates of birth, parents' contacts and home addresses.
  src/data/rosterIndex.js  student IDs and one-way name fingerprints only, so invoices
                           know who was on the roster (reduced Quarter 4) without the
                           public site carrying any names."""
import sys, json, re, datetime, os, unicodedata
import openpyxl

SRC = sys.argv[1]
wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb['REAL STUDENT LIST 26-27']

# Year group a student was in during 2025-2026 (from that year's report files) -> +1 for 2026-2027.
# Keyed by nickname (or by full name where two students share a nickname). The table names
# children, so it lives in the git-ignored private/last_year.json rather than in this script.
LAST_YEAR = json.load(open('private/last_year.json', encoding='utf-8')) if os.path.exists('private/last_year.json') else {}
if not LAST_YEAR: print('Note: private/last_year.json not found; year groups come from the workbook only.')
ORDER = ['Nursery','Kindergarten'] + [f'Year {i}' for i in range(1, 13)]
def promote(g):
    if g not in ORDER: return None
    i = ORDER.index(g)
    return ORDER[min(i + 1, len(ORDER) - 1)]

def clean(s):
    if s is None: return ''
    if isinstance(s, float) and s.is_integer(): s = str(int(s))
    return re.sub(r'\s+', ' ', str(s)).strip()

def iso_date(v):
    if v is None: return ''
    if isinstance(v, datetime.datetime): return v.date().isoformat()
    s = clean(v)
    m = re.match(r'^(\d{1,2})[./](\d{1,2})[./](\d{4})$', s)
    if m:
        d, mo, y = map(int, m.groups())
        try: return datetime.date(y, mo, d).isoformat()
        except ValueError: return ''
    return ''

def stage_for(group):
    if group in ('Nursery', 'Kindergarten'): return 'early_years'
    m = re.match(r'Year (\d+)', group or '')
    if not m: return ''
    n = int(m.group(1))
    return 'primary' if n <= 6 else 'lower_secondary' if n <= 9 else 'upper_secondary'

GROUP_ALIAS = {'Kindy': 'Kindergarten', 'High School': 'Secondary'}
rows = list(ws.iter_rows(values_only=True))
header = None
group = None
students = []
for r in rows:
    if r[1] == 'Total' and r[3] == 'Student ID':
        header = list(r); continue
    if header is None: continue
    if r[0] and isinstance(r[0], str) and r[0] not in ('Total',) and not r[0].startswith('Từ') and not r[0].startswith('MÃ') and not r[0].startswith('PAL') and not r[0].startswith('BLE'):
        group = GROUP_ALIAS.get(r[0].strip(), r[0].strip())
        if group == "Don't enroll": group = None
    if not group: continue
    code = clean(r[3]); start = r[4]; name = clean(r[5])
    if not re.match(r'^(PAL|BLE)\s?\d+', code) or not name: continue
    code = code.replace(' ', '')
    program = 'global' if code.startswith('BLE') or 'Global' in (clean(r[18]) if len(r) > 18 else '') else None
    if code.startswith('PAL'): code = 'S' + code[3:]  # PRA student IDs are S0001; BLE codes stay as they are
    nick = clean(r[6]); gender = clean(r[7]).lower(); dob = iso_date(r[8])
    allergies = clean(r[9]); allergies = '' if allergies.lower() in ('no', 'option 2') else allergies
    emails = [e.strip() for e in re.split(r'[,\n ]+', str(r[11] or '')) if '@' in e]
    # Columns: L (11) parents' email, M (12) address, N (13) parents' phone.
    address = clean(r[12]); phone = re.sub(r'\s*\n\s*', ' | ', str(r[13] or '')).strip()
    status = clean(r[16]) if len(r) > 16 else ''
    plan = clean(r[18]) if len(r) > 18 else ''
    program = program or ('vocational' if 'Vocational' in plan else 'regular')
    key = name if name in LAST_YEAR else nick
    last = LAST_YEAR.get(key)
    year_group = promote(last) if last else (group if group in ORDER else '')
    if group in ('Nursery', 'Kindergarten'): year_group = group  # trust the current class list for early years
    if not year_group and group == 'Secondary':
        # estimate from birth year (UK-style: Year 7 at 11-12)
        y = int(dob[:4]) if dob else None
        year_group = f'Year {min(12, 2026 - y - 4)}' if y else ''
    note = ''
    if isinstance(start, str) and 'Trial' in start: note = start.replace('\n', ' ')
    # Year 9 and above are in Upper Secondary from 2026-2027.
    level = year_group if year_group in ORDER[:10] else ('Upper Secondary' if year_group else '')
    students.append({
        'student_code': code,
        'level': level,
        'full_name': name,
        'nickname': nick,
        'gender': 'female' if gender.startswith('f') else 'male' if gender.startswith('m') else '',
        'dob': dob,
        'class_group': group,
        'program': program,
        'start_date': iso_date(start),
        'parents_email': ', '.join(dict.fromkeys(emails)),
        'parent_phone': phone,
        'address': address,
        'allergies': allergies,
        'enrollment_status': status or 'Enrolled',
        'active': True,
        'notes': note,
    })

os.makedirs('private', exist_ok=True)
json.dump(students, open('private/roster.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

# Must match nameHash() in src/lib/pricing.js: FNV-1a (32-bit) over the UTF-8 of
# the NFC, single-spaced, trimmed, lower-case full name, written in base 36.
def name_hash(v):
    h = 0x811c9dc5
    for b in re.sub(r'\s+', ' ', unicodedata.normalize('NFC', v or '')).strip().lower().encode('utf-8'):
        h = ((h ^ b) * 0x01000193) & 0xffffffff
    digits, out = '0123456789abcdefghijklmnopqrstuvwxyz', ''
    while True:
        h, r = divmod(h, 36)
        out = digits[r] + out
        if not h: return out

codes = sorted({s['student_code'].strip().upper() for s in students if s['student_code'].strip()})
hashes = sorted({name_hash(s['full_name']) for s in students})
index = ('// Generated by scripts/build_roster.py from the 2026-2027 student information workbook.\n'
         '// Who was on the 2026-2027 roster, for the reduced Quarter 4 (src/lib/pricing.js): student\n'
         '// IDs and one-way name fingerprints only. The full roster is private/roster.json (git-ignored).\n'
         f'export const ROSTER_CODES = {json.dumps(codes)}\n'
         f'export const ROSTER_NAME_HASHES = {json.dumps(hashes)}\n')
open('src/data/rosterIndex.js', 'w', encoding='utf-8', newline='\n').write(index)
print(len(students), 'students')
for s in students: print(s['student_code'], s['full_name'], '|', s['nickname'], '|', s['level'], '|', s['program'])
