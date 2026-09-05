import { useState } from "react";
import type { Source, StreamOption } from "../types";
import { parseYouTubeId } from "../util";

export default function SourcePicker({ onSource }: { onSource: (s: Source) => void }) {
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  const submit = async () => {
    const v = url.trim();
    if (!v) return;
    setErr("");
    setFallback(null);

    const yt = parseYouTubeId(v);
    if (yt) {
      // Resolve to a real mp4 through the dev server so the video plays in a
      // plain <video>: no YouTube chrome, and frames stay canvas-readable.
      setBusy(true);
      try {
        const res = await fetch(`/api/resolve?url=${encodeURIComponent(v)}`);
        const json = (await res.json()) as
          | { title: string; options: StreamOption[] }
          | { error: string };
        if (!res.ok || "error" in json) throw new Error(("error" in json && json.error) || "failed");
        onSource({
          kind: "url",
          url: json.options[0].url,
          name: json.title,
          options: json.options,
        });
      } catch (e) {
        setErr(`Couldn't fetch that video's stream — ${(e as Error).message}`);
        setFallback(yt);
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      new URL(v);
    } catch {
      return setErr("That isn't a URL or a YouTube link.");
    }
    onSource({ kind: "url", url: v, name: v });
  };

  return (
    <div className="picker">
      <h1>Video Detective</h1>
      <p className="lede">Scrub, pause, draw on frames, keep a timestamped log.</p>

      <label className="drop">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSource({ kind: "file", url: URL.createObjectURL(f), name: f.name });
          }}
        />
        <span>Choose a video file</span>
      </label>

      <div className="or">or</div>

      <div className="url-row">
        <input
          value={url}
          placeholder="YouTube link, or a direct .mp4 URL"
          disabled={busy}
          onChange={(e) => {
            setUrl(e.target.value);
            setErr("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="primary" onClick={submit} disabled={busy}>
          {busy ? "Fetching…" : "Load"}
        </button>
      </div>

      {busy && <p className="fineprint center">Asking yt-dlp for the stream…</p>}
      {err && <p className="err">{err}</p>}
      {fallback && (
        <button
          className="ghost"
          onClick={() => onSource({ kind: "youtube", videoId: fallback, name: url.trim() })}
        >
          Use the embedded YouTube player instead
        </button>
      )}

      <p className="fineprint">
        YouTube links are resolved to a direct stream by yt-dlp and piped through this app's own
        dev server, so the video plays in a plain player: no YouTube overlay, and saved frames
        capture the real picture. If that resolve fails you can fall back to the embedded
        player, which plays and annotates but can't capture frames.
      </p>
    </div>
  );
}
