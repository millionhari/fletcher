"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { fmtBytes } from "@/lib/format";
import { AnnotationSurface, type AnnotatedViewerHandle, type AnnotationBox, type AnnotationDraft, type AnnotationSurfaceHandle } from "@/components/fletcher/review/annotation-surface";

/**
 * Image review surface — the same zoom, pan, rectangle tool and comment boxes as
 * the PDF viewer, over a single image. GIFs are left as an <img> rather than
 * drawn to a canvas so they keep animating while being marked up.
 */
export const ImageViewer = forwardRef<AnnotatedViewerHandle, {
  url: string;
  alt: string;
  boxes: AnnotationBox[];
  activeId: string | null;
  draft: AnnotationDraft | null;
  onHoverBox: (id: string | null) => void;
  onSelectBox: (id: string) => void;
  onDraft: (draft: AnnotationDraft | null) => void;
}>(function ImageViewer({ url, alt, boxes, activeId, draft, onHoverBox, onSelectBox, onDraft }, ref) {
  // Keyed by url so a source swap invalidates the measurement without a
  // synchronous reset inside the effect, which would cascade an extra render.
  const [probe, setProbe] = useState<{ url: string; size: { w: number; h: number } | null; error: boolean } | null>(null);
  const current = probe?.url === url ? probe : null;
  const baseSize = current?.size ?? null;
  const error = current?.error ?? false;
  const imgRef = useRef<HTMLImageElement>(null);
  const surfaceRef = useRef<AnnotationSurfaceHandle>(null);

  // One surface, so the page argument is ignored — the rect is all that matters.
  useImperativeHandle(ref, () => ({
    revealAnchor: (_page, rect) => surfaceRef.current?.revealRect(rect),
  }), []);

  // Measure off-screen first: the surface needs the natural size before it can
  // work out a fit, and a cached image can be complete before onLoad ever fires.
  useEffect(() => {
    const img = new Image();
    img.onload = () => setProbe({ url, size: { w: img.naturalWidth, h: img.naturalHeight }, error: false });
    img.onerror = () => setProbe({ url, size: null, error: true });
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return (
    <AnnotationSurface
      ref={surfaceRef}
      baseSize={baseSize}
      boxes={boxes}
      activeId={activeId}
      draft={draft}
      onHoverBox={onHoverBox}
      onSelectBox={onSelectBox}
      onDraft={onDraft}
      fitKey={url}
      // Blowing a small asset up to the full panel width on open looks broken;
      // zooming past 100% is still available from the toolbar.
      maxFitZoom={1}
      status={
        error ? <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-destructive">Could not load this image.</div>
        : !baseSize ? <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading image…</div>
        : null
      }
    >
      {(size) => (
        // eslint-disable-next-line @next/next/no-img-element -- review asset: exact pixels, no loader rewriting
        <img
          ref={imgRef}
          src={url}
          alt={alt}
          draggable={false}
          width={size.w}
          height={size.h}
          className="block max-w-none select-none rounded-sm bg-white"
          style={{ width: size.w, height: size.h }}
        />
      )}
    </AnnotationSurface>
  );
})

/** Natural dimensions and weight, shown under the image the way the video note is. */
export function ImageMeta({ width, height, bytes }: { width?: number | null; height?: number | null; bytes?: number | null }) {
  if (!width && !height && !bytes) return null;
  return (
    <span className="tabular text-2xs text-muted-foreground">
      {width && height ? `${width}×${height}` : null}
      {width && height && bytes ? " · " : null}
      {bytes ? fmtBytes(bytes) : null}
    </span>
  );
}
