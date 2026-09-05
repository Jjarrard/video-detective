import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import type { Plugin } from "vite";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
/** youtube-dl-exec ships the yt-dlp binary inside node_modules — no global install. */
const YTDLP = require.resolve("youtube-dl-exec/bin/yt-dlp");

type Format = {
  url: string;
  ext: string;
  height?: number | null;
  vcodec?: string;
  acodec?: string;
  protocol?: string;
  format_note?: string;
};

export type StreamOption = {
  label: string;
  /** same-origin proxy path — keeps the canvas untainted */
  url: string;
  height: number;
  hasAudio: boolean;
};

function pickFormats(formats: Format[]): { progressive?: Format; videoOnly?: Format } {
  const usable = formats.filter(
    (f) => f.url && (f.protocol === "https" || f.protocol === "http") && f.ext === "mp4",
  );
  const byHeight = (a: Format, b: Format) => (b.height ?? 0) - (a.height ?? 0);

  const progressive = usable
    .filter((f) => f.vcodec && f.vcodec !== "none" && f.acodec && f.acodec !== "none")
    .sort(byHeight)[0];

  const videoOnly = usable
    .filter((f) => f.vcodec && f.vcodec !== "none" && (!f.acodec || f.acodec === "none"))
    .filter((f) => (f.height ?? 0) <= 1080)
    .sort(byHeight)[0];

  return { progressive, videoOnly };
}

async function resolve(pageUrl: string): Promise<{ title: string; options: StreamOption[] }> {
  const { stdout } = await execFileAsync(
    YTDLP,
    ["--dump-single-json", "--no-warnings", "--no-playlist", pageUrl],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const info = JSON.parse(stdout) as { title?: string; formats?: Format[] };
  const { progressive, videoOnly } = pickFormats(info.formats ?? []);

  const options: StreamOption[] = [];
  const proxy = (u: string) => `/api/stream?u=${encodeURIComponent(u)}`;
  if (videoOnly) {
    options.push({
      label: `${videoOnly.height}p · no audio`,
      url: proxy(videoOnly.url),
      height: videoOnly.height ?? 0,
      hasAudio: false,
    });
  }
  if (progressive) {
    options.push({
      label: `${progressive.height}p · with audio`,
      url: proxy(progressive.url),
      height: progressive.height ?? 0,
      hasAudio: true,
    });
  }
  if (options.length === 0) throw new Error("no usable mp4 stream for this video");

  // best picture first: frame inspection beats audio here
  options.sort((a, b) => b.height - a.height);
  return { title: info.title ?? pageUrl, options };
}

/** Pipe the upstream bytes through our own origin so <video> frames stay
 *  canvas-readable, forwarding Range so seeking still works. */
async function stream(req: IncomingMessage, res: ServerResponse, upstream: string) {
  const headers: Record<string, string> = {
    // googlevideo is picky about who's asking
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
  };
  if (req.headers.range) headers.range = req.headers.range;

  const upstreamRes = await fetch(upstream, { headers });
  res.statusCode = upstreamRes.status;
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstreamRes.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  res.setHeader("cache-control", "no-store");
  if (!upstreamRes.body) return res.end();
  Readable.fromWeb(upstreamRes.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
}

export function youtubeSource(): Plugin {
  return {
    name: "video-detective:youtube-source",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");

        if (url.pathname === "/api/resolve") {
          const target = url.searchParams.get("url");
          res.setHeader("content-type", "application/json");
          if (!target) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: "missing url" }));
          }
          try {
            res.end(JSON.stringify(await resolve(target)));
          } catch (e) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: (e as Error).message.split("\n").slice(-3).join(" ") }));
          }
          return;
        }

        if (url.pathname === "/api/stream") {
          const target = url.searchParams.get("u");
          if (!target) {
            res.statusCode = 400;
            return res.end("missing u");
          }
          try {
            await stream(req, res, target);
          } catch (e) {
            res.statusCode = 502;
            res.end((e as Error).message);
          }
          return;
        }

        next();
      });
    },
  };
}
