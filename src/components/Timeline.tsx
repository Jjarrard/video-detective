import { useEffect, useRef, useState } from "react";
import type { SavedFrame } from "../types";
import { formatTime } from "../util";

type Props = {
  duration: number;
  time: number;
  frames: SavedFrame[];
  onSeek: (t: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  onPickFrame: (f: SavedFrame) => void;
};

const NICE_STEPS = [
  0.04, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600,
];

function tickStep(viewDur: number) {
  const target = viewDur / 8;
  return NICE_STEPS.find((s) => s >= target) ?? NICE_STEPS[NICE_STEPS.length - 1];
}

export default function Timeline({
  duration,
  time,
  frames,
  onSeek,
  onScrubStart,
  onScrubEnd,
  onPickFrame,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [start, setStart] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<null | { mode: "scrub" | "pan"; x: number; start: number }>(null);

  const dur = duration || 1;
  const viewDur = dur / zoom;
  const clampStart = (s: number) => Math.min(Math.max(0, s), Math.max(0, dur - viewDur));
  const viewStart = clampStart(start);

  // follow the playhead when it leaves the zoomed window
  useEffect(() => {
    if (zoom === 1) return;
    if (time < viewStart || time > viewStart + viewDur) {
      setStart(clampStart(time - viewDur / 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, zoom]);

  const frac = (t: number) => (t - viewStart) / viewDur;
  const timeAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return viewStart + f * viewDur;
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = trackRef.current!.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    const anchor = viewStart + f * viewDur;
    const next = Math.min(400, Math.max(1, zoom * Math.exp(-e.deltaY * 0.0025)));
    const nextDur = dur / next;
    setZoom(next);
    setStart(Math.min(Math.max(0, anchor - f * nextDur), Math.max(0, dur - nextDur)));
  };

  const step = tickStep(viewDur);
  const ticks: number[] = [];
  for (let t = Math.ceil(viewStart / step) * step; t <= viewStart + viewDur; t += step) {
    ticks.push(t);
  }

  return (
    <div className="timeline">
      <div className="timeline-head">
        <span className="mono">{formatTime(time, true)}</span>
        <span className="sep">/</span>
        <span className="mono dim">{formatTime(duration)}</span>
        <div className="spacer" />
        <label className="zoom">
          zoom
          <input
            type="range"
            min={0}
            max={100}
            value={(Math.log(zoom) / Math.log(400)) * 100}
            onChange={(e) => {
              const z = Math.exp((Number(e.target.value) / 100) * Math.log(400));
              setStart(clampStart(time - dur / z / 2));
              setZoom(z);
            }}
          />
          <span className="mono dim">{zoom.toFixed(1)}×</span>
        </label>
        <button className="ghost" onClick={() => { setZoom(1); setStart(0); }}>
          reset
        </button>
      </div>

      <div
        ref={trackRef}
        className="track"
        onWheel={onWheel}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          if (e.shiftKey || e.button === 1) {
            dragging.current = { mode: "pan", x: e.clientX, start: viewStart };
          } else {
            dragging.current = { mode: "scrub", x: e.clientX, start: viewStart };
            onScrubStart();
            onSeek(timeAt(e.clientX));
          }
        }}
        onPointerMove={(e) => {
          const d = dragging.current;
          if (!d) return;
          if (d.mode === "pan") {
            const r = trackRef.current!.getBoundingClientRect();
            setStart(clampStart(d.start - ((e.clientX - d.x) / r.width) * viewDur));
          } else {
            onSeek(timeAt(e.clientX));
          }
        }}
        onPointerUp={() => {
          if (dragging.current?.mode === "scrub") onScrubEnd();
          dragging.current = null;
        }}
      >
        {ticks.map((t) => (
          <div key={t} className="tick" style={{ left: `${frac(t) * 100}%` }}>
            <span className="mono">{formatTime(t, step < 1)}</span>
          </div>
        ))}

        {frames.map((f) => {
          const x = frac(f.time);
          if (x < -0.02 || x > 1.02) return null;
          return (
            <button
              key={f.id}
              className="marker"
              title={`Saved frame @ ${formatTime(f.time, true)}`}
              style={{ left: `${x * 100}%` }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onPickFrame(f)}
            />
          );
        })}

        <div className="playhead" style={{ left: `${frac(time) * 100}%` }} />
      </div>
      <div className="hint">scroll to zoom · drag to scrub · shift-drag to pan</div>
    </div>
  );
}
