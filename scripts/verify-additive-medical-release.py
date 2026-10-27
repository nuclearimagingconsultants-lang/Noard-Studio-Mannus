#!/usr/bin/env python3
"""Read-only exact 28-reading release with an optional explicit companion increment."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()

parser = argparse.ArgumentParser()
parser.add_argument('--origin', required=True)
parser.add_argument('--report', type=Path, required=True)
parser.add_argument('--companion-ids-file', type=Path, help='Exact unique new EXPLAIN-402 IDs above the protected 239-ready release.')
args = parser.parse_args()
companion_ids = set()
if args.companion_ids_file:
    chosen = json.loads(args.companion_ids_file.read_text())
    assert isinstance(chosen, list) and chosen and all(isinstance(ident, str) and ident.startswith('MED-') and ident.endswith('-EXPLAIN-402') for ident in chosen)
    assert len(chosen) == len(set(chosen))
    companion_ids = set(chosen)
origin = args.origin.rstrip('/')
def get(route):
    with urllib.request.urlopen(origin + route, timeout=40) as response:
        assert response.status == 200
        return json.loads(response.read())
index = json.loads((ROOT / 'data/medical/reading-index.json').read_text())
states = json.loads((ROOT / 'data/medical/reading-development.json').read_text())
medical = json.loads((ROOT / 'data/medical/catalog-index.json').read_text())
ids = sorted(medical['coursePartById'])
assert len(ids) == 333 and len(index['entries']) == 28 and len(states['entries']) == 136
expected = {}
for entry in index['entries']:
    raw = (ROOT / 'data/medical' / entry['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == entry['payloadSha256']
    value = json.loads(raw)
    assert value['countedLectureMinutes'] == 0 and value['videoProduced'] is False
    assert value['humanClinicalReviewStatus'] == 'not performed'
    expected[entry['episodeId']] = value
assert len(expected) == 28
for ident, digest in {'MED-058-EXPLAIN-301': '610d19bc81738a27ec171913075040b5d51773e0f3791334c5f5cf6725715e19', 'MED-063-EXPLAIN-301': '4b72645efe949b51d19d6e3d7b93b16f19ffa81f95167ac7007a1b2cde06abdd'}.items():
    assert next(entry['payloadSha256'] for entry in index['entries'] if entry['episodeId'] == ident) == digest
expected_states = {row['courseId']: row for row in states['entries']}
seen, seen_states, results = {}, {}, []
def course(course_id):
    value = get('/api/content/medical-chapters/' + course_id)
    assert value['courseId'] == course_id and value['withheldCount'] == 0
    actual = {row['episodeId']: row for row in value['chapters']}
    wanted = {key: row for key, row in expected.items() if row['courseId'] == course_id}
    assert actual == wanted and len(actual) == len(value['chapters']), course_id
    assert value.get('development') == expected_states.get(course_id), course_id
    return course_id, actual, value.get('development')
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for number, (course_id, chapters, state) in enumerate(pool.map(course, ids), 1):
        seen.update(chapters)
        if state:
            seen_states[course_id] = state
        results.append({'courseId': course_id, 'chapterCount': len(chapters), 'ok': True})
        if number % 50 == 0:
            print('Verified medical reader endpoints', number, '/', len(ids), flush=True)
assert seen == expected and seen_states == expected_states
ready_expected = sorted(row['id'] for filename in ['data/original-lectures.json', 'data/medical/original-lectures.json'] for row in json.loads((ROOT / filename).read_text())['lessons'] if row.get('status') == 'ready')
media = get('/api/content/media')
ready_actual = sorted(row['id'] for row in media['lessons'] if row.get('status') == 'ready')
assert ready_expected == ready_actual and len(ready_actual) == 239 + len(companion_ids)
legacy_new_ids = {'MED-059-EXPLAIN-401', 'MED-110-EXPLAIN-401'}
new_ids = legacy_new_ids | companion_ids
assert new_ids.issubset(ready_actual) and not new_ids.intersection(expected)
for row in media['lessons']:
    if row['id'] in new_ids:
        assert row['humanClinicalReviewStatus'] == 'not performed' and row['medicalSourceReviewStatus'] == 'passed_automated_source_check'
assert sum(row['durationSeconds'] for row in media['lessons'] if row['id'] in legacy_new_ids) == 628
if companion_ids:
    baseline239 = sorted(set(ready_actual) - companion_ids)
    assert len(baseline239) == 239 and hashlib.sha256(canonical(baseline239)).hexdigest() == 'c835e3f79d5770c4360b2f967fd075ec01223276483f7aa2d9ae4110ed27377f'
    local_medical = {row['id']: row for row in json.loads((ROOT / 'data/medical/original-lectures.json').read_text())['lessons']}
    for row in media['lessons']:
        if row['id'] in companion_ids:
            assert row['durationSeconds'] == local_medical[row['id']]['durationSeconds'] and row['durationSeconds'] > 0
old_ready = sorted(set(ready_actual) - new_ids)
# Hash of the exact preserved 237-ID baseline, computed by the previous live release.
assert hashlib.sha256(canonical(old_ready)).hexdigest() == 'da3e0ce46812aa0937bcac78cd47555ebfb8d1ed44e318729e099bb56a05b2f2'
catalog = get('/api/content/catalog')
local_catalog = json.loads((ROOT / 'data/catalog.json').read_text())
for bundle_id, digest, size in [('medical-source-reviewed-14-readings-20261026', '731c55607917630d3d8e8324751ab75e58dc0fcc88debacb935fb8c63f37aea1', 182521), ('medical-source-reviewed-28-readings-20261027', '5d0ddef9a3ef30f6f5d17db4e6276062408866f6b45432291b7e276274c897e0', 247439)]:
    local = next(row for row in local_catalog['downloads'] if row['id'] == bundle_id)
    live = next(row for row in catalog['downloads'] if row['id'] == bundle_id)
    assert local['sha256'] == digest and local['bytes'] == size
    assert all(live.get(key) == local[key] for key in ['id', 'title', 'kind', 'url'])
increment_ids = companion_ids or legacy_new_ids
increment_seconds = sum(row['durationSeconds'] for row in media['lessons'] if row['id'] in increment_ids)
report = {'status': 'PASS', 'origin': origin, 'medicalReadingEndpoints': 333, 'exactFullPayloads': 28, 'legacyDevelopmentStates': 136, 'legacySourceReviewsPending': sum(row['status'] == 'source_review_pending' for row in seen_states.values()), 'legacySourceUnavailable': sum(row['status'] == 'source_unavailable' for row in seen_states.values()), 'readyMediaIdentities': len(ready_actual), 'preservedPreviousReadyIdentities': 239 if companion_ids else 237, 'protectedLegacy237Identities': 237, 'newMeasuredVideos': len(increment_ids), 'newMeasuredSeconds': increment_seconds, 'newMeasuredMinutes': increment_seconds / 60, 'readyIdentitySha256': hashlib.sha256(canonical(ready_actual)).hexdigest(), 'fullPayloadsSha256': hashlib.sha256(canonical(seen)).hexdigest(), 'developmentStatesSha256': hashlib.sha256(canonical(seen_states)).hexdigest(), 'readingsAddZeroVideoMinutes': True, 'clinicianReviewNotPerformed': True, 'bothOldAndNewLibraryBundlesPassed': True, 'courses': results}
assert report['legacySourceReviewsPending'] == 118 and report['legacySourceUnavailable'] == 8
args.report.parent.mkdir(parents=True, exist_ok=True)
args.report.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({key: value for key, value in report.items() if key != 'courses'}, indent=2))
