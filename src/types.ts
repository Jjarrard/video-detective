export type Point = { x: number; y: number };

/** Coordinates are normalised 0..1 against the video's display box so
 *  strokes survive resizing and replay onto the source-resolution frame. */
export type Stroke = {
  id: string;
  color: string;
  /** width as a fraction of the video box width */
  size: number;
  points: Point[];
};

export type SavedFrame = {
  id: string;
  time: number;
  createdAt: number;
  /** data URL of the thumbnail — always present */
  thumb: string;
  /** false when the source's pixels couldn't be read (YouTube): thumb is the drawing alone */
  hasPixels: boolean;
  strokes: Stroke[];
  note: string;
};

/** A playable rendition, resolved server-side for YouTube links. */
export type StreamOption = {
  label: string;
  url: string;
  height: number;
  hasAudio: boolean;
};

export type Source =
  | { kind: "file"; url: string; name: string }
  /** Also covers YouTube once yt-dlp has resolved it to a proxied mp4. */
  | { kind: "url"; url: string; name: string; options?: StreamOption[] }
  /** Fallback: the YouTube iframe. Plays and annotates, but can't be captured. */
  | { kind: "youtube"; videoId: string; name: string };
