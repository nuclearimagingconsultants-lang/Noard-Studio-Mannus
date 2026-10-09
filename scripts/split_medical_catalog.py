#!/usr/bin/env python3
"""Split the medical catalogue and build a compact targeted-workspace index.

The canonical ``catalog.json`` remains untouched.  The generated index contains
only directory and programme-queue fields, plus a stable course-ID-to-part map;
full curriculum detail stays in its individual part file.
"""

import json
import subprocess
from pathlib import Path
from typing import Any

PART_SIZE = 12
QUEUE_PART_SIZE = 12
QUEUE_COURSE_FIELDS = (
    "id",
    "programId",
    "title",
    "term",
    "level",
    "studyHours",
    "coverageStatus",
    "syllabusUrl",
    "pdfIds",
)
MEDICAL_QUEUE_FIELDS = (
    "family",
    "trackType",
    "boardNames",
    "boardStatus",
    "boardEligibilityNotice",
    "targetVideoHours",
    "verifiedExternalHours",
    "verifiedGeneratedHours",
    "verifiedTotalHours",
    "verifiedSpecialtyHours",
    "verifiedFoundationHours",
    "hoursGap",
    "clinicalTrainingNotReplaced",
    "humanClinicalReviewStatus",
)
LECTURE_FIELDS = (
    "id",
    "title",
    "url",
    "provider",
    "durationSeconds",
    "sourceUrl",
    "accessVerified",
)
UNIT_FIELDS = ("number", "text", "coverage", "lectureIds", "viewingSequence")


def atomic_json_write(path: Path, value: Any) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    temp.replace(path)


def compact_fields(record: Any, fields: tuple[str, ...]) -> dict[str, Any]:
    if not isinstance(record, dict):
        return {}
    return {key: record[key] for key in fields if key in record}


def compact_queue_course(course: Any) -> dict[str, Any]:
    """Keep only the data required to build a truthful programme queue.

    Full objectives, curriculum evidence, question banks, and research packets
    deliberately stay in the course part.  Nested medical metadata is flattened
    only for the compact directory fields consumed by the existing queue
    projection; top-level values retain their producer precedence.
    """
    if not isinstance(course, dict):
        return {}
    compact = compact_fields(course, QUEUE_COURSE_FIELDS)
    compact["lectures"] = [
        compact_fields(lecture, LECTURE_FIELDS)
        for lecture in course.get("lectures", [])
        if isinstance(lecture, dict)
    ]
    compact["unitMap"] = [
        compact_fields(unit, UNIT_FIELDS)
        for unit in course.get("unitMap", [])
        if isinstance(unit, dict)
    ]
    metadata = course.get("medical")
    if not isinstance(metadata, dict):
        metadata = {}
    for field in MEDICAL_QUEUE_FIELDS:
        if field in course:
            compact[field] = course[field]
        elif field in metadata:
            compact[field] = metadata[field]
    official_programmes = course.get("officialProgrammes", metadata.get("officialProgrammes"))
    if isinstance(official_programmes, list):
        compact["officialProgrammes"] = [
            compact_fields(programme, ("institution", "name"))
            for programme in official_programmes
            if isinstance(programme, dict)
        ]
    return compact


def split_catalog(path: Path) -> None:
    data = json.loads(path.read_text())
    validation = json.loads(subprocess.check_output([
        'node', '--import', 'tsx',
        str(Path(__file__).with_name('build-medical-directory-validation.mjs')),
        str(path),
    ], cwd=path.parent.parent.parent, text=True))
    courses = data.pop("courses", [])
    if not isinstance(courses, list):
        raise ValueError("catalogue courses must be an array")

    folder = path.parent / "catalog-parts"
    folder.mkdir(exist_ok=True)
    queue_folder = path.parent / "queue-parts"
    queue_folder.mkdir(exist_ok=True)
    names: list[str] = []
    queue_names: list[str] = []
    course_part_by_id: dict[str, str] = {}

    for number, start in enumerate(range(0, len(courses), PART_SIZE), 1):
        name = f"part-{number:03d}.json"
        relative_name = "catalog-parts/" + name
        batch = courses[start : start + PART_SIZE]
        atomic_json_write(folder / name, batch)
        names.append(relative_name)
        for course in batch:
            if not isinstance(course, dict) or not isinstance(course.get("id"), str):
                raise ValueError(f"part {name} contains a course without a string ID")
            course_id = course["id"]
            if not course_id or course_id in course_part_by_id:
                raise ValueError(f"duplicate or empty course ID: {course_id!r}")
            course_part_by_id[course_id] = relative_name

    for number, start in enumerate(range(0, len(courses), QUEUE_PART_SIZE), 1):
        name = f"part-{number:03d}.json"
        relative_name = "queue-parts/" + name
        compact_batch = [
            {**compact_queue_course(course), 'directoryMedicalValidation': validation[course['id']]}
            for course in courses[start : start + QUEUE_PART_SIZE]
        ]
        atomic_json_write(queue_folder / name, compact_batch)
        queue_names.append(relative_name)

    expected_parts = {Path(name).name for name in names}
    for stale in folder.glob("part-*.json"):
        if stale.name not in expected_parts:
            stale.unlink()
    expected_queue_parts = {Path(name).name for name in queue_names}
    for stale in queue_folder.glob("part-*.json"):
        if stale.name not in expected_queue_parts:
            stale.unlink()

    data["workspaceIndexVersion"] = 1
    data["courseParts"] = names
    data["coursePartById"] = course_part_by_id
    data["queueParts"] = queue_names
    data.pop("queueCourses", None)
    data["savedCourseCount"] = len(courses)
    target = path.parent / "catalog-index.json"
    atomic_json_write(target, data)

    part_sizes = [(folder / Path(name).name).stat().st_size for name in names]
    queue_part_sizes = [
        (queue_folder / Path(name).name).stat().st_size for name in queue_names
    ]
    print(
        "Checkpoint-safe medical catalogue:",
        len(courses),
        "courses;",
        len(names),
        "full parts;",
        len(queue_names),
        "queue parts; compact index bytes",
        target.stat().st_size,
        "; maximum full part bytes",
        max(part_sizes, default=0),
        "; maximum queue part bytes",
        max(queue_part_sizes, default=0),
    )


if __name__ == "__main__":
    split_catalog(Path(__file__).resolve().parent.parent / "data/medical/catalog.json")
