import { useEffect, useState } from "react";
import {
  ChevronUp,
  ExternalLink,
  Maximize2,
  Minimize2,
  PanelsTopLeft,
  RotateCw,
} from "lucide-react";

export const TEACHING_STUDIO_URL =
  "https://teaching-studios.vercel.app/studio/NucMed-Board-Studio.html";

// Keep the external application on its own origin. In particular, it cannot
// replace Board Studio's top-level page or access its notes/session storage.
export const TEACHING_STUDIO_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox";

export function TeachingStudioPanel({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const [hasOpened, setHasOpened] = useState(active);
  const [tall, setTall] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "slow" | "opened" | "error">(
    "loading"
  );

  useEffect(() => {
    if (active) setHasOpened(true);
  }, [active]);

  useEffect(() => {
    if (!active || status !== "loading") return;
    const timer = window.setTimeout(() => setStatus("slow"), 25_000);
    return () => window.clearTimeout(timer);
  }, [active, reloadKey, status]);

  // No remote request until the learner deliberately opens this tab. Afterwards
  // hide rather than unmount it, preserving navigation when switching tabs.
  if (!hasOpened && !active) return null;

  return (
    <section
      id="teaching-studio-window"
      className={`teaching-studio${tall ? " teaching-studio--tall" : ""}`}
      hidden={!active}
      aria-labelledby="teaching-studio-heading"
    >
      <div className="teaching-studio-toolbar">
        <div>
          <h2 id="teaching-studio-heading">
            <PanelsTopLeft size={18} aria-hidden="true" /> NucMed Teaching Studio
          </h2>
          <p className="muted-copy">
            Your teaching app, inside Board Studio. Its study progress stays
            separate from this course.
          </p>
        </div>
        <div className="teaching-studio-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={() => {
              setStatus("loading");
              setReloadKey(value => value + 1);
            }}
            title="Reload the embedded app only"
          >
            <RotateCw size={14} aria-hidden="true" /> Reload
          </button>
          <button
            type="button"
            className="button button-quiet"
            aria-pressed={tall}
            onClick={() => setTall(value => !value)}
          >
            {tall ? (
              <Minimize2 size={14} aria-hidden="true" />
            ) : (
              <Maximize2 size={14} aria-hidden="true" />
            )}
            {tall ? "Restore size" : "Expand window"}
          </button>
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
          >
            <ChevronUp size={14} aria-hidden="true" /> Collapse
          </button>
        </div>
      </div>
      <div className="teaching-studio-status" role="status" aria-live="polite">
        {status === "loading" && "Opening your Teaching Studio…"}
        {status === "slow" &&
          "The external app is taking longer to open. You can keep waiting or choose Reload."}
        {status === "error" &&
          "The external window could not open. Your Board Studio course is unchanged; try Reload."}
      </div>
      <iframe
        key={reloadKey}
        className="teaching-studio-frame"
        src={TEACHING_STUDIO_URL}
        title="NucMed Teaching Studio — embedded application"
        sandbox={TEACHING_STUDIO_SANDBOX}
        allow="autoplay; fullscreen; clipboard-write"
        allowFullScreen
        referrerPolicy="no-referrer"
        onLoad={() => setStatus("opened")}
        onError={() => setStatus("error")}
      />
      <details className="teaching-studio-help">
        <summary>Window not displaying or need the original site?</summary>
        <p className="muted-copy">
          External browser or site restrictions can prevent a window from
          displaying even after it opens. Reload above, or use the optional link
          below. Board Studio stays open; nothing redirects automatically.
        </p>
        <a href={TEACHING_STUDIO_URL} target="_blank" rel="noopener noreferrer">
          Open original Teaching Studio in a separate tab{" "}
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </details>
    </section>
  );
}
