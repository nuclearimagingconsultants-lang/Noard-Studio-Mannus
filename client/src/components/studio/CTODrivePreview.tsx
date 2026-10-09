import type { CTODriveMirror } from "@/lib/ctoDriveMirrors";
import "./cto-drive-player.css";

export function CTODrivePreview({
  mirror,
  title,
}: {
  mirror: CTODriveMirror;
  title: string;
}) {
  return (
    <iframe
      src={mirror.previewUrl}
      title={`${title} — Google Drive video preview`}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      referrerPolicy="no-referrer"
      style={{
        width: "100%",
        height: "100%",
        border: 0,
        aspectRatio: "16 / 9",
      }}
    />
  );
}

export function CTODrivePlaybackNotice() {
  return (
    <p className="status-note drive-playback-notice" role="note">
      Google Drive preview is an alternate copy of this original video. Press
      Play in the preview. Use Next manually: Drive does not report playback
      position or completion to Board Studio. Choose Studio playback for
      synchronized English captions, saved position and automatic queue advance.
      If Drive shows a processing or access message, return to Studio playback
      or open Drive directly.
    </p>
  );
}
