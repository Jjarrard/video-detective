import type { SavedFrame } from "../types";
import { formatTime } from "../util";

type Props = {
  frames: SavedFrame[];
  time: number;
  canSave: boolean;
  onSave: () => void;
  onJump: (f: SavedFrame) => void;
  onDelete: (id: string) => void;
  onNote: (id: string, note: string) => void;
  onExport: (f: SavedFrame) => void;
};

export default function Sidebar(p: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <button className="primary" disabled={!p.canSave} onClick={p.onSave}>
          Save frame <span className="mono dim">{formatTime(p.time, true)}</span>
        </button>
      </div>

      <div className="frames">
        {p.frames.length === 0 && (
          <p className="empty">
            Pause, draw on the frame, then hit <b>Save frame</b>. Saved frames land here,
            timestamped.
          </p>
        )}
        {p.frames.map((f) => (
          <div key={f.id} className="frame-card">
            <button className="thumb" onClick={() => p.onJump(f)} title="Jump to this frame">
              <img src={f.thumb} alt={`frame at ${formatTime(f.time)}`} />
              <span className="stamp mono">{formatTime(f.time, true)}</span>
              {!f.hasPixels && <span className="badge">drawing only</span>}
            </button>
            <input
              className="note"
              placeholder="note…"
              value={f.note}
              onChange={(e) => p.onNote(f.id, e.target.value)}
            />
            <div className="card-actions">
              <button className="ghost" onClick={() => p.onExport(f)}>
                export
              </button>
              <button className="ghost danger" onClick={() => p.onDelete(f.id)}>
                delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
