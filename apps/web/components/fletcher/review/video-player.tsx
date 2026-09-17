"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { VersionSource } from "@fletcher/core";

export interface PlayerHandle {
  getCurrentTime(): Promise<number>;
  seekTo(seconds: number): Promise<void>;
  pause(): Promise<void>;
  play(): Promise<void>;
}

export interface PlayerProps {
  sourceType: VersionSource;
  url: string | null;
  externalId: string | null;
  onTime?: (seconds: number) => void;
  onDuration?: (seconds: number) => void;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadScript(src: string, ready: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (ready()) return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (!existing) {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      document.head.appendChild(s);
    }
    const iv = setInterval(() => {
      if (ready()) {
        clearInterval(iv);
        resolve();
      }
    }, 50);
  });
}

/** One player surface for YouTube, Vimeo and uploaded files with a shared imperative API. */
export const VideoPlayer = forwardRef<PlayerHandle, PlayerProps>(function VideoPlayer({ sourceType, url, externalId, onTime, onDuration }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytRef = useRef<any>(null);
  const vimeoRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onTimeRef = useRef(onTime);
  const onDurationRef = useRef(onDuration);
  onTimeRef.current = onTime;
  onDurationRef.current = onDuration;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    setReady(false);
    setError(null);

    if (sourceType === "youtube" && externalId && hostRef.current) {
      hostRef.current.innerHTML = "";
      const el = document.createElement("div");
      hostRef.current.appendChild(el);
      loadScript("https://www.youtube.com/iframe_api", () => !!window.YT?.Player).then(() => {
        if (cancelled) return;
        ytRef.current = new window.YT.Player(el, {
          videoId: externalId,
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: () => {
              setReady(true);
              onDurationRef.current?.(ytRef.current.getDuration());
              timer = setInterval(() => onTimeRef.current?.(ytRef.current?.getCurrentTime?.() ?? 0), 250);
            },
          },
        });
      });
    } else if (sourceType === "vimeo" && externalId && hostRef.current) {
      hostRef.current.innerHTML = "";
      import("@vimeo/player").then(({ default: Player }) => {
        if (cancelled || !hostRef.current) return;
        const p = new Player(hostRef.current, { id: Number(externalId), responsive: true, byline: false, title: false });
        vimeoRef.current = p;
        p.ready()
          .then(() => {
            setReady(true);
            p.getDuration().then((d) => onDurationRef.current?.(d));
          })
          .catch((e: unknown) => setError(e instanceof Error ? e.message : "Vimeo could not load this video."));
        p.on("timeupdate", (e: { seconds: number }) => onTimeRef.current?.(e.seconds));
      });
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        ytRef.current?.destroy?.();
      } catch {}
      try {
        vimeoRef.current?.destroy?.();
      } catch {}
      ytRef.current = null;
      vimeoRef.current = null;
    };
  }, [sourceType, externalId, url]);

  useImperativeHandle(ref, () => ({
    async getCurrentTime() {
      if (sourceType === "youtube") return ytRef.current?.getCurrentTime?.() ?? 0;
      if (sourceType === "vimeo") return (await vimeoRef.current?.getCurrentTime?.()) ?? 0;
      return videoRef.current?.currentTime ?? 0;
    },
    async seekTo(s) {
      if (sourceType === "youtube") {
        ytRef.current?.seekTo?.(s, true);
        // An unstarted / cued YouTube player ignores seeks until it plays.
        const state = ytRef.current?.getPlayerState?.();
        if (state === -1 || state === 5) ytRef.current?.playVideo?.();
      }
      else if (sourceType === "vimeo") await vimeoRef.current?.setCurrentTime?.(s);
      else if (videoRef.current) videoRef.current.currentTime = s;
    },
    async pause() {
      if (sourceType === "youtube") ytRef.current?.pauseVideo?.();
      else if (sourceType === "vimeo") await vimeoRef.current?.pause?.();
      else videoRef.current?.pause();
    },
    async play() {
      if (sourceType === "youtube") ytRef.current?.playVideo?.();
      else if (sourceType === "vimeo") await vimeoRef.current?.play?.();
      else await videoRef.current?.play();
    },
  }));

  if (sourceType === "upload" || sourceType === "url") {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {url ? (
          <video ref={videoRef} src={url} controls playsInline className="h-full w-full" onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)} onLoadedMetadata={(e) => onDuration?.(e.currentTarget.duration)} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/60">No source</div>
        )}
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full">
      <div ref={hostRef} className="absolute inset-0 [&>div]:h-full [&>div]:w-full" />
      {!ready && !error && <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">Loading player…</div>}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black px-6 text-center text-xs text-white/80">
          <span>Couldn&apos;t load this video.</span>
          <span className="text-white/50">{error}</span>
          {url && <a href={url} target="_blank" rel="noreferrer" className="mt-1 underline">Open on {sourceType === "vimeo" ? "Vimeo" : "YouTube"}</a>}
        </div>
      )}
    </div>
  );
});
