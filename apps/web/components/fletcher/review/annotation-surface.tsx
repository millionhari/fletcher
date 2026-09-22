"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Hand, Maximize2, PenLine, SquareDashed, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { PEN_COLORS, strokesBounds, type NormalizedRect, type Stroke } from "@fletcher/core";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type AnnotationBox = { id: string; index: number; page: number; rect: NormalizedRect; color: string; resolved: boolean; strokes?: Stroke[] };
/** A comment being written: a box, or the strokes drawn so far (rect is then their bounds). */
export type AnnotationDraft = { page: number; rect: NormalizedRect; strokes?: Stroke[] };

export interface AnnotationSurfaceHandle {
  /** Scroll the content so a normalized rect sits in the middle of the viewport. */
  revealRect: (rect: NormalizedRect) => void;
}

/** What both the PDF and image viewers expose to the page around them. */
export interface AnnotatedViewerHandle {
  revealAnchor: (page: number, rect: NormalizedRect) => void;
}

// Camera originals run 5–8k px on a side, so the floor has to reach well below 25% for fit-width to be honest.
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 5;
/** Viewer box height range. The floor fits the loading / error message; the ceiling keeps a big display from turning the panel into a wall. */
const BOX_MIN = 320;
const BOX_MAX = 720;
// Multiplicative, so a step is the same size on the eye at 10% as at 200%.
const ZOOM_STEP = 1.25;

/** Drag distance below which a rectangle is treated as a stray click, not a draw. */
const MIN_DRAG_PX = 6;
/** Pen weights in screen pixels at the zoom the stroke is drawn, so what you see is what is kept. */
const PEN_WIDTH_PX = { thin: 2.5, thick: 6 } as const;
type PenWidth = keyof typeof PEN_WIDTH_PX;

/**
 * SVG path through the points, rounded off with quadratic curves between the
 * midpoints — the same trick every sketch app uses to hide the mouse's jitter.
 */
function strokePath(points: [number, number][], w: number, h: number): string {
  const px = points.map(([x, y]) => [x * w, y * h] as const);
  if (px.length === 1) return `M${px[0]![0]} ${px[0]![1]} l0.01 0`;
  let d = `M${px[0]![0]} ${px[0]![1]}`;
  for (let i = 1; i < px.length - 1; i++) {
    const [cx, cy] = px[i]!;
    const [nx, ny] = px[i + 1]!;
    d += ` Q${cx} ${cy} ${(cx + nx) / 2} ${(cy + ny) / 2}`;
  }
  const [lx, ly] = px[px.length - 1]!;
  return d + ` L${lx} ${ly}`;
}

/** Drop points that barely moved, so a stroke is a few dozen nodes rather than one per mouse event. */
function thin(points: { x: number; y: number }[], minDist = 1.5): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= minDist) out.push(p);
  }
  return out;
}

function StrokeLayer({ strokes, size, color, dim, glow }: { strokes: Stroke[]; size: { w: number; h: number }; color?: string; dim?: boolean; glow?: boolean }) {
  return (
    <svg width={size.w} height={size.h} className="pointer-events-none absolute inset-0 overflow-visible" style={glow ? { filter: `drop-shadow(0 0 3px ${color ?? strokes[0]?.color}88)` } : undefined}>
      {strokes.map((st, i) => (
        <path key={i} d={strokePath(st.points, size.w, size.h)} fill="none" stroke={color ?? st.color} strokeWidth={Math.max(1, st.width * size.w)} strokeLinecap="round" strokeLinejoin="round" opacity={dim ? 0.35 : 0.95} />
      ))}
    </svg>
  );
}

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
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState<PenWidth>("thin");
  const [showMarkup, setShowMarkup] = useState(true);
  // The stroke under the mouse, in surface pixels; committed to the draft on
  // release. The ref is the source of truth while drawing (read by listeners
  // that must not re-bind per mouse move); the state only drives rendering.
  const [live, setLive] = useState<{ x: number; y: number }[] | null>(null);
  const liveRef = useRef<{ x: number; y: number }[] | null>(null);

  const [tool, setTool] = useState<"comment" | "draw" | "pan">("comment");
  const [drawing, setDrawing] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);

  // Memoized: it is a dependency of both the reveal handle and the draw effect,
  // and a fresh object each render would rebuild them continuously.
  const size = useMemo(
    () => (baseSize ? { w: Math.round(baseSize.w * zoom), h: Math.round(baseSize.h * zoom) } : null),
    [baseSize, zoom],
  );
  const latest = useRef({ draft, size, page, penColor, penWidth, onDraft });
  useEffect(() => { latest.current = { draft, size, page, penColor, penWidth, onDraft }; });

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

  // The box takes the height the content needs at its fitted zoom (capped to
  // the window) and then keeps it: zooming changes what is inside, never the
  // panel or the comment rail beside it.
  const [boxHeight, setBoxHeight] = useState<number | null>(null);
  const fitWidth = useCallback(() => {
    const box = scrollRef.current;
    if (!box || !baseSize) return;
    const z = clamp(Math.min((box.clientWidth - 48) / baseSize.w, maxFitZoom), ZOOM_MIN, ZOOM_MAX);
    setZoom(z);
    // Never run past the bottom of the window: the whole panel should be on screen without scrolling the page.
    const room = window.innerHeight - box.getBoundingClientRect().top - 24;
    setBoxHeight(clamp(Math.round(baseSize.h * z) + 48, BOX_MIN, Math.min(BOX_MAX, Math.max(BOX_MIN, room))));
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
    if (e.button !== 0) return;
    const el = surfaceRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (tool === "comment") {
      e.preventDefault();
      setDrawing({ from: p, to: p });
    } else if (tool === "draw") {
      e.preventDefault();
      liveRef.current = [p];
      setLive([p]);
    }
  };

  // Freehand: every stroke is appended to the draft, so one comment can carry a
  // whole sketch; the draft's rect is always the bounds of what has been drawn.
  const isDrawing = live !== null;
  useEffect(() => {
    if (!isDrawing) return;
    const move = (e: MouseEvent) => {
      const el = surfaceRef.current;
      if (!el || !liveRef.current) return;
      const r = el.getBoundingClientRect();
      liveRef.current = [...liveRef.current, { x: e.clientX - r.left, y: e.clientY - r.top }];
      setLive(liveRef.current);
    };
    const up = () => {
      const { draft, size, page, penColor, penWidth, onDraft } = latest.current;
      if (size && liveRef.current) {
        const pts = thin(liveRef.current).map(({ x, y }) => [clamp(x / size.w, 0, 1), clamp(y / size.h, 0, 1)] as [number, number]);
        const stroke: Stroke = { points: pts, color: penColor, width: PEN_WIDTH_PX[penWidth] / size.w };
        const strokes = [...(draft?.page === page ? draft.strokes ?? [] : []), stroke];
        onDraft({ page, rect: strokesBounds(strokes), strokes });
      }
      liveRef.current = null;
      setLive(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [isDrawing]);

  const undoStroke = () => {
    const strokes = (draft?.strokes ?? []).slice(0, -1);
    onDraft(strokes.length ? { page, rect: strokesBounds(strokes), strokes } : null);
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
    setZoom((z) => clamp(z * Math.exp(-e.deltaY * 0.005), ZOOM_MIN, ZOOM_MAX));
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
          <Button variant="ghost" size="icon-xs" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => setZoom((z) => clamp(z / ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}><ZoomOut /></Button>
          <span className="tabular w-10 text-center text-2xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon-xs" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => setZoom((z) => clamp(z * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}><ZoomIn /></Button>
          <Button variant="ghost" size="icon-xs" aria-label="Fit width" onClick={fitWidth}><Maximize2 /></Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button variant={tool === "comment" ? "secondary" : "ghost"} size="xs" aria-pressed={tool === "comment"} onClick={() => setTool("comment")}><SquareDashed />Box</Button>
          <Button variant={tool === "draw" ? "secondary" : "ghost"} size="xs" aria-pressed={tool === "draw"} onClick={() => setTool("draw")}><PenLine />Draw</Button>
          <Button variant={tool === "pan" ? "secondary" : "ghost"} size="xs" aria-pressed={tool === "pan"} onClick={() => setTool("pan")}><Hand />Pan</Button>
          {tool === "draw" && (
            <div className="fade-in-up ml-1 flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
              {PEN_COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Pen colour ${c}`} aria-pressed={penColor === c} onClick={() => setPenColor(c)} style={{ background: c }} className={cn("size-4 rounded-full transition-transform", penColor === c ? "scale-110 ring-2 ring-background ring-offset-1 ring-offset-foreground/60" : "opacity-70 hover:opacity-100")} />
              ))}
              <span className="mx-0.5 h-3 w-px bg-border" />
              {(["thin", "thick"] as const).map((w) => (
                <button key={w} type="button" aria-label={`${w} pen`} aria-pressed={penWidth === w} onClick={() => setPenWidth(w)} className={cn("flex size-5 items-center justify-center rounded", penWidth === w ? "bg-background shadow-hairline" : "opacity-60 hover:opacity-100")}>
                  <span className="rounded-full bg-foreground" style={{ width: 10, height: w === "thin" ? 2 : 5 }} />
                </button>
              ))}
              {(draft?.strokes?.length ?? 0) > 0 && <Button variant="ghost" size="icon-xs" aria-label="Undo last stroke" onClick={undoStroke}><Undo2 /></Button>}
            </div>
          )}
          <span className="mx-1 h-4 w-px bg-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label={showMarkup ? "Hide markup" : "Show markup"} aria-pressed={!showMarkup} onClick={() => setShowMarkup((v) => !v)} className={cn(!showMarkup && "text-brand")}>{showMarkup ? <Eye /> : <EyeOff />}</Button>
            </TooltipTrigger>
            <TooltipContent>{showMarkup ? "Hide all markup" : "Show markup"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{ height: boxHeight ?? undefined }}
        onWheel={onWheel}
        onMouseDown={tool === "pan" ? onPanDown : undefined}
        className={cn(
          // A fixed viewport: zooming changes what is inside it, never the panel
          // (or the comment rail beside it). `flex` + `m-auto` on the surface
          // centres small content and still scrolls from the top-left corner
          // when the content is bigger than the box.
          "scrollbar-thin relative flex min-h-[320px] overflow-auto bg-muted/40 p-6",
          tool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair",
          tool === "draw" && "select-none",
        )}
      >
        {status}
        {!status && size && (
          <div ref={surfaceRef} onMouseDown={onDrawDown} className="relative m-auto w-max shrink-0 shadow-float">
            {children(size)}
            <div className={cn("pointer-events-none absolute inset-0 transition-opacity", !showMarkup && "opacity-0")}>
              {showMarkup && pageBoxes.filter((b) => b.strokes?.length).map((b) => (
                <StrokeLayer key={`s-${b.id}`} strokes={b.strokes!} size={size} dim={b.resolved} glow={activeId === b.id} />
              ))}
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
                    borderColor: b.strokes ? (activeId === b.id ? `${b.color}66` : "transparent") : b.color,
                    // A tint alone reads as noise over busy content, so the active
                    // box also gets a halo in its own colour. A drawing is its own
                    // outline; its hit area only shows a faint frame while active.
                    background: b.strokes ? "transparent" : activeId === b.id ? `${b.color}33` : `${b.color}0f`,
                    boxShadow: !b.strokes && activeId === b.id ? `0 0 0 4px ${b.color}44` : undefined,
                  }}
                  className={cn(
                    "pointer-events-auto absolute rounded-sm border-2 transition-all",
                    b.strokes ? "border-dashed" : activeId === b.id ? "opacity-100" : "opacity-70 hover:opacity-100",
                    b.resolved && !b.strokes && "border-dashed opacity-40",
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
              {draft && draft.page === page && !draft.strokes && (
                <div style={style(draft.rect)} className="absolute rounded-sm border-2 border-dashed border-brand bg-brand/10" />
              )}
              {draft && draft.page === page && draft.strokes && <StrokeLayer strokes={draft.strokes} size={size} />}
              {live && <StrokeLayer strokes={[{ points: live.map(({ x, y }) => [x / size.w, y / size.h] as [number, number]), color: penColor, width: PEN_WIDTH_PX[penWidth] / size.w }]} size={size} />}
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
