import { useEffect, useRef, useState, type RefObject } from "react";
import type { Source, Stroke } from "../types";
import { loadYouTubeApi, type YTPlayer } from "../youtube";
import DrawLayer from "./DrawLayer";

type Props = {
  source: Source;
  videoRef: RefObject<HTMLVideoElement | null>;
  ytRef: RefObject<YTPlayer | null>;
  strokes: Stroke[];
  color: string;
  size: number;
  drawing: boolean;
  playing: boolean;
  onStrokeStart: () => void;
  onStrokeCommit: (s: Stroke) => void;
  onTime: (t: number) => void;
  onDuration: (d: number) => void;
  onPlaying: (p: boolean) => void;
  onAspect: (a: number) => void;
};

export default function VideoStage(props: Props) {
  const { source, videoRef, ytRef } = props;
  const [aspect, setAspect] = useState(16 / 9);
  const ytHost = useRef<HTMLDivElement>(null);

  // --- YouTube lifecycle -------------------------------------------------
  useEffect(() => {
    if (source.kind !== "youtube" || !ytHost.current) return;
    let player: YTPlayer | null = null;
    let raf = 0;
    let cancelled = false;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !ytHost.current) return;
      player = new YT.Player(ytHost.current, {
        videoId: source.videoId,
        playerVars: {
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
          },
        events: {
          onReady: (e) => {
            ytRef.current = e.target;
            props.onDuration(e.target.getDuration());
            const tick = () => {
              if (ytRef.current) props.onTime(ytRef.current.getCurrentTime());
              raf = requestAnimationFrame(tick);
            };
            tick();
          },
          onStateChange: (e) => {
            props.onPlaying(e.data === YT.PlayerState.PLAYING);
            if (player) props.onDuration(player.getDuration());
          },
        },
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ytRef.current = null;
      player?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // smooth playhead: timeupdate only fires ~4x/second
  useEffect(() => {
    if (source.kind === "youtube") return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && !v.paused) props.onTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const { onAspect } = props;
  useEffect(() => onAspect(aspect), [aspect, onAspect]);

  const isYT = source.kind === "youtube";

  const togglePlay = () => {
    const v = videoRef.current;
    if (v) {
      if (v.paused) v.play();
      else v.pause();
      return;
    }
    const p = ytRef.current;
    if (!p) return;
    if (props.playing) p.pauseVideo();
    else p.playVideo();
  };

  return (
    <div className="stage">
      <div
        className="frame"
        style={{ aspectRatio: String(aspect), ["--ar" as string]: String(aspect) } as React.CSSProperties}
      >
        {isYT ? (
          <div className="yt-host">
            <div ref={ytHost} />
          </div>
        ) : (
          <video
            ref={videoRef}
            src={source.url}
            className="video"
            playsInline
            crossOrigin="anonymous"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth) setAspect(v.videoWidth / v.videoHeight);
              props.onDuration(v.duration);
            }}
            onTimeUpdate={(e) => props.onTime(e.currentTarget.currentTime)}
            onPlay={() => props.onPlaying(true)}
            onPause={() => props.onPlaying(false)}
          />
        )}
        {/* Swallows every click on the player itself. YouTube's own big play
            button and hover controls live inside a cross-origin iframe we can't
            style, so we simply keep the pointer away from it and drive playback
            through the API. */}
        <div className="click-shield" onClick={togglePlay} />

        <DrawLayer
          strokes={props.strokes}
          color={props.color}
          size={props.size}
          active={props.drawing}
          onStrokeStart={props.onStrokeStart}
          onStrokeCommit={props.onStrokeCommit}
        />
      </div>
    </div>
  );
}
