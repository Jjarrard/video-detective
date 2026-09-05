import { useRef, useState } from "react";

import { COLORS } from "../constants";

type Props = {
  color: string;
  size: number;
  drawing: boolean;
  canUndo: boolean;
  onColor: (c: string) => void;
  onSize: (s: number) => void;
  onToggleDraw: () => void;
  onUndo: () => void;
  onClear: () => void;
};

/** Floating, draggable colour palette. Position is relative to the stage. */
export default function Palette(p: Props) {
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const drag = useRef<null | { dx: number; dy: number }>(null);

  return (
    <div className="palette" style={{ left: pos.x, top: pos.y }}>
      <div
        className="grip"
        title="Drag me"
        onPointerDown={(e) => {
          const el = e.currentTarget.parentElement!;
          const r = el.getBoundingClientRect();
          drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const host = e.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
          setPos({
            x: Math.max(0, e.clientX - host.left - d.dx),
            y: Math.max(0, e.clientY - host.top - d.dy),
          });
        }}
        onPointerUp={() => (drag.current = null)}
      >
        ⠿
      </div>

      <button
        className={`tool ${p.drawing ? "on" : ""}`}
        title="Brush (B) — toggles drawing mode"
        onClick={p.onToggleDraw}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          <path
            d="M2 14l1-3.5L10.5 3 13 5.5 5.5 13 2 14z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="swatches">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`swatch ${c === p.color ? "on" : ""}`}
            style={{ background: c }}
            title={c}
            onClick={() => {
              p.onColor(c);
              if (!p.drawing) p.onToggleDraw();
            }}
          />
        ))}
      </div>

      <input
        className="size"
        type="range"
        min={1}
        max={40}
        value={p.size}
        title="Brush size"
        onChange={(e) => p.onSize(Number(e.target.value))}
      />
      <span className="dot-preview" style={{ width: p.size / 2 + 4, height: p.size / 2 + 4, background: p.color }} />

      <button className="tool" title="Undo (⌘Z)" disabled={!p.canUndo} onClick={p.onUndo}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          <path
            d="M5.5 4.5L2.5 7l3 2.5M2.5 7h7a3.5 3.5 0 010 7H7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button className="tool" title="Clear drawing" disabled={!p.canUndo} onClick={p.onClear}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          <path
            d="M4 4l8 8M12 4l-8 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
