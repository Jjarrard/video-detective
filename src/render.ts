import type { Stroke } from "./types";

/** Paint strokes onto a context whose drawing area is w x h pixels. */
export function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  w: number,
  h: number,
) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    if (s.points.length === 0) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.size * w);
    ctx.beginPath();
    if (s.points.length === 1) {
      // a tap: draw a dot
      const p = s.points[0];
      ctx.arc(p.x * w, p.y * h, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      continue;
    }
    ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i].x * w, s.points[i].y * h);
    }
    ctx.stroke();
  }
}

/** Fallback thumbnail for sources whose pixels can't be read back (YouTube):
 *  the drawing alone on a dark card, at the video's aspect ratio. */
export function renderAnnotationThumb(strokes: Stroke[], aspect = 16 / 9): string {
  const w = 640;
  const h = Math.round(w / (aspect || 16 / 9));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#14161c";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  paintStrokes(ctx, strokes, w, h);
  return cv.toDataURL("image/png");
}
