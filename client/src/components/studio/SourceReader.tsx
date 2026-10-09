import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Maximize2,
} from "lucide-react";
import type { DocumentRecord } from "@shared/catalog";
import { SourceLink } from "./StudioPrimitives";

type Props = {
  documents: DocumentRecord[];
  initialId?: string;
  initialPage?: number;
  followPage?: number;
  canFollow?: boolean;
  following?: boolean;
  onFollowChange?: (following: boolean) => void;
  /** Changes only when a learner intentionally changes lesson/source context. */
  sourceKey?: string;
};

function documentUrl(document: DocumentRecord | undefined) {
  return document?.storageUrl || document?.sourceUrl;
}

function validPage(page: number | undefined, totalPages?: number) {
  const requested =
    typeof page === "number" && Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.max(
    1,
    Math.min(totalPages ?? Number.MAX_SAFE_INTEGER, requested)
  );
}

export function SourceReader({
  documents,
  initialId,
  initialPage,
  followPage,
  canFollow = false,
  following = false,
  onFollowChange,
  sourceKey,
}: Props) {
  const initialDocument = useMemo(
    () => documents.find(document => document.id === initialId) ?? documents[0],
    [documents, initialId]
  );
  const [selectedId, setSelectedId] = useState(initialDocument?.id ?? "");
  const [page, setPage] = useState(() => validPage(initialPage));
  const selected =
    documents.find(document => document.id === selectedId) ?? initialDocument;
  const url = documentUrl(selected);
  const totalPages =
    selected?.pages && selected.pages > 0 ? selected.pages : undefined;
  const requestedSourceMissing = Boolean(
    initialId && !documents.some(document => document.id === initialId)
  );

  useEffect(() => {
    // Do not react to normal media refreshes: learners keep their manual document and page until
    // a queue selection (or its source context) intentionally changes.
    setSelectedId(initialDocument?.id ?? "");
    setPage(validPage(initialPage, initialDocument?.pages));
  }, [sourceKey]);

  useEffect(() => {
    setSelectedId(current =>
      documents.some(document => document.id === current)
        ? current
        : (initialDocument?.id ?? "")
    );
  }, [documents, initialDocument?.id]);

  useEffect(() => {
    setPage(current => validPage(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!following || typeof followPage !== "number") return;
    const source =
      documents.find(document => document.id === initialId) ?? initialDocument;
    if (!source) return;
    setSelectedId(source.id);
    setPage(validPage(followPage, source.pages));
  }, [documents, followPage, following, initialDocument, initialId]);

  const stopFollowing = () => onFollowChange?.(false);

  if (!documents.length) {
    return (
      <div className="reader-empty">
        <FileText size={20} aria-hidden="true" />
        <p>
          {initialId
            ? `No accessible PDF matches this lesson’s source (${initialId}).`
            : "No linked source PDF is available for this course yet."}
        </p>
      </div>
    );
  }

  return (
    <section className="source-reader" aria-label="Source PDF reader">
      {requestedSourceMissing && (
        <p className="reader-source-fallback" role="status">
          <AlertCircle size={14} aria-hidden="true" />
          This lesson cites source <code>{initialId}</code>, but no matching
          accessible PDF is linked. Showing the course source instead.
        </p>
      )}
      <div className="reader-toolbar">
        <label>
          <span className="sr-only">Select source document</span>
          <select
            value={selectedId}
            onChange={event => {
              stopFollowing();
              setSelectedId(event.target.value);
            }}
          >
            {documents.map(document => (
              <option key={document.id} value={document.id}>
                {document.title}
              </option>
            ))}
          </select>
        </label>
        <div className="page-controls">
          <button
            onClick={() => {
              stopFollowing();
              setPage(current => Math.max(1, current - 1));
            }}
            disabled={page <= 1}
            aria-label="Previous PDF page"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <label className="page-input">
            <span>Page</span>
            <input
              aria-label="PDF page"
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={event => {
                stopFollowing();
                setPage(validPage(Number(event.target.value), totalPages));
              }}
            />
          </label>
          <span className="page-total">
            {totalPages ? `of ${totalPages}` : "page count unknown"}
          </span>
          <button
            onClick={() => {
              stopFollowing();
              setPage(current =>
                totalPages ? Math.min(totalPages, current + 1) : current + 1
              );
            }}
            disabled={Boolean(totalPages && page >= totalPages)}
            aria-label="Next PDF page"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        {canFollow && onFollowChange && (
          <label className="reader-follow-toggle">
            <input
              type="checkbox"
              checked={following}
              onChange={event => onFollowChange(event.target.checked)}
            />
            Follow video page
          </label>
        )}
        <SourceLink href={url}>
          <ExternalLink size={13} aria-hidden="true" /> Open
        </SourceLink>
      </div>
      {url ? (
        <div className="pdf-frame-wrap">
          <iframe
            key={`${url}#page=${page}`}
            title={`${selected?.title ?? "Source PDF"}, page ${page}`}
            src={`${url}#page=${page}&view=FitH`}
            className="pdf-frame"
          />
          <a
            className="pdf-open-overlay"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            <Maximize2 size={15} aria-hidden="true" /> Open if preview is
            blocked
          </a>
        </div>
      ) : (
        <div className="reader-empty">
          <FileText size={20} aria-hidden="true" />
          <p>
            This source has no accessible PDF URL. Use its listed source link
            when it becomes available.
          </p>
        </div>
      )}
    </section>
  );
}
