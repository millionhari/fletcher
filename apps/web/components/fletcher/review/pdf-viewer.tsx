"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { NormalizedRect } from "@fletcher/core";
import { Button } from "@/components/ui/button";
import { AnnotationSurface, type AnnotatedViewerHandle, type AnnotationBox, type AnnotationDraft, type AnnotationSurfaceHandle } from "@/components/fletcher/review/annotation-surface";

/**
 * PDF review surface. Paging and page rendering live here; zoom, pan, the
 * rectangle tool and the comment boxes all come from AnnotationSurface, which
 * the image viewer shares.
 */
export const PdfViewer = forwardRef<AnnotatedViewerHandle, {
  url: string;
  boxes: AnnotationBox[];
  activeId: string | null;
  draft: AnnotationDraft | null;
  onHoverBox: (id: string | null) => void;
  onSelectBox: (id: string) => void;
  onDraft: (draft: AnnotationDraft | null) => void;
}>(function PdfViewer({ url, boxes, activeId, draft, onHoverBox, onSelectBox, onDraft }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  // destroy() lives on the loading task, not the document — keep it to tear the
  // worker and its in-flight requests down on unmount.
  const loadTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [baseSize, setBaseSize] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const surfaceRef = useRef<AnnotationSurfaceHandle>(null);
  const [pendingReveal, setPendingReveal] = useState<NormalizedRect | null>(null);

  useImperativeHandle(ref, () => ({
    revealAnchor: (p, rect) => {
      if (p >= 1 && p <= numPages) setPage(p);
      setPendingReveal(rect);
    },
  }), [numPages]);

  // Scrolling waits for the target page to report its size, otherwise the offsets
  // are still those of the page we were on. The effect runs after the DOM is
  // updated, so measuring here is safe — and unlike requestAnimationFrame it
  // still runs when the window is backgrounded or occluded.
  useEffect(() => {
    if (!pendingReveal || !baseSize) return;
    surfaceRef.current?.revealRect(pendingReveal);
    setPendingReveal(null);
  }, [pendingReveal, baseSize, page]);

  // Load the document once. pdfjs is browser-only and heavy, so it is pulled in
  // lazily and its worker is started through the bundler-aware Worker + URL pair.
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(
          new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
          { type: "module" },
        );
        task = pdfjs.getDocument({ url, withCredentials: false });
        loadTaskRef.current = task;
        const doc = await task.promise;
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPage(1);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not open this PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      docRef.current = null;
      loadTaskRef.current = null;
      void task?.destroy();
    };
  }, [url]);

  // The page's natural size at 100%, which the surface then scales by its zoom.
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || numPages === 0) return;
    let cancelled = false;
    void (async () => {
      const pdfPage = await doc.getPage(page);
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      setBaseSize({ w: base.width, h: base.height });
    })();
    return () => { cancelled = true; };
  }, [page, numPages]);

  return (
    <AnnotationSurface
      ref={surfaceRef}
      baseSize={baseSize}
      page={page}
      boxes={boxes}
      activeId={activeId}
      draft={draft}
      onHoverBox={onHoverBox}
      onSelectBox={onSelectBox}
      onDraft={onDraft}
      fitKey={url}
      status={
        loading ? <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading document…</div>
        : error ? <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-destructive">{error}</div>
        : null
      }
      leading={
        <>
          <Button variant="ghost" size="icon-xs" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft /></Button>
          <span className="tabular px-1 text-2xs text-muted-foreground">
            <input
              aria-label="Page number"
              value={page}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                if (n >= 1 && n <= numPages) setPage(n);
              }}
              className="tabular w-7 rounded border border-transparent bg-transparent text-center text-2xs text-foreground hover:border-border focus:border-border focus:outline-none"
            />
            {" / "}{numPages || "—"}
          </span>
          <Button variant="ghost" size="icon-xs" aria-label="Next page" disabled={page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))}><ChevronRight /></Button>
        </>
      }
    >
      {(size) => (
        <PdfPageCanvas
          ref={canvasRef}
          size={size}
          page={page}
          doc={docRef}
          renderTask={renderTaskRef}
          baseWidth={baseSize?.w ?? 0}
          onError={setError}
        />
      )}
    </AnnotationSurface>
  );
});

/**
 * Draws the page into a canvas sized by the surface. Kept separate so the
 * imperative render runs from an effect rather than during the parent's render.
 */
const PdfPageCanvas = forwardRef<HTMLCanvasElement, {
  size: { w: number; h: number };
  page: number;
  doc: React.RefObject<PDFDocumentProxy | null>;
  renderTask: React.RefObject<RenderTask | null>;
  baseWidth: number;
  onError: (message: string) => void;
}>(function PdfPageCanvas({ size, page, doc, renderTask, baseWidth, onError }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => canvasRef.current!, []);

  useEffect(() => {
    const pdf = doc.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || !baseWidth) return;
    let cancelled = false;
    void (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const viewport = pdfPage.getViewport({ scale: size.w / baseWidth });
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        renderTask.current?.cancel();
        const task = pdfPage.render({ canvas, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
        renderTask.current = task;
        await task.promise;
      } catch (e) {
        // A cancelled render is the expected outcome of paging or zooming quickly.
        if ((e as { name?: string })?.name !== "RenderingCancelledException" && !cancelled) {
          onError(e instanceof Error ? e.message : "Could not render this page.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [size.w, size.h, page, baseWidth, doc, renderTask, onError]);

  return <canvas ref={canvasRef} className="block rounded-sm bg-white" style={{ width: size.w, height: size.h }} />;
});
