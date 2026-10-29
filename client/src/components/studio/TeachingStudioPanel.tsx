import { useEffect, useRef, useState } from "react";
import { ChevronUp, ExternalLink, Maximize2, Minimize2, PanelsTopLeft, RotateCw } from "lucide-react";
import { useStudioResize } from "./useStudioResize";

export const TEACHING_STUDIO_URL =
  "https://teaching-studios.vercel.app/studio/NucMed-Board-Studio.html";

export function teachingStudioLiveUrl(refresh: string | number) {
  return `${TEACHING_STUDIO_URL}?__boardstudio_refresh=${encodeURIComponent(String(refresh))}`;
}

// Remain on the app's separate origin; no parent-page navigation/session bridge.
export const TEACHING_STUDIO_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox";

export function TeachingStudioPanel({ active, onClose }: { active: boolean; onClose: () => void }) {
  const [hasOpened, setHasOpened] = useState(active);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "slow" | "opened" | "error">("loading");
  const [frameUrl, setFrameUrl] = useState(() => teachingStudioLiveUrl(Date.now()));
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const resize = useStudioResize(active, frame, viewport);

  useEffect(() => { if (active) setHasOpened(true); }, [active]);
  useEffect(() => {
    if (!active || status !== "loading") return;
    const timer = window.setTimeout(() => setStatus("slow"), 25_000);
    return () => window.clearTimeout(timer);
  }, [active, reloadKey, status]);

  // Create no remote request before opening; afterwards preserve the same frame.
  if (!hasOpened && !active) return null;

  return (
    <section id="teaching-studio-window" className="teaching-studio" hidden={!active} aria-labelledby="teaching-studio-heading">
      <div className="teaching-studio-toolbar">
        <div>
          <h2 id="teaching-studio-heading"><PanelsTopLeft size={18} aria-hidden="true" /> NucMed Teaching Studio</h2>
          <p className="muted-copy">Your teaching app, inside Board Studio. Its study progress stays separate from this course.</p>
        </div>
        <div className="teaching-studio-actions">
          <button type="button" className="button button-quiet" onClick={() => { setStatus("loading"); setFrameUrl(teachingStudioLiveUrl(`${Date.now()}-${reloadKey + 1}`)); setReloadKey(value => value + 1); }} title="Load the latest published Teaching Studio without redeploying Board Studio">
            <RotateCw size={14} aria-hidden="true" /> Reload
          </button>
          <button type="button" className="button button-quiet" onClick={resize.expand} title="Add more height each time; no fixed maximum">
            <Maximize2 size={14} aria-hidden="true" /> Expand window
          </button>
          {resize.isCustom && <button type="button" className="button button-quiet" onClick={resize.restore}>
            <Minimize2 size={14} aria-hidden="true" /> Restore size
          </button>}
          {resize.size.width !== undefined && <button type="button" className="button button-quiet" onClick={resize.fitWidth}>Fit width</button>}
          <button type="button" className="button button-quiet" onClick={onClose}><ChevronUp size={14} aria-hidden="true" /> Collapse</button>
        </div>
      </div>
      <div className="teaching-studio-status" role="status" aria-live="polite">
        {status === "loading" && "Opening your Teaching Studio…"}
        {status === "slow" && "The external app is taking longer to open. You can keep waiting or choose Reload."}
        {status === "error" && "The external window could not open. Your Board Studio course is unchanged; try Reload."}
      </div>
      <p className="teaching-studio-size-hint" id="teaching-studio-resize-help">
        Drag the bottom bar down or right to make more room. Keep dragging near the screen edge to keep growing. Wider windows scroll here; taller windows move the content below down.
        <span>Keyboard: arrow keys resize; Shift makes bigger steps; Home restores size.</span>
        <span>Live website, not a copied app. After publishing changes to Teaching Studio, choose Reload here—no Board Studio update needed. Your current view is not interrupted automatically.</span>
      </p>
      <div className="teaching-studio-viewport" ref={viewport}>
        <div id="teaching-studio-canvas" className={`teaching-studio-canvas${resize.dragging ? " is-resizing" : ""}`} style={{ width: resize.size.width ?? "100%" }}>
          <iframe
            ref={frame}
            key={reloadKey}
            className="teaching-studio-frame"
            style={{ height: resize.size.height }}
            src={frameUrl}
            title="NucMed Teaching Studio — embedded application"
            sandbox={TEACHING_STUDIO_SANDBOX}
            allow="autoplay; fullscreen; clipboard-write"
            allowFullScreen
            referrerPolicy="no-referrer"
            onLoad={() => setStatus("opened")}
            onError={() => setStatus("error")}
          />
          <button type="button" className="teaching-studio-resize-handle" aria-label="Resize Teaching Studio window" aria-controls="teaching-studio-canvas" aria-describedby="teaching-studio-resize-help" {...resize.handle}>
            <span className="teaching-studio-grip" aria-hidden="true" />
            <span>Drag to resize</span><Maximize2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      <details className="teaching-studio-help">
        <summary>Window not displaying or need the original site?</summary>
        <p className="muted-copy">External browser or site restrictions can prevent a window from displaying even after it opens. Reload above, or use the optional link below. Board Studio stays open; nothing redirects automatically.</p>
        <a href={TEACHING_STUDIO_URL} target="_blank" rel="noopener noreferrer">Open original Teaching Studio in a separate tab <ExternalLink size={12} aria-hidden="true" /></a>
      </details>
    </section>
  );
}
