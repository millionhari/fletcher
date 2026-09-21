"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Hand, Maximize2, SquareDashed, ZoomIn, ZoomOut } from "lucide-react";
import type { NormalizedRect } from "@fletcher/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type AnnotationBox = { id: string; index: number; page: number; rect: NormalizedRect; color: string; resolved: boolean };
export type AnnotationDraft = { page: number; rect: NormalizedRect };

export interface AnnotationSurfaceHandle {
  /** Scroll the content so a normalized rect sits in the middle of the viewport. */
  revealRect: (rect: NormalizedRect) => void;
}

/** What both the PDF and image viewers expose to the page around them. */
export interface AnnotatedViewerHandle {
  revealAnchor: (page: number, rect: NormalizedRect) => void;
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;

/** Drag distance below which a rectangle is treated as a stray click, not a draw. */
const MIN_DRAG_PX = 6;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Normalize a drag between two points on the content surface into a 0..1 rect. */
function rectFromDrag(a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number): NormalizedRect {
  const x1 = clamp(Math.min(a.x, b.x) / w, 0, 1);
  const y1 = clamp(Math.min(a.y, b.y) / h, 0, 1);
  const x2 = clamp(Math.max(a.x, b.x) / w, 0, 1);
  const y2 = clamp(Math.max(a.y, b.y) / h, 0, 1);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * The shared review surface behind both the PDF and image viewers: zoom, pan, a
 * rectangle tool that pins a comment to a region, and the coloured boxes drawn
 * over the content. It owns every interaction; callers only supply the content
 * to render at a given pixel size, plus whatever extra toolbar controls they
 * need (page nav, for the PDF).
 *
 * Boxes are stored normalized against the content, so they stay put across zoom
 * levels and window sizes.
 */
export const AnnotationSurface = forwardRef<AnnotationSurfaceHandle, {
  /** Natural content size at 100%; null until the content has measured itself. */
  baseSize: { w: number; h: number } | null;
  /** Which page's boxes to draw. Images always pass 1. */
  page?: number;
  boxes: AnnotationBox[];
  activeId: string | null;
  draft: AnnotationDraft | null;
  onHoverBox: (id: string | null) => void;
  onSelectBox: (id: string) => void;
  onDraft: (draft: AnnotationDraft | null) => void;
  /** Extra controls pinned to the left of the toolbar, e.g. page navigation. */
  leading?: React.ReactNode;
  /** Ceiling for the automatic fit, so small images are not blown up on open. */
  maxFitZoom?: number;
  /** Changing this re-runs the initial fit — used when the source swaps. */
  fitKey?: string;
  /** Rendered in place of the content while loading or on error. */
  status?: React.ReactNode;
  children: (size: { w: number; h: number }) => React.ReactNode;
}>(function AnnotationSurface({ baseSize, page = 1, boxes, activeId, draft, onHoverBox, onSelectBox, onDraft, leading, maxFitZoom = Infinity, fitKey, status, children }, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<"pan" | "comment">("comment");
  const [drawing, setDrawing] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);

  // Memoized: it is a dependency of both the reveal handle and the draw effect,
  // and a fresh object each render would rebuild them continuously.
  const size = useMemo(
    () => (baseSize ? { w: Math.round(baseSize.w * zoom), h: Math.round(baseSize.h * zoom) } : null),
    [baseSize, zoom],
  );

  useImperativeHandle(ref, () => ({
    revealRect: (rect) => {
      const box = scrollRef.current;
      const surf = surfaceRef.current;
      if (!box || !surf || !size) return;
      // offsetLeft/Top are measured against the scroll container, which is the
      // nearest positioned ancestor, so this lands the rect dead centre.
      const cx = surf.offsetLeft + (rect.x + rect.w / 2) * size.w;
      const cy = surf.offsetTop + (rect.y + rect.h / 2) * size.h;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      box.scrollTo({
        left: cx - box.clientWidth / 2,
        top: cy - box.clientHeight / 2,
        behavior: reduced ? "auto" : "smooth",
      });
    },
  }), [size]);

  const fitWidth = useCallback(() => {
    const box = scrollRef.current;
    if (!box || !baseSize) return;
    setZoom(clamp(Math.min((box.clientWidth - 48) / baseSize.w, maxFitZoom), ZOOM_MIN, ZOOM_MAX));
  }, [baseSize, maxFitZoom]);

  // Fit once the content's natural size is known, and again if the source swaps.
  const fittedFor = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!baseSize) return;
    const key = fitKey ?? "default";
    if (fittedFor.current === key) return;
    fittedFor.current = key;
    fitWidth();
  }, [baseSize, fitKey, fitWidth]);

  // Panning drags the scroll position rather than transforming the surface, so it
  // composes with zoom and keeps the native scrollbars honest.
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onPanDown = (e: React.MouseEvent) => {
    const box = scrollRef.current;
    if (!box) return;
    pan.current = { x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop };
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const box = scrollRef.current;
      if (!pan.current || !box) return;
      box.scrollLeft = pan.current.left - (e.clientX - pan.current.x);
      box.scrollTop = pan.current.top - (e.clientY - pan.current.y);
    };
    const up = () => { pan.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  // Rectangle drawing, tracked in surface pixels and normalized on release.
  const onDrawDown = (e: React.MouseEvent) => {
    if (tool !== "comment" || e.button !== 0) return;
    e.preventDefault();
    const el = surfaceRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    setDrawing({ from: p, to: p });
  };
  useEffect(() => {
    if (!drawing) return;
    const move = (e: MouseEvent) => {
      const el = surfaceRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDrawing((d) => (d ? { ...d, to: { x: e.clientX - r.left, y: e.clientY - r.top } } : d));
    };
    const up = () => {
      // Read `drawing` from the closure rather than a state updater: the updater
      // has to stay pure, and onDraft sets state on the parent.
      if (size) {
        const far = Math.abs(drawing.to.x - drawing.from.x) > MIN_DRAG_PX && Math.abs(drawing.to.y - drawing.from.y) > MIN_DRAG_PX;
        if (far) onDraft({ page, rect: rectFromDrag(drawing.from, drawing.to, size.w, size.h) });
      }
      setDrawing(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drawing, size, page, onDraft]);

  // Cmd/ctrl + wheel zooms, matching every other document viewer.
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => clamp(z - e.deltaY * 0.002, ZOOM_MIN, ZOOM_MAX));
  };

  const pageBoxes = boxes.filter((b) => b.page === page);
  const style = (r: NormalizedRect): React.CSSProperties => ({
    left: `${r.x * (size?.w ?? 0)}px`,
    top: `${r.y * (size?.h ?? 0)}px`,
    width: `${r.w * (size?.w ?? 0)}px`,
    height: `${r.h * (size?.h ?? 0)}px`,
  });

  return (
    <div className="surface flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-1">{leading}</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => setZoom((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}><ZoomOut /></Button>
          <span className="tabular w-10 text-center text-2xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon-xs" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => setZoom((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}><ZoomIn /></Button>
          <Button variant="ghost" size="icon-xs" aria-label="Fit width" onClick={fitWidth}><Maximize2 /></Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button variant={tool === "comment" ? "secondary" : "ghost"} size="xs" aria-pressed={tool === "comment"} onClick={() => setTool("comment")}><SquareDashed />Comment</Button>
          <Button variant={tool === "pan" ? "secondary" : "ghost"} size="xs" aria-pressed={tool === "pan"} onClick={() => setTool("pan")}><Hand />Pan</Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onWheel={onWheel}
        onMouseDown={tool === "pan" ? onPanDown : undefined}
        className={cn(
          "scrollbar-thin relative max-h-[calc(100vh-220px)] min-h-[420px] overflow-auto bg-muted/40 p-6",
          tool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair",
        )}
      >
        {status}
        {!status && size && (
          <div ref={surfaceRef} onMouseDown={onDrawDown} className="relative mx-auto w-fit shadow-float">
            {children(size)}
            <div className="pointer-events-none absolute inset-0">
              {pageBoxes.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-label={`Comment region ${b.id}`}
                  onMouseEnter={() => onHoverBox(b.id)}
                  onMouseLeave={() => onHoverBox(null)}
                  onClick={(e) => { e.stopPropagation(); onSelectBox(b.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    ...style(b.rect),
                    borderColor: b.color,
                    // A tint alone reads as noise over busy content, so the active
                    // box also gets a halo in its own colour.
                    background: activeId === b.id ? `${b.color}33` : `${b.color}0f`,
                    boxShadow: activeId === b.id ? `0 0 0 4px ${b.color}44` : undefined,
                  }}
                  className={cn(
                    "pointer-events-auto absolute rounded-sm border-2 transition-all",
                    activeId === b.id ? "opacity-100" : "opacity-70 hover:opacity-100",
                    b.resolved && "border-dashed opacity-40",
                  )}
                >
                  <span
                    style={{ background: b.color }}
                    className="tabular absolute -left-px -top-px rounded-br-sm rounded-tl-[1px] px-1 font-mono text-[10px] font-semibold leading-[14px] text-white"
                  >
                    {b.index}
                  </span>
                </button>
              ))}
              {draft && draft.page === page && (
                <div style={style(draft.rect)} className="absolute rounded-sm border-2 border-dashed border-brand bg-brand/10" />
              )}
              {drawing && (
                <div style={style(rectFromDrag(drawing.from, drawing.to, size.w, size.h))} className="absolute rounded-sm border-2 border-brand bg-brand/10" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
