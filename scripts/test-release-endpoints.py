#!/usr/bin/env python3
"""Read-only release smoke test of every canonical course and public metadata."""
import concurrent.futures
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = os.environ.get('RELEASE_TEST_ORIGIN', 'http://127.0.0.1:3000').rstrip('/')
ROOT = Path('/home/ubuntu/boardstudio')
OUT = ROOT / 'release-checks'
OUT.mkdir(exist_ok=True)

def get(path):
    start = time.monotonic()
    with urllib.request.urlopen(BASE + path, timeout=25) as response:
        body = response.read()
        return json.loads(body), len(body), time.monotonic() - start

def query(name, value):
    return '/api/trpc/content.' + name + '?input=' + urllib.parse.quote(json.dumps({'json': value}))

def check_course(course):
    result, size, elapsed = get(query('workspace', {'courseId': course['id'], 'scope': 'course'}))
    value = result['result']['data']['json']
    records = value['catalog']['courses']
    assert len(records) == 1 and records[0]['id'] == course['id'], course['id']
    return {'id': course['id'], 'ok': True, 'bytes': size, 'elapsedSeconds': round(elapsed, 3), 'lectureEntries': len(records[0].get('lectures', []))}

catalog, size, elapsed = get('/api/content/catalog')
base_source = json.loads((ROOT / 'data/catalog.json').read_text())
medical_index = json.loads((ROOT / 'data/medical/catalog-index.json').read_text())
expected_medical_ids = set(medical_index['coursePartById'])
expected_course_ids = {x['id'] for x in base_source['courses']} | expected_medical_ids
assert {x['id'] for x in catalog['courses']} == expected_course_ids
assert {x['id'] for x in catalog['courses'] if x['programId'] == 'med'} == expected_medical_ids
report = {'origin': BASE, 'directory': {'courses': len(catalog['courses']), 'bytes': size, 'elapsedSeconds': round(elapsed, 3)}, 'courses': [], 'errors': []}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    futures = {pool.submit(check_course, c): c['id'] for c in catalog['courses']}
    for n, future in enumerate(concurrent.futures.as_completed(futures), 1):
        try:
            report['courses'].append(future.result())
        except Exception as error:
            report['errors'].append({'id': futures[future], 'error': str(error)})
        if n % 50 == 0:
            print('Verified course endpoints', n, '/', len(catalog['courses']), flush=True)
missing, _, _ = get(query('workspace', {'courseId': 'NONEXISTENT-RELEASE-TEST', 'scope': 'course'}))
assert not missing['result']['data']['json']['catalog']['courses']
report['genuineMissingCourse'] = 'empty successful lookup'
def saved_ready_ids():
    result = set()
    for filename in ['data/original-lectures.json', 'data/medical/original-lectures.json']:
        result.update(x['id'] for x in json.loads((ROOT / filename).read_text())['lessons'] if x.get('status') == 'ready')
    return result

# Producers atomically add media while the reader has a documented 15-second
# cache. Require an exact, stable before/after match, never an arbitrary subset.
deadline = time.monotonic() + 45
while True:
    expected_before = saved_ready_ids()
    media, _, _ = get('/api/content/media')
    expected_ready = saved_ready_ids()
    actual_ready = {x['id'] for x in media['lessons'] if x.get('status') == 'ready'}
    if expected_before == expected_ready == actual_ready:
        break
    if time.monotonic() >= deadline:
        raise AssertionError('Ready media identities differ after bounded cache refresh: '
                             + json.dumps({'missing': sorted(expected_ready - actual_ready),
                                           'unexpected': sorted(actual_ready - expected_ready)}))
    time.sleep(5)
report['readyOriginalVideos'] = len(actual_ready)
report['readyMediaIdentityCheck'] = 'exact stable canonical set after bounded live cache refresh'
assert '/home/' not in json.dumps(media)
assert '/tmp/' not in json.dumps(media)
report['publicMediaProjection'] = 'no internal absolute paths'
snapshot, size, _ = get('/api/content/snapshot')
assert size < 8_000_000 and {x['id'] for x in snapshot['catalog']['courses']} == expected_course_ids
report['publicSnapshotBytes'] = size
report['protectedRead'] = []
for name in ['study.progress.list', 'study.notes.list']:
    path = '/api/trpc/' + name + '?input=' + urllib.parse.quote(json.dumps({'json': {'scope': 1}}))
    try:
        urllib.request.urlopen(BASE + path, timeout=15)
        raise AssertionError('Unauthenticated learner endpoint unexpectedly accessible')
    except urllib.error.HTTPError as error:
        assert error.code == 401
        report['protectedRead'].append({'endpoint': name, 'status': 401})
report['status'] = 'PASS' if not report['errors'] else 'FAIL'
report['checkedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
(OUT / os.environ.get('RELEASE_TEST_REPORT', 'endpoint-results.json')).write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ['courses']}, indent=2), flush=True)
if report['errors']:
    raise SystemExit(1)
