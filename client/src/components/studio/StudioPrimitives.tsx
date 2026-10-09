import type { ReactNode } from "react";
import { AlertCircle, ArrowUpRight, Check, Circle, Clock3, FileText, Play } from "lucide-react";
import type { FlexibleField } from "@shared/catalog";
import type { StudyStatus } from "@/lib/studyStorage";

export function CourseBadge({ children }: { children: ReactNode }) {
  return <span className="course-badge">{children}</span>;
}

export function StatusChip({ status }: { status?: StudyStatus | string }) {
  const normalized = status ?? "not_started";
  const meta = normalized === "complete" ? ["Complete", Check] : normalized === "in_progress" ? ["In progress", Play] : ["Not started", Circle];
  const [label, Icon] = meta as [string, typeof Circle];
  return <span className={`status-chip status-${normalized}`}><Icon size={12} aria-hidden="true" />{label}</span>;
}

export function SectionHeading({ index, eyebrow, title, action }: { index?: string; eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-heading">
    <div className="section-heading-copy">
      {index && <span className="section-index">{index}</span>}
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>
    </div>
    {action}
  </div>;
}

function Scalar({ value }: { value: string }) {
  return <p>{value}</p>;
}

/** Handles the source contract’s legacy string, list, and object variants without inventing missing copy. */
export function FlexibleContent({ value, empty = "No source detail is available yet." }: { value?: FlexibleField; empty?: string }) {
  if (value === null || value === undefined || value === "") return <p className="muted-copy">{empty}</p>;
  if (typeof value === "string") return <Scalar value={value} />;
  if (Array.isArray(value)) {
    const usable = value.map(item => typeof item === "string" ? item.trim() : item && typeof item === "object" ? JSON.stringify(item) : String(item)).filter(Boolean);
    return usable.length ? <ul className="editorial-list">{usable.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="muted-copy">{empty}</p>;
  }
  const entries = Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "");
  return entries.length ? <dl className="detail-list">{entries.map(([key, item]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{typeof item === "string" ? item : Array.isArray(item) ? item.map(entry => typeof entry === "string" ? entry : JSON.stringify(entry)).join(" · ") : JSON.stringify(item)}</dd></div>)}</dl> : <p className="muted-copy">{empty}</p>;
}

export function SourceLink({ href, children, download = false }: { href?: string; children: ReactNode; download?: boolean }) {
  if (!href) return <span className="source-link is-unavailable"><AlertCircle size={14} aria-hidden="true" />Unavailable</span>;
  return <a className="source-link" href={href} target="_blank" rel="noreferrer" download={download ? "" : undefined}><ArrowUpRight size={14} aria-hidden="true" />{children}</a>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><FileText size={22} aria-hidden="true" /><h2>{title}</h2><p>{children}</p></div>;
}

export function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

export function TimeLabel({ seconds, fallback = "Time not listed" }: { seconds?: number; fallback?: string }) {
  if (!seconds) return <span className="time-label"><Clock3 size={13} aria-hidden="true" />{fallback}</span>;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return <span className="time-label"><Clock3 size={13} aria-hidden="true" />{hours ? `${hours}h ${minutes}m` : `${minutes}m`}</span>;
}
