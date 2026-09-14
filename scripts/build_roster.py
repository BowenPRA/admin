"""Build src/data/roster.js from the PRA student information workbook.
Usage: python scripts/build_roster.py "<path to xlsx>"
Reads the 'REAL STUDENT LIST 26-27' sheet. Re-run whenever the workbook changes."""
import sys, json, re, datetime
import openpyxl

SRC = sys.argv[1]
wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb['REAL STUDENT LIST 26-27']

# Year group a student was in during 2025-2026 (from that year's report files) -> +1 for 2026-2027.
LAST_YEAR = {
  'Amada':'Year 6','Minh':'Year 6','Arthur':'Year 6','Lily':'Year 6','Noa':'Year 6','Leo':'Year 6','Timmy':'Year 6',
  'Erica':'Year 6','Nấm':'Year 6','Tăng Di':'Year 6','Carrot':'Year 6','Ana':'Year 6','Su':'Year 6','Penelope':'Year 6','Hunter':'Year 6',
  'Angelo':'Year 8','Kim Long':'Year 8','Meelo':'Year 8','Kun':'Year 8','Chris':'Year 8','Jackson':'Year 8','Gia Bảo':'Year 8','Vy':'Year 8','Minh Vũ':'Year 8','Khoi':'Year 8',
  'Louis Minh Huy Gowman':'Year 9','Bum':'Year 9','Bao Long':'Year 9','Hoang Mai':'Year 9',
  'Bo':'Year 4','Marceau':'Year 4','Margot':'Year 4','Maxwell':'Year 4','Selena':'Year 4','Bơ':'Year 4','Gene':'Year 4','Oliver':'Year 4','Neta':'Year 4',
  'Goku':'Year 5','Tôm':'Year 5',
  'Đom Đóm':'Year 1','Matvei':'Year 1','Bob':'Year 2','Chom chom':'Year 2','Star':'Year 2','Búng':'Year 2',
  'Bống':'Kindergarten','Chíp':'Kindergarten','Gin':'Kindergarten','Helios':'Kindergarten','Coffee':'Kindergarten','Dâu Tây':'Kindergarten','Mía':'Kindergarten','Mít':'Kindergarten','Chít':'Kindergarten','Sunny':'Kindergarten',
  'Louis':'Nursery','Abel':'Nursery','An Điền':'Nursery','Gia Linh':'Nursery','Quang Minh':'Nursery','Mei':'Nursery','River':'Nursery','Sophia':'Nursery',
}
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
    nick = clean(r[6]); gender = clean(r[7]).lower(); dob = iso_date(r[8])
    allergies = clean(r[9]); allergies = '' if allergies.lower() in ('no', 'option 2') else allergies
    emails = [e.strip() for e in re.split(r'[,\n ]+', str(r[11] or '')) if '@' in e]
    address = clean(r[11]); phone = re.sub(r'\s*\n\s*', ' | ', str(r[12] or '')).strip()
    status = clean(r[16]) if len(r) > 16 else ''
    plan = clean(r[18]) if len(r) > 18 else ''
    program = 'global' if code.startswith('BLE') or 'Global' in plan else 'vocational' if 'Vocational' in plan else 'regular'
    key = 'Louis Minh Huy Gowman' if name == 'Louis Minh Huy Gowman' else nick
    last = LAST_YEAR.get(key)
    year_group = promote(last) if last else (group if group in ORDER else '')
    if group in ('Nursery', 'Kindergarten'): year_group = group  # trust the current class list for early years
    if not year_group and group == 'Secondary':
        # estimate from birth year (UK-style: Year 7 at 11-12)
        y = int(dob[:4]) if dob else None
        year_group = f'Year {min(12, 2026 - y - 4)}' if y else ''
    note = ''
    if isinstance(start, str) and 'Trial' in start: note = start.replace('\n', ' ')
    level = year_group if year_group in ORDER[:11] else ('Upper Secondary' if year_group else '')
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

out = '// Generated by scripts/build_roster.py from the 2026-2027 student information workbook.\n// Students > Load 2026-2027 roster adds the ones that are missing (matched by student code or name).\nexport const ROSTER = ' + json.dumps(students, ensure_ascii=False, indent=2) + '\n'
open('src/data/roster.js', 'w', encoding='utf-8').write(out)
print(len(students), 'students')
for s in students: print(s['student_code'], s['full_name'], '|', s['nickname'], '|', s['level'], '|', s['program'])
