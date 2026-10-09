import { useEffect, useRef, useState } from "react";
import VimeoPlayer from "@vimeo/player";
import { AlertCircle, ExternalLink, SkipForward, Volume2 } from "lucide-react";
import type { QueueItem } from "@/lib/queue";
import {
  isNativeMediaUrl,
  parseYouTubeUrl,
  vimeoEmbedUrl,
  youTubeEmbedUrl,
} from "@/lib/queue";

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: Record<string, unknown>
      ) => YouTubePlayer;
      PlayerState: { PLAYING: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YouTubePlayer = {
  destroy: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  playVideo: () => void;
};

function loadYouTubeApi(): Promise<NonNullable<Window["YT"]>> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-board-youtube]");
    const timeout = window.setTimeout(
      () => reject(new Error("YouTube player timed out")),
      10_000
    );
    const done = () => {
      window.clearTimeout(timeout);
      window.YT?.Player
        ? resolve(window.YT)
        : reject(new Error("YouTube player unavailable"));
    };
    if (existing) {
      const prior = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prior?.();
        done();
      };
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.boardYoutube = "true";
    window.onYouTubeIframeAPIReady = done;
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("YouTube player could not load"));
    };
    document.head.appendChild(script);
  });
}

type YouTubeProps = {
  item: QueueItem;
  active: boolean;
  startPosition: number;
  onEnded: () => void;
  onPosition: (seconds: number) => void;
  onPlaybackTime?: (seconds: number) => void;
  onStart: () => void;
  onFailure: () => void;
};

function YouTubeEmbed({
  item,
  active,
  startPosition,
  onEnded,
  onPosition,
  onPlaybackTime,
  onStart,
  onFailure,
}: YouTubeProps) {
  const mount = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const activeRef = useRef(active);
  const startPositionRef = useRef(startPosition);
  const onEndedRef = useRef(onEnded);
  const onPositionRef = useRef(onPosition);
  const onPlaybackTimeRef = useRef(onPlaybackTime);
  const onStartRef = useRef(onStart);
  const onFailureRef = useRef(onFailure);

  activeRef.current = active;
  startPositionRef.current = startPosition;
  onEndedRef.current = onEnded;
  onPositionRef.current = onPosition;
  onPlaybackTimeRef.current = onPlaybackTime;
  onStartRef.current = onStart;
  onFailureRef.current = onFailure;

  useEffect(() => {
    if (active) playerRef.current?.playVideo();
  }, [active, item.queueId]);

  useEffect(() => {
    let mounted = true;
    let interval: number | undefined;
    let positionBucket: number | undefined;
    const parsed = parseYouTubeUrl(item.url);
    if (!mount.current || (!parsed.videoId && !parsed.playlistId)) {
      onFailureRef.current();
      return;
    }
    void loadYouTubeApi()
      .then(YT => {
        if (!mounted || !mount.current) return;
        playerRef.current = new YT.Player(mount.current, {
          videoId: parsed.videoId,
          playerVars: {
            enablejsapi: 1,
            rel: 0,
            list: parsed.playlistId,
            listType: parsed.playlistId ? "playlist" : undefined,
          },
          events: {
            onReady: () => {
              const savedPosition = startPositionRef.current;
              if (savedPosition > 0)
                playerRef.current?.seekTo(savedPosition, true);
              if (activeRef.current) playerRef.current?.playVideo();
            },
            onStateChange: (event: { data: number }) => {
              if (event.data === YT.PlayerState.PLAYING) onStartRef.current();
              if (event.data === YT.PlayerState.ENDED && activeRef.current)
                onEndedRef.current();
            },
            onError: () => onFailureRef.current(),
          },
        });
        interval = window.setInterval(() => {
          const current = playerRef.current?.getCurrentTime();
          if (typeof current !== "number" || current <= 0) return;
          onPlaybackTimeRef.current?.(current);
          const nextBucket = Math.floor(current / 10);
          if (positionBucket === nextBucket) return;
          positionBucket = nextBucket;
          onPositionRef.current(current);
        }, 500);
      })
      .catch(() => onFailureRef.current());
    return () => {
      mounted = false;
      if (interval) window.clearInterval(interval);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [item.queueId, item.url]);

  return (
    <div
      ref={mount}
      className="youtube-mount"
      aria-label={`${item.title} YouTube player`}
    />
  );
}

type VimeoProps = {
  item: QueueItem;
  active: boolean;
  startPosition: number;
  onEnded: () => void;
  onPosition: (seconds: number) => void;
  onPlaybackTime?: (seconds: number) => void;
  onStart: () => void;
  onFailure: () => void;
};

function VimeoEmbed({
  item,
  active,
  startPosition,
  onEnded,
  onPosition,
  onPlaybackTime,
  onStart,
  onFailure,
}: VimeoProps) {
  const mount = useRef<HTMLDivElement>(null);
  const playerRef = useRef<VimeoPlayer | null>(null);
  const activeRef = useRef(active);
  const startPositionRef = useRef(startPosition);
  const onEndedRef = useRef(onEnded);
  const onPositionRef = useRef(onPosition);
  const onPlaybackTimeRef = useRef(onPlaybackTime);
  const onStartRef = useRef(onStart);
  const onFailureRef = useRef(onFailure);
  const readyRef = useRef(false);
  const restoredItemRef = useRef<string | undefined>(undefined);
  const positionBucketRef = useRef<number | undefined>(undefined);
  const attemptPlaybackRef = useRef<() => void>(() => undefined);

  activeRef.current = active;
  startPositionRef.current = startPosition;
  onEndedRef.current = onEnded;
  onPositionRef.current = onPosition;
  onPlaybackTimeRef.current = onPlaybackTime;
  onStartRef.current = onStart;
  onFailureRef.current = onFailure;

  attemptPlaybackRef.current = () => {
    const player = playerRef.current;
    if (!player || !readyRef.current || !activeRef.current) return;
    const play = () => {
      if (playerRef.current !== player || !activeRef.current) return;
      // Browser policy can reject this; leave the provider's controls available.
      void player.play().catch(() => undefined);
    };
    if (
      restoredItemRef.current === item.queueId ||
      startPositionRef.current <= 0
    ) {
      play();
      return;
    }
    restoredItemRef.current = item.queueId;
    // Vimeo documents that seeking before playback can start playback, so only
    // restore after the learner has explicitly armed the queue or pressed Play.
    void player
      .setCurrentTime(startPositionRef.current)
      .catch(() => undefined)
      .finally(play);
  };

  useEffect(() => {
    if (active) attemptPlaybackRef.current();
  }, [active, item.queueId]);

  useEffect(() => {
    const embedUrl = vimeoEmbedUrl(item.url);
    if (!mount.current || !embedUrl) {
      onFailureRef.current();
      return;
    }
    let mounted = true;
    let player: VimeoPlayer | null = null;
    readyRef.current = false;
    restoredItemRef.current = undefined;
    positionBucketRef.current = undefined;

    const handlePlay = () => {
      if (mounted) onStartRef.current();
    };
    const handleTimeUpdate = (event: { seconds?: number }) => {
      if (!mounted || !Number.isFinite(event.seconds) || event.seconds! <= 0)
        return;
      const seconds = event.seconds!;
      onPlaybackTimeRef.current?.(seconds);
      const nextBucket = Math.floor(seconds / 10);
      if (positionBucketRef.current === nextBucket) return;
      positionBucketRef.current = nextBucket;
      onPositionRef.current(seconds);
    };
    const handleEnded = () => {
      // This provider event represents actual end-of-video playback, not a timer.
      if (mounted && activeRef.current) onEndedRef.current();
    };
    const handleError = () => {
      if (mounted) onFailureRef.current();
    };

    try {
      player = new VimeoPlayer(mount.current, {
        responsive: true,
        url: embedUrl,
      });
      playerRef.current = player;
      player.on("play", handlePlay);
      player.on("timeupdate", handleTimeUpdate);
      player.on("ended", handleEnded);
      player.on("error", handleError);
      void player
        .ready()
        .then(() => {
          if (!mounted || playerRef.current !== player) return;
          readyRef.current = true;
          attemptPlaybackRef.current();
        })
        .catch(() => {
          if (mounted) onFailureRef.current();
        });
    } catch {
      onFailureRef.current();
    }

    return () => {
      mounted = false;
      readyRef.current = false;
      if (player) {
        player.off("play", handlePlay);
        player.off("timeupdate", handleTimeUpdate);
        player.off("ended", handleEnded);
        player.off("error", handleError);
        void player.destroy().catch(() => undefined);
      }
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [item.queueId, item.url]);

  return (
    <div
      ref={mount}
      className="vimeo-mount"
      aria-label={`${item.title} Vimeo player`}
    />
  );
}

type Props = {
  item?: QueueItem;
  originalLabel?: string;
  queueActive: boolean;
  restoredPosition: number;
  onEnded: () => void;
  onPosition: (seconds: number) => void;
  onPlaybackTime?: (seconds: number) => void;
  onSkip: () => void;
  onStart: () => void;
};

export function MediaPlayer({
  item,
  originalLabel,
  queueActive,
  restoredPosition,
  onEnded,
  onPosition,
  onPlaybackTime,
  onSkip,
  onStart,
}: Props) {
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const restoredItemRef = useRef<string | undefined>(undefined);
  const lastPositionBucketRef = useRef<number | undefined>(undefined);
  const restoredPositionRef = useRef(restoredPosition);
  const onPositionRef = useRef(onPosition);
  const onPlaybackTimeRef = useRef(onPlaybackTime);
  const onStartRef = useRef(onStart);
  const onEndedRef = useRef(onEnded);

  restoredPositionRef.current = restoredPosition;
  onPositionRef.current = onPosition;
  onPlaybackTimeRef.current = onPlaybackTime;
  onStartRef.current = onStart;
  onEndedRef.current = onEnded;

  const native = isNativeMediaUrl(item?.url);
  useEffect(() => {
    setPlaybackFailed(false);
    restoredItemRef.current = undefined;
    lastPositionBucketRef.current = undefined;
  }, [item?.queueId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!native || !queueActive || !video || !video.paused) return;
    // A user click on Play all may be allowed to start playback; browser policy can still require
    // the learner to press native controls, which remains an honest, usable fallback.
    void video.play().catch(() => undefined);
  }, [native, item?.queueId, queueActive]);

  const restoreNativePosition = () => {
    if (!item || restoredItemRef.current === item.queueId) return;
    restoredItemRef.current = item.queueId;
    const video = videoRef.current;
    const savedPosition = restoredPositionRef.current;
    if (!video || savedPosition <= 0) return;
    if (Number.isFinite(video.duration) && savedPosition >= video.duration)
      return;
    video.currentTime = savedPosition;
  };

  const reportNativePosition = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const bucket = Math.floor(seconds / 10);
    if (lastPositionBucketRef.current === bucket) return;
    lastPositionBucketRef.current = bucket;
    onPositionRef.current(seconds);
  };

  if (!item)
    return (
      <div className="media-empty">
        <Volume2 size={26} aria-hidden="true" />
        <h2>No playable lesson in this view</h2>
        <p>
          Choose Original or University recordings when the catalog includes
          them. Planned and blocked original work stays visible in Coverage.
        </p>
      </div>
    );

  const youtube = Boolean(youTubeEmbedUrl(item.url));
  const vimeo = Boolean(vimeoEmbedUrl(item.url));
  const sourceHref = item.sourceUrl || item.url;
  if (playbackFailed || (!native && !youtube && !vimeo)) {
    return (
      <div className="media-empty media-fallback">
        <AlertCircle size={25} aria-hidden="true" />
        <h2>Playback is not available here</h2>
        <p>
          This source could not play in the studio. Position is not tracked;
          open the source or move to the next queued item.
        </p>
        <div className="inline-actions">
          <a
            className="button button-crimson"
            href={sourceHref}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} aria-hidden="true" /> Open source
          </a>
          <button className="button button-quiet" onClick={onSkip}>
            <SkipForward size={15} aria-hidden="true" /> Skip / next
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="media-player">
      <div className="player-topline">
        <span className={`source-pill ${item.source}`}>
          {item.source === "original"
            ? originalLabel || "Original Board Studio file"
            : item.provider || "Outside university"}
        </span>
        {item.unitLabel && <span>{item.unitLabel}</span>}
      </div>
      <div className="player-surface">
        {native ? (
          <video
            key={item.queueId}
            ref={videoRef}
            controls
            crossOrigin="anonymous"
            autoPlay={queueActive}
            onLoadedMetadata={restoreNativePosition}
            onCanPlay={restoreNativePosition}
            onPlay={() => onStartRef.current()}
            onEnded={() => {
              if (queueActive) onEndedRef.current();
            }}
            onTimeUpdate={event => {
              const seconds = event.currentTarget.currentTime;
              onPlaybackTimeRef.current?.(seconds);
              reportNativePosition(seconds);
            }}
            onError={() => setPlaybackFailed(true)}
          >
            <source src={item.url} />
            {item.captionUrl && (
              <track
                kind="captions"
                src={item.captionUrl}
                srcLang="en"
                label="English captions"
                default
              />
            )}
            Your browser cannot play this video. Use the source link instead.
          </video>
        ) : youtube ? (
          <YouTubeEmbed
            item={item}
            active={queueActive}
            startPosition={restoredPosition}
            onEnded={onEnded}
            onPosition={onPosition}
            onPlaybackTime={onPlaybackTime}
            onStart={onStart}
            onFailure={() => setPlaybackFailed(true)}
          />
        ) : (
          <VimeoEmbed
            item={item}
            active={queueActive}
            startPosition={restoredPosition}
            onEnded={onEnded}
            onPosition={onPosition}
            onPlaybackTime={onPlaybackTime}
            onStart={onStart}
            onFailure={() => setPlaybackFailed(true)}
          />
        )}
      </div>
      <div className="player-caption">
        <div>
          <strong>{item.title}</strong>
          <span>
            {queueActive
              ? "Queue started — advances when a playable lesson ends."
              : "Choose Play all or play this lesson to enable queue advance."}
          </span>
        </div>
        <div className="inline-actions">
          <a
            className="icon-action"
            href={sourceHref}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={15} aria-hidden="true" />
            <span>Source</span>
          </a>
          <button className="icon-action" onClick={onSkip}>
            <SkipForward size={15} aria-hidden="true" />
            <span>Next</span>
          </button>
        </div>
      </div>
    </div>
  );
}
