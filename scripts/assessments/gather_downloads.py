"""Copies Cambridge GO downloads from the Downloads folder into
private/assessments-src/cambridge-go/<course>/ and unpacks every zip there
(zips inside zips too). Only PDFs are kept from the zips.

    python scripts/assessments/gather_downloads.py [downloads folder] --since 2026-10-01T10:00
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'private' / 'assessments-src' / 'cambridge-go'
_args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] != '--since']
DOWNLOADS = Path(_args[0]) if _args else Path.home() / 'Downloads'

# Files whose names do not say which book they came from.
ODD = {'Tests.zip': 'maths-p4', 'End of unit test answers.zip': 'maths-p3', 'End_of_unit_test_answers.zip': 'maths-p3'}


def course_of(name):
    if name in ODD:
        return ODD[name]
    n = name.lower()
    rules = [
        (r'^ge_(\d)_', 'english-ge{}'),
        (r'^(?:ls_maths_?|ls_maths)(\d)', 'maths-ls{}'),
        (r'^lower_secondary_science_(\d)', 'science-ls{}'),
        (r'^(?:prim_maths_|p_maths_)(\d)', 'maths-p{}'),
        (r'^(?:primary_science_|p_science[ _])(\d)', 'science-p{}'),
    ]
    for pat, fmt in rules:
        m = re.match(pat, n)
        if m:
            return fmt.format(m.group(1))
    return None


def unzip_pdfs(zpath, dest):
    """Extracts the PDFs (and nested zips, recursively) from one zip."""
    count = 0
    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            name = info.filename
            # Old zips store names in cp437; Cambridge's are plain ASCII, so this is only a guard.
            low = name.lower()
            if '__macosx' in low or Path(name).name.startswith('._'):
                continue
            if low.endswith('.pdf') or low.endswith('.zip'):
                out = dest / name
                out.parent.mkdir(parents=True, exist_ok=True)
                with z.open(info) as src, open(out, 'wb') as dst:
                    shutil.copyfileobj(src, dst)
                if low.endswith('.zip'):
                    count += unzip_pdfs(out, out.with_suffix(''))
                    out.unlink()
                else:
                    count += 1
    return count


def main():
    # Only files downloaded since this time (--since 2026-10-01T10:00); older
    # Cambridge files already in Downloads are left alone.
    since = 0.0
    if '--since' in sys.argv:
        from datetime import datetime
        since = datetime.fromisoformat(sys.argv[sys.argv.index('--since') + 1]).timestamp()
    moved = 0
    for f in sorted(DOWNLOADS.iterdir()):
        if not f.is_file() or f.suffix.lower() not in ('.zip', '.pdf'):
            continue
        # The browser reserves the name with an empty file until the download is done.
        if f.stat().st_size == 0 or f.stat().st_mtime < since:
            continue
        name = re.sub(r' \(\d+\)(?=\.\w+$)', '', f.name)  # "x (1).zip" when the name was taken
        course = course_of(name)
        if not course:
            continue
        if f.suffix.lower() == '.zip' and not zipfile.is_zipfile(f):
            print(f'not finished yet: {f.name}')
            continue
        dest_dir = SRC / course
        dest_dir.mkdir(parents=True, exist_ok=True)
        target = dest_dir / name
        shutil.copy2(f, target)  # copied: Downloads may already hold the same file from before
        moved += 1
        if target.suffix.lower() == '.zip':
            n = unzip_pdfs(target, dest_dir / target.stem)
            print(f'{course:12} {f.name}: {n} PDFs')
        else:
            print(f'{course:12} {f.name}')
    print(f'{moved} files copied into {SRC}')


if __name__ == '__main__':
    main()
