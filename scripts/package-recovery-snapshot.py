#!/usr/bin/env python3
"""Finite portable packs; no generation, downloading, or promotion of planned media."""
import argparse
import hashlib
import json
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path

APP = Path('/home/ubuntu/boardstudio')
ROOT = Path('/home/ubuntu/ai-business-finance-study')
OUT = ROOT / 'deliverables'
PUBLIC_FIELDS = ('id', 'title', 'programIds', 'courseIds', 'durationSeconds', 'sourceKind',
                 'sourcePages', 'sourceUrls', 'coverageStatus', 'coverageGaps',
                 'medicalSourceReviewStatus', 'humanClinicalReviewStatus',
                 'scriptSha256', 'visualSha256', 'evidenceSelectionSha256',
                 'renderContentSha256', 'videoUrl', 'captionUrl', 'transcriptUrl')


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def pack_media(previous):
    old = {}
    rows = []
    manifests = ('data/original-lectures.json', 'data/medical/original-lectures.json')
    for filename in manifests:
        value = json.loads(subprocess.check_output(['git', 'show', previous + ':' + filename], cwd=APP))
        old.update({x['id']: x for x in value['lessons'] if x.get('status') == 'ready'})
    for filename in manifests:
        rows.extend(x for x in json.loads((APP / filename).read_text())['lessons']
                    if x.get('status') == 'ready' and
                    (x['id'] not in old or any(x.get(k) != old[x['id']].get(k)
                     for k in ('videoUrl', 'captionUrl', 'transcriptUrl'))))
    assert len({x['id'] for x in rows}) == len(rows)
    if not rows:
        return None
    files = []
    index = []
    for row in sorted(rows, key=lambda x: x['id']):
        ident = row['id']
        medical = 'med' in row.get('programIds', [])
        record_path = (ROOT / 'medical/original-lectures/review' / (ident + '.catalog-record.json')
                       if medical else ROOT / 'original-lectures/manifests' / (ident + '.json'))
        record = json.loads(record_path.read_text())
        assert record.get('status') == 'ready'
        assert all(row.get(k) for k in ('videoUrl', 'captionUrl', 'transcriptUrl'))
        if medical:
            assert row.get('medicalSourceReviewStatus') == 'passed_automated_source_check'
            assert row.get('humanClinicalReviewStatus') == 'not performed'
            assert record.get('localAssetSha256') == record.get('uploadedAssetSha256')
            paths = [(key, Path(record['localAssets'][key])) for key in ('mp4', 'vtt', 'transcript')]
        else:
            paths = [('mp4', Path(record['videoPath'])), ('vtt', Path(record['captionPath'])),
                     ('transcript', Path(record['transcriptPath']))]
        item = {key: row[key] for key in PUBLIC_FIELDS if key in row}
        item['bundledAssets'] = {}
        for key, path in paths:
            assert path.is_file() and path.stat().st_size > 0, str(path)
            sha = digest(path)
            if medical:
                assert sha == record['uploadedAssetSha256'][key], ident + ':' + key
            member = 'lessons/' + ident + '/' + path.name
            files.append((path, member))
            item['bundledAssets'][key] = {'path': member, 'sha256': sha, 'bytes': path.stat().st_size}
        video = paths[0][1]
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format',
                                                  '-show_streams', '-of', 'json', str(video)]))
        kinds = {s['codec_type'] for s in probe['streams']}
        assert {'audio', 'video'} <= kinds
        assert abs(float(probe['format']['duration']) - float(row['durationSeconds'])) < 1.0
        index.append(item)
    estimated = sum(path.stat().st_size for path, _ in files)
    assert shutil.disk_usage(OUT).free > estimated + 8 * 1024**3, 'Preserve medical render capacity'
    target = OUT / f'playable-lecture-recovery-{len(index)}-files.zip'
    boundary = ('This is a frozen supplement of actual ready originals added or revised after the preceding '
                '166-file saved snapshot. It is not the complete original teaching series or completed '
                'courses. Captions/transcripts and measured media are included. Orientations and '
                'reference walkthroughs retain their labels. Medical clips received automated source '
                'checks only; no human clinician review. No degree, licensure, board eligibility or '
                'passing guarantee. External university recordings are linked separately, not rehosted.')
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as z:
        z.writestr('README.md', '# Playable original lecture recovery supplement\n\n' + boundary + '\n')
        z.writestr('index.json', json.dumps({'createdAt': datetime.now(timezone.utc).isoformat(),
                                           'previousCommit': previous, 'previousReadyCount': len(old),
                                           'addedFiles': sum(x['id'] not in old for x in index),
                                           'revisedFiles': sum(x['id'] in old for x in index),
                                           'readyFiles': len(index), 'boundary': boundary,
                                           'lessons': index}, indent=2) + '\n')
        for n, (path, member) in enumerate(files, 1):
            z.write(path, member)
            if n % 15 == 0:
                print(f'PROGRESS media archive: {n}/{len(files)} assets', flush=True)
    verify_zip(target)
    return target


def pack_syllabi():
    catalog = json.loads((APP / 'data/medical/catalog.json').read_text())
    hashes = json.loads((APP / 'data/medical/asset-hashes.json').read_text())
    index = []
    files = []
    for course in catalog['courses']:
        ident = course['id']
        path = ROOT / 'medical/deliverables/course-pdfs' / (ident + '.pdf')
        assert path.is_file() and path.read_bytes()[:5] == b'%PDF-'
        sha = digest(path)
        assert hashes.get('syllabus:' + ident) == sha, 'Stale syllabus bytes: ' + ident
        index.append({'id': ident, 'title': course['title'], 'path': 'syllabi/' + path.name,
                      'sha256': sha, 'durableUrl': course['syllabusUrl']})
        files.append((path, 'syllabi/' + path.name))
    target = OUT / f'medical-current-{len(files)}-syllabi.zip'
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=3, allowZip64=True) as z:
        z.writestr('README.md', '# Current medical self-study syllabi\n\n'
                   'Frozen source-cited curriculum snapshot; not completed residency/fellowship, '
                   'clinician-reviewed teaching, 36-hour completion for every record, licensure, '
                   'board eligibility or a passing guarantee. Programme/variant records are not '
                   'distinct board specialties. Linked readings retain publisher rights.\n')
        z.writestr('index.json', json.dumps({'createdAt': datetime.now(timezone.utc).isoformat(),
                                           'syllabi': index}, indent=2) + '\n')
        for n, (path, member) in enumerate(files, 1):
            z.write(path, member)
            if n % 60 == 0:
                print(f'PROGRESS syllabus archive: {n}/{len(files)} PDFs', flush=True)
    verify_zip(target)
    return target


def verify_zip(path):
    with zipfile.ZipFile(path) as z:
        failed = z.testzip()
        assert failed is None, str(failed)
    print('VERIFIED', path, 'bytes', path.stat().st_size, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--previous', default='c6a875f')
    parser.add_argument('--syllabi-only', action='store_true')
    args = parser.parse_args()
    results = {'syllabi': str(pack_syllabi())}
    if not args.syllabi_only:
        media = pack_media(args.previous)
        results['mediaSupplement'] = str(media) if media else None
    (OUT / 'recovery-archive-paths.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps(results, indent=2), flush=True)


if __name__ == '__main__':
    main()
