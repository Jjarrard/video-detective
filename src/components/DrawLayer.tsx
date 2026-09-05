import { useEffect, useRef } from "react";
import type { Point, Stroke } from "../types";
import { paintStrokes } from "../render";
import { uid } from "../util";

type Props = {
  strokes: Stroke[];
  color: string;
  size: number;
  active: boolean;
  onStrokeStart: () => void;
  onStrokeCommit: (s: Stroke) => void;
};

/** Transparent canvas laid over the video. Draws committed strokes plus the
 *  in-progress one; the in-progress stroke lives in a ref so dragging never
 *  round-trips through React state. */
export default function DrawLayer({
  strokes,
  color,
  size,
  active,
  onStrokeStart,
  onStrokeCommit,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const strokesRef = useRef(strokes);

  const repaint = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = cv;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const cw = w / devicePixelRatio;
    const ch = h / devicePixelRatio;
    paintStrokes(ctx, strokesRef.current, cw, ch);
    if (drawing.current) paintStrokes(ctx, [drawing.current], cw, ch);
    ctx.restore();
  };

  // keep the backing store in step with the element's layout size
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ro = new ResizeObserver(() => {
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width * devicePixelRatio));
      cv.height = Math.max(1, Math.round(r.height * devicePixelRatio));
      repaint();
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    strokesRef.current = strokes;
    repaint();
  }, [strokes]);

  const toNorm = (e: React.PointerEvent): Point => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  return (
    <canvas
      ref={canvasRef}
      className="draw-layer"
      style={{ pointerEvents: active ? "auto" : "none", cursor: active ? "crosshair" : "default" }}
      onPointerDown={(e) => {
        if (!active || e.button !== 0) return;
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        onStrokeStart();
        drawing.current = { id: uid(), color, size, points: [toNorm(e)] };
        repaint();
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        drawing.current.points.push(toNorm(e));
        repaint();
      }}
      onPointerUp={() => {
        const s = drawing.current;
        drawing.current = null;
        if (s) onStrokeCommit(s);
        repaint();
      }}
      onPointerCancel={() => {
        drawing.current = null;
        repaint();
      }}
    />
  );
}
