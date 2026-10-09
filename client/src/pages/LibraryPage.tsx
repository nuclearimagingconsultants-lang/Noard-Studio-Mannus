import { useMemo, useState } from "react";
import { Archive, BookOpen, Download, FileText, Search, SlidersHorizontal } from "lucide-react";
import type { DocumentRecord } from "@shared/catalog";
import type { StudioViewProps } from "@/lib/studioTypes";
import { SourceReader } from "@/components/studio/SourceReader";
import { EmptyState, SectionHeading, SourceLink } from "@/components/studio/StudioPrimitives";

type Resource = { id: string; title: string; type: string; url?: string; programIds: string[]; document?: DocumentRecord; description?: string };

export default function LibraryPage({ snapshot }: StudioViewProps) {
  const [query, setQuery] = useState("");
  const [programId, setProgramId] = useState("all");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const resources = useMemo<Resource[]>(() => {
    const documentResources = snapshot.catalog.documents.map(document => ({ id: `document:${document.id}`, title: document.title, type: "Source PDF", url: document.storageUrl || document.sourceUrl, programIds: document.programIds ?? [], document, description: document.author || document.licenseNote }));
    const syllabusResources = snapshot.catalog.courses.filter(course => course.syllabusUrl).map(course => ({ id: `syllabus:${course.id}`, title: `${course.title} syllabus`, type: "Course PDF", url: course.syllabusUrl, programIds: [course.programId], description: course.id }));
    const guideResources = snapshot.catalog.programs.filter(program => program.guideUrl || program.outlineUrl).map(program => ({ id: `guide:${program.id}`, title: `${program.name} program guide`, type: "Program guide", url: program.guideUrl || program.outlineUrl, programIds: [program.id], description: program.credentialType }));
    const downloadResources = snapshot.catalog.downloads.map(download => ({ id: `download:${download.id}`, title: download.title, type: download.kind || "Download", url: download.url, programIds: [], description: "Study resource" }));
    return [...documentResources, ...syllabusResources, ...guideResources, ...downloadResources];
  }, [snapshot.catalog]);
  const filtered = resources.filter(resource => {
    const text = `${resource.title} ${resource.type} ${resource.description ?? ""}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (programId === "all" || resource.programIds.length === 0 || resource.programIds.includes(programId));
  });
  const selectableDocuments = snapshot.catalog.documents.filter(document => programId === "all" || !document.programIds?.length || document.programIds.includes(programId));
  const selectedDocument = selectableDocuments.find(document => document.id === selectedDocumentId) ?? selectableDocuments[0];
  if (!resources.length) return <EmptyState title="The library is waiting for its manifest">Source books, course PDFs, guides, board downloads, and the archive appear only when their real catalog rows and durable URLs are available.</EmptyState>;
  return <div className="page-stack library-page"><header className="page-intro"><div><p className="eyebrow">Sources and study packets</p><h1>One library,<br /><em>not a pile of links.</em></h1></div><p className="library-note">Open a PDF alongside your work when a storage or source URL is listed. Files without URLs remain visibly unavailable rather than being replaced with samples.</p></header><div className="library-controls"><label className="search-control"><Search size={17} aria-hidden="true" /><span className="sr-only">Search library</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search titles, guides, source books…" /></label><label className="select-control"><SlidersHorizontal size={16} aria-hidden="true" /><span className="sr-only">Filter by program</span><select value={programId} onChange={event => { setProgramId(event.target.value); setSelectedDocumentId(""); }}><option value="all">All programs</option>{snapshot.catalog.programs.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label></div><section className="library-layout"><div><SectionHeading index="01" eyebrow={`${filtered.length} matching materials`} title="Library catalog" /><div className="resource-catalog">{filtered.map(resource => <article key={resource.id} className={`library-item ${resource.document?.id === selectedDocument?.id ? "is-selected" : ""}`}><button className="library-item-main" onClick={() => resource.document && setSelectedDocumentId(resource.document.id)} disabled={!resource.document}><span className="resource-icon">{resource.type.toLowerCase().includes("download") || resource.type.toLowerCase().includes("archive") ? <Archive size={18} /> : <FileText size={18} />}</span><div><small>{resource.type}</small><h2>{resource.title}</h2><p>{resource.description || "Source details are not listed."}</p></div></button><SourceLink href={resource.url} download={resource.type.toLowerCase().includes("download") || resource.type.toLowerCase().includes("archive")}>{resource.type.toLowerCase().includes("download") ? <><Download size={14} aria-hidden="true" /> Download</> : "Open"}</SourceLink></article>)}{!filtered.length && <p className="muted-copy">No listed materials match this search and program filter.</p>}</div></div><aside className="library-reader"><SectionHeading index="02" eyebrow="Selected source" title="Read in studio" />{selectableDocuments.length ? <SourceReader documents={selectableDocuments} initialId={selectedDocument?.id} /> : <div className="reader-empty"><BookOpen size={20} aria-hidden="true" /><p>No source PDF in this program filter is ready for in-studio reading.</p></div>}</aside></section></div>;
}
