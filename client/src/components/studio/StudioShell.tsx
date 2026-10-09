import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookMarked, CheckCircle2, Library, LogOut, Menu, PanelLeftClose, PlaySquare, Route, Sparkles, Stethoscope } from "lucide-react";
import type { ProgramRecord } from "@shared/catalog";
import { isLoginConfigured, startLogin } from "@/const";
import type { ReturnTypeUseStudy } from "@/lib/studioTypes";

type Props = {
  programs: ProgramRecord[];
  children: ReactNode;
  study: ReturnTypeUseStudy;
};

const primaryNav = [
  { href: "/", label: "Studio", icon: PanelLeftClose },
  { href: "/board", label: "Study board", icon: CheckCircle2 },
  { href: "/library", label: "Library", icon: Library },
  { href: "/coverage", label: "Coverage", icon: Route },
];

function isCurrent(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function StudioShell({ programs, children, study }: Props) {
  const [location] = useLocation();
  const { auth } = study;
  return (
    <div className="studio-shell">
      <aside className="studio-rail" aria-label="Board Studio navigation">
        <Link href="/" className="studio-wordmark" aria-label="Board Studio home">
          <span className="studio-mark" aria-hidden="true"><span /> <span /></span>
          <span>Board<br /><em>Studio</em></span>
        </Link>
        <nav className="rail-nav" aria-label="Main navigation">
          {primaryNav.map(item => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={`rail-link ${isCurrent(location, item.href) ? "is-active" : ""}`}>
              <Icon size={17} aria-hidden="true" /><span>{item.label}</span>
            </Link>;
          })}
        </nav>
        <div className="rail-section-label">Programs</div>
        <nav className="program-nav" aria-label="Programs">
          {programs.length ? programs.map(program => {
            const href = program.id === "med" ? "/med" : `/program/${encodeURIComponent(program.id)}`;
            return <Link key={program.id} href={href} className={`program-link ${location === href ? "is-active" : ""}`}>
              <span className="program-dot" aria-hidden="true" />
              <span>{program.name || program.id}</span>
            </Link>;
          }) : <p className="rail-empty">Catalog is loading.</p>}
        </nav>
        <div className="rail-spacer" />
        <div className="sync-card">
          <Sparkles size={15} aria-hidden="true" />
          <div>
            <strong>{auth.isAuthenticated ? "Account sync on" : "Guest study"}</strong>
            <p>{auth.isAuthenticated ? "Private notes and progress are saved to your account." : "Saved only on this device."}</p>
          </div>
        </div>
        {auth.loading ? <div className="auth-pending">Checking account…</div> : auth.isAuthenticated ? (
          <button className="rail-auth" onClick={() => void auth.logout()}><LogOut size={16} aria-hidden="true" /> Sign out</button>
        ) : isLoginConfigured() ? (
          <button className="rail-auth" onClick={() => startLogin()}>Sign in to sync</button>
        ) : null}
      </aside>
      <header className="mobile-header">
        <Link href="/" className="mobile-brand"><BookMarked size={18} aria-hidden="true" /> Board Studio</Link>
        <button className="mobile-menu" aria-label="Open study board"><Menu size={19} aria-hidden="true" onClick={() => {}} /></button>
      </header>
      <main className="studio-main">{children}</main>
      <nav className={`mobile-nav ${programs.some(program => program.id === "med") ? "has-med" : ""}`} aria-label="Mobile navigation">
        <Link href="/"><PanelLeftClose size={18} aria-hidden="true" /><span>Studio</span></Link>
        <Link href="/board"><CheckCircle2 size={18} aria-hidden="true" /><span>Board</span></Link>
        <Link href="/library"><Library size={18} aria-hidden="true" /><span>Library</span></Link>
        <Link href="/coverage"><PlaySquare size={18} aria-hidden="true" /><span>Coverage</span></Link>
        {programs.some(program => program.id === "med") && <Link href="/med"><Stethoscope size={18} aria-hidden="true" /><span>Med</span></Link>}
      </nav>
    </div>
  );
}
