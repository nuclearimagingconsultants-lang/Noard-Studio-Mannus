import fs from "node:fs";
import {
  normalizeCatalog,
  normalizeMedicalGeneratedHours,
} from "../server/content.ts";
import {
  validateMedicalCourse,
  summarizeMedicalHours,
} from "../shared/medical.ts";
const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const catalog = normalizeMedicalGeneratedHours(normalizeCatalog(raw), {
  lessons: [],
});
const result = Object.fromEntries(
  catalog.courses.map(course => {
    const hours = summarizeMedicalHours(course);
    const lectures = course.lectures ?? [];
    const lectureEvidenceValid = lectures.every(
      x =>
        typeof x.url === "string" &&
        x.url.trim() &&
        typeof x.sourceUrl === "string" &&
        x.sourceUrl.trim() &&
        Number.isFinite(x.durationSeconds) &&
        x.durationSeconds > 0 &&
        x.accessVerified === true
    );
    const issues = validateMedicalCourse(course);
    return [
      course.id,
      {
        source: "full-catalog",
        issues,
        unknownDurationCount: hours.unknownDurationCount,
        lectureEvidenceValid,
        hasExternalLectureEvidence: lectures.length > 0,
        isReady:
          issues.length === 0 &&
          lectureEvidenceValid &&
          lectures.length > 0 &&
          hours.unknownDurationCount === 0 &&
          hours.verifiedTotalHours >= hours.targetHours,
      },
    ];
  })
);
process.stdout.write(JSON.stringify(result));
