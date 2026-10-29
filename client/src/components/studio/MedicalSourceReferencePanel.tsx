import { useQuery } from "@tanstack/react-query";
import {
  MEDICAL_SOURCE_REFERENCE_ASSET,
  medicalReferenceCourse,
  parseMedicalSourceReferenceIndex,
  type MedicalSourceReferenceCourse,
} from "@shared/medicalSourceReferences";
import { SourceLink } from "./StudioPrimitives";

function ReferenceLimits() {
  return (
    <div className="gap-copy medical-reference-limits">
      <p>
        Research references only — not approved chapters and zero counted lecture
        minutes. Suggested unit links are partial and do not validate topic coverage.
        Human clinician review not performed.
      </p>
      <p>
        PubMed links are bibliographic records; abstracts and full-text access vary.
        Full-text review is not established here. External sources retain their own
        access and copyright terms. No article, case, figure or publisher video is
        reproduced in this reference map. Independent self-study only, not clinical
        training, accreditation or board certification.
      </p>
    </div>
  );
}

export function MedicalSourceReferenceContent({
  course,
  indexedDate,
}: {
  course?: MedicalSourceReferenceCourse;
  indexedDate: string;
}) {
  return (
    <section className="medical-source-references" aria-label="Research references">
      <ReferenceLimits />
      <p className="muted-copy">Reference map indexed {indexedDate}.</p>
      {!course ? (
        <p>This course was not included in this bounded source-reference pass.</p>
      ) : !course.references.length ? (
        <p>
          No usable source-reference links were returned for this record in this
          bounded pass. Missing sources have not been guessed; its requirements
          remain open.
        </p>
      ) : (
        <ol className="medical-reference-list">
          {course.references.map(reference => (
            <li key={reference.id}>
              <SourceLink href={reference.url}>{reference.title}</SourceLink>
              {reference.citation && <p>{reference.citation}</p>}
              <p className="muted-copy">
                {reference.publisher} · Reference only · 0 lecture minutes
              </p>
              <p className="muted-copy">
                {reference.suggestedUnitNumbers.length
                  ? `Suggested units: ${reference.suggestedUnitNumbers.join(", ")} — not validated coverage.`
                  : "Course-level reference; no verified unit association is asserted."}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function MedicalSourceReferencePanel({ courseId }: { courseId: string }) {
  const query = useQuery({
    queryKey: ["medical-source-references", MEDICAL_SOURCE_REFERENCE_ASSET],
    queryFn: async ({ signal }) => {
      const response = await fetch(MEDICAL_SOURCE_REFERENCE_ASSET, {
        signal,
        credentials: "omit",
      });
      if (!response.ok) throw new Error("Reference map request failed");
      return parseMedicalSourceReferenceIndex(await response.json());
    },
    staleTime: Infinity,
    retry: 1,
  });
  if (query.isPending) {
    return <><ReferenceLimits /><p role="status">Loading source-reference links…</p></>;
  }
  if (query.isError || !query.data) {
    return (
      <>
        <ReferenceLimits />
        <p role="alert">The reference map could not be loaded. No sources are being inferred.</p>
        <button className="button button-quiet" onClick={() => void query.refetch()}>
          Retry references
        </button>
      </>
    );
  }
  return (
    <MedicalSourceReferenceContent
      course={medicalReferenceCourse(query.data, courseId)}
      indexedDate={query.data.indexedDate}
    />
  );
}
