import { useQuery } from "@tanstack/react-query";
import {
  MEDICAL_SOURCE_REFERENCE_ASSET,
  medicalReferenceCourse,
  parseMedicalSourceReferenceIndex,
  type MedicalSourceReferenceCourse,
} from "@shared/medicalSourceReferences";
import {
  medicalReferencesForUnit,
  type MedicalCourseResearchSources,
} from "@shared/medicalCourseSources";
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
        Full-text review is not established here. Radiopaedia and other publishers
        retain their own access and copyright terms. No article, case, figure or
        publisher video is reproduced. Independent self-study only, not clinical
        training, accreditation or board certification.
      </p>
      <SourceLink href="https://www.ncbi.nlm.nih.gov/About/disclaimer.html">
        NCBI data disclaimer and copyright notice
      </SourceLink>
    </div>
  );
}

export function MedicalSourceReferenceContent({ course, indexedDate }: {
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
        <p>No usable source-reference links were returned for this record in this bounded pass.
          Missing sources have not been guessed; its requirements remain open.</p>
      ) : (
        <ol className="medical-reference-list">
          {course.references.map(reference => (
            <li key={reference.id}>
              <SourceLink href={reference.url}>{reference.title}</SourceLink>
              {reference.citation && <p>{reference.citation}</p>}
              <p className="muted-copy">{reference.publisher} · Reference only · 0 lecture minutes</p>
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

export function MedicalCourseResearchContent({ sources, onRetry }: {
  sources: MedicalCourseResearchSources;
  onRetry?: () => void;
}) {
  if (sources.status === "unavailable") {
    return (
      <section aria-label="Research references">
        <ReferenceLimits />
        <p role="alert">Course source data is unavailable. Existing lectures and approved chapters are unchanged; no sources are being inferred.</p>
        {onRetry && <button className="button button-quiet" onClick={onRetry}>Reload course source data</button>}
      </section>
    );
  }
  return (
    <section className="medical-source-references" aria-label="Research references">
      <ReferenceLimits />
      <p className="muted-copy">References integrated into {sources.courseId} · Indexed {sources.indexedDate}.</p>
      {!sources.references.length ? <p>No usable source-reference links were returned; requirements remain open.</p> : (
        <ol className="medical-reference-list">
          {sources.references.map(({ reference, citationIdentity, pubmedMetadata }) => (
            <li key={reference.id}>
              <SourceLink href={reference.url}>{pubmedMetadata?.title ?? reference.title}</SourceLink>
              {pubmedMetadata ? (
                <p>{pubmedMetadata.journal} · {pubmedMetadata.publicationDate}
                  {pubmedMetadata.doi ? ` · DOI: ${pubmedMetadata.doi}` : ""}
                  {` · PMID: ${pubmedMetadata.pmid}`}</p>
              ) : reference.citation ? <p>{reference.citation}</p> : null}
              <p className="muted-copy">{reference.publisher} · Reference only · 0 lecture minutes</p>
              {citationIdentity === "title_matches" ? (
                <p className="muted-copy">Title identity checked against PubMed citation metadata on {pubmedMetadata?.retrievedDate}; not full-text or clinical review.</p>
              ) : citationIdentity === "title_differs" ? (
                <p className="gap-copy">Citation title needs review; suggested unit links are withheld. The PubMed record title is shown above.</p>
              ) : citationIdentity === "not_checked" ? (
                <p className="gap-copy">PubMed metadata is unavailable; suggested unit links are withheld.</p>
              ) : <p className="muted-copy">Publisher link only; no bibliographic API verification or full-text review is asserted.</p>}
              {citationIdentity !== "title_differs" && citationIdentity !== "not_checked" && (
                <p className="muted-copy">
                  {reference.suggestedUnitNumbers.length
                    ? `Suggested units: ${reference.suggestedUnitNumbers.join(", ")} — not validated coverage.`
                    : "Course-level reference; no verified unit association is asserted."}
                </p>
              )}
              <details>
                <summary>Original proposed citation</summary>
                <p>{reference.title}</p>
                {reference.citation && <p>{reference.citation}</p>}
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function MedicalUnitSourceLinks({ sources, unitNumber }: {
  sources?: MedicalCourseResearchSources;
  unitNumber: unknown;
}) {
  const references = medicalReferencesForUnit(sources, unitNumber);
  if (!references.length) return null;
  return (
    <div className="medical-unit-sources" aria-label={`Suggested references for unit ${String(unitNumber)}`}>
      <small>Suggested reading references — partial, not validated coverage or approved chapters; 0 lecture minutes.</small>
      <ul>
        {references.map(({ reference, pubmedMetadata }) => (
          <li key={reference.id}>
            <SourceLink href={reference.url}>{pubmedMetadata?.title ?? reference.title}</SourceLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MedicalSourceReferencePanel({ courseId, researchSources }: {
  courseId: string;
  researchSources?: MedicalCourseResearchSources;
}) {
  const query = useQuery({
    queryKey: ["medical-source-references", MEDICAL_SOURCE_REFERENCE_ASSET],
    queryFn: async ({ signal }) => {
      const response = await fetch(MEDICAL_SOURCE_REFERENCE_ASSET, { signal, credentials: "omit" });
      if (!response.ok) throw new Error("Reference map request failed");
      return parseMedicalSourceReferenceIndex(await response.json());
    },
    enabled: !researchSources,
    staleTime: Infinity,
    retry: 1,
  });
  if (researchSources) {
    return <MedicalCourseResearchContent sources={researchSources} onRetry={() => window.location.reload()} />;
  }
  if (query.isPending) return <><ReferenceLimits /><p role="status">Loading source-reference links…</p></>;
  if (query.isError || !query.data) {
    return <>
      <ReferenceLimits />
      <p role="alert">The reference map could not be loaded. No sources are being inferred.</p>
      <button className="button button-quiet" onClick={() => void query.refetch()}>Retry references</button>
    </>;
  }
  return <MedicalSourceReferenceContent course={medicalReferenceCourse(query.data, courseId)} indexedDate={query.data.indexedDate} />;
}
