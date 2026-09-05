import { useCallback, useEffect, useRef, useState } from "react";
import type { SavedFrame, Source, Stroke } from "./types";
import type { YTPlayer } from "./youtube";
import { formatTime, uid } from "./util";
import { paintStrokes, renderAnnotationThumb } from "./render";
import VideoStage from "./components/VideoStage";
import Palette from "./components/Palette";
import { COLORS } from "./constants";
import Timeline from "./components/Timeline";
import Sidebar from "./components/Sidebar";
import SourcePicker from "./components/SourcePicker";

export default function App() {
  const [source, setSource] = useState<Source | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(6);
  const [drawing, setDrawing] = useState(true);

  const [frames, setFrames] = useState<SavedFrame[]>([]);
  const [aspect, setAspect] = useState(16 / 9);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytRef = useRef<YTPlayer | null>(null);
  const resumeAfterScrub = useRef(false);
  const pendingSeek = useRef<number | null>(null);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    ytRef.current?.pauseVideo();
  }, []);

  /* Leaving a frame discards its unsaved drawing — an annotation belongs to the
     frame it was drawn on, so the next frame starts on a clean canvas. */
  const play = useCallback(() => {
    setStrokes([]);
    videoRef.current?.play();
    ytRef.current?.playVideo();
  }, []);

  const seek = useCallback((t: number) => {
    const clamped = Math.max(0, t);
    setStrokes([]);
    if (videoRef.current) videoRef.current.currentTime = clamped;
    ytRef.current?.seekTo(clamped, true);
    setTime(clamped);
  }, []);

  const nudge = useCallback(
    (dt: number) => {
      pause();
      seek(Math.min(duration || Infinity, Math.max(0, time + dt)));
    },
    [duration, pause, seek, time],
  );

  // --- keyboard ----------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setStrokes((s) => s.slice(0, -1));
        return;
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (playing) pause();
          else play();
          break;
        case "ArrowLeft":
          nudge(e.shiftKey ? -1 / 30 : -1);
          break;
        case "ArrowRight":
          nudge(e.shiftKey ? 1 / 30 : 1);
          break;
        case "b":
        case "B":
          setDrawing((d) => !d);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, pause, play, nudge]);

  // --- saving a frame ----------------------------------------------------
  const captureThumb = (): { thumb: string; hasPixels: boolean } => {
    const v = videoRef.current;
    if (v && v.videoWidth) {
      const cv = document.createElement("canvas");
      cv.width = v.videoWidth;
      cv.height = v.videoHeight;
      const ctx = cv.getContext("2d");
      if (ctx) {
        try {
          ctx.drawImage(v, 0, 0, cv.width, cv.height);
          paintStrokes(ctx, strokes, cv.width, cv.height);
          return { thumb: cv.toDataURL("image/jpeg", 0.85), hasPixels: true };
        } catch {
          // tainted canvas (cross-origin video served without CORS headers)
        }
      }
    }
    return { thumb: renderAnnotationThumb(strokes, aspect), hasPixels: false };
  };

  const saveFrame = () => {
    pause();
    const f: SavedFrame = {
      id: uid(),
      time,
      createdAt: Date.now(),
      ...captureThumb(),
      strokes,
      note: "",
    };
    setFrames((prev) => [f, ...prev].sort((a, b) => a.time - b.time));
    setStrokes([]);
  };

  const jumpTo = (f: SavedFrame) => {
    pause();
    seek(f.time);
    setStrokes(f.strokes);
  };

  const exportFrame = (f: SavedFrame) => {
    const a = document.createElement("a");
    a.href = f.thumb;
    a.download = `frame-${formatTime(f.time, true).replace(/[:.]/g, "-")}.${f.hasPixels ? "jpg" : "png"}`;
    a.click();
  };

  if (!source) return <SourcePicker onSource={setSource} />;

  return (
    <div className="app">
      <header className="topbar">
        <strong>Video Detective</strong>
        <span className="dim ellipsis">{source.name}</span>
        <div className="spacer" />
        {source.kind === "url" && source.options && source.options.length > 1 && (
          <select
            className="quality"
            value={source.url}
            title="Stream quality"
            onChange={(e) => {
              pendingSeek.current = time;
              setSource({ ...source, url: e.target.value });
            }}
          >
            {source.options.map((o) => (
              <option key={o.url} value={o.url}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <button
          className="ghost"
          onClick={() => {
            setSource(null);
            setFrames([]);
            setStrokes([]);
            setDuration(0);
            setTime(0);
          }}
        >
          change video
        </button>
      </header>

      <main className="main">
        <div className="video-col">
          <div className="stage-wrap">
          <VideoStage
            source={source}
            videoRef={videoRef}
            ytRef={ytRef}
            strokes={strokes}
            color={color}
            size={size / 1000}
            drawing={drawing}
            playing={playing}
            onStrokeStart={pause}
            onStrokeCommit={(s) => setStrokes((prev) => [...prev, s])}
            onTime={setTime}
            onDuration={(d) => {
              setDuration(d);
              if (pendingSeek.current != null) {
                seek(pendingSeek.current);
                pendingSeek.current = null;
              }
            }}
            onPlaying={setPlaying}
            onAspect={setAspect}
          />
          <Palette
            color={color}
            size={size}
            drawing={drawing}
            canUndo={strokes.length > 0}
            onColor={setColor}
            onSize={setSize}
            onToggleDraw={() => setDrawing((d) => !d)}
            onUndo={() => setStrokes((s) => s.slice(0, -1))}
            onClear={() => setStrokes([])}
          />
          </div>

          <div className="transport">
            <button className="ghost" onClick={() => nudge(-1)} title="Back 1s (←)">
              «
            </button>
            <button className="ghost" onClick={() => nudge(-1 / 30)} title="Previous frame (⇧←)">
              ‹
            </button>
            <button
              className="primary play"
              onClick={() => {
                if (playing) pause();
                else play();
              }}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button className="ghost" onClick={() => nudge(1 / 30)} title="Next frame (⇧→)">
              ›
            </button>
            <button className="ghost" onClick={() => nudge(1)} title="Forward 1s (→)">
              »
            </button>
          </div>
        </div>

        <Sidebar
          frames={frames}
          time={time}
          canSave={!!source}
          onSave={saveFrame}
          onJump={jumpTo}
          onDelete={(id) => setFrames((f) => f.filter((x) => x.id !== id))}
          onNote={(id, note) =>
            setFrames((f) => f.map((x) => (x.id === id ? { ...x, note } : x)))
          }
          onExport={exportFrame}
        />
      </main>

      <Timeline
        duration={duration}
        time={time}
        frames={frames}
        onSeek={seek}
        onScrubStart={() => {
          resumeAfterScrub.current = playing;
          pause();
        }}
        onScrubEnd={() => {
          if (resumeAfterScrub.current) play();
        }}
        onPickFrame={jumpTo}
      />
    </div>
  );
}
