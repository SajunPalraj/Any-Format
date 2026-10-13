import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import { BaseProvider } from "./baseProvider.js";

const execFileAsync = promisify(execFile);

function getFfmpegExecutable() {
  const defaultPath = typeof ffmpegPath === "string" ? ffmpegPath : ffmpegPath?.path;
  if (defaultPath && fs.existsSync(defaultPath)) return defaultPath;

  const cwdPath = path.join(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  );
  if (fs.existsSync(cwdPath)) return cwdPath;

  return defaultPath || "ffmpeg";
}

function isDirectMediaUrl(u) {
  if (!u || typeof u !== "string") return false;
  try {
    const pathname = new URL(u).pathname.toLowerCase();
    return /\.(mp4|m4v|webm|mkv|mov|avi|flv|wmv|mp3|m4a|wav|aac|ogg|opus|m3u8)(\?|$)/i.test(pathname);
  } catch (_) {
    return false;
  }
}

/**
 * UniversalSnifferProvider
 * Deep-scans arbitrary web URLs for embedded HTML5 videos, OpenGraph media,
 * JSON-LD VideoObjects, and HLS (.m3u8) / DASH (.mpd) stream playlists.
 */
export class UniversalSnifferProvider extends BaseProvider {
  constructor() {
    super("universal-sniffer");
    this.streamCache = new Map();
  }

  async supportsUrl(url, platform) {
    return true;
  }

  /**
   * Fetches raw HTML with standard browser headers and follow-redirects.
   */
  async fetchHtml(targetUrl) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(targetUrl);
      const isHttps = parsed.protocol === "https:";
      const client = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,video/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Sec-Fetch-Mode": "navigate"
        },
        timeout: 10000
      };

      const req = client.request(options, (res) => {
        // Handle 301/302 redirects
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirectUrl = new URL(res.headers.location, targetUrl).toString();
          return resolve(this.fetchHtml(redirectUrl));
        }

        if (res.statusCode >= 400) {
          return reject(
            new Error(`HTTP error ${res.statusCode} fetching page content`)
          );
        }

        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
          // Avoid memory bloat if page is massive
          if (data.length > 5 * 1024 * 1024) {
            req.destroy();
            resolve(data);
          }
        });
        res.on("end", () => resolve(data));
      });

      req.on("error", (err) => reject(err));
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out while analyzing page"));
      });
      req.end();
    });
  }

  /**
   * Resolves a relative URL against page base.
   */
  resolveUrl(relative, base) {
    try {
      return new URL(relative, base).toString();
    } catch {
      return relative;
    }
  }

  async analyze(url, platform) {
    let html = "";
    try {
      html = await this.fetchHtml(url);
    } catch (err) {
      throw new Error(`Universal sniffer could not fetch page: ${err.message}`);
    }

    // 1. Extract Page Title
    let title = "Web Media Stream";
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim().replace(/\s+/g, " ");
    }
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      title = ogTitleMatch[1].trim();
    }

    // 2. Extract Thumbnail
    let thumbnail = null;
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      thumbnail = this.resolveUrl(ogImageMatch[1], url);
    }
    if (!thumbnail) {
      const posterMatch = html.match(/poster=["']([^"']+)["']/i);
      if (posterMatch && posterMatch[1]) {
        thumbnail = this.resolveUrl(posterMatch[1], url);
      }
    }

    // 3. Scan for Direct Media or Stream Manifests
    const detectedStreams = [];

    // 3a. OpenGraph Video URL
    const ogVideoMatches = [
      ...html.matchAll(/<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/gi)
    ];
    for (const match of ogVideoMatches) {
      if (match[1]) {
        detectedStreams.push({
          type: "og_video",
          url: this.resolveUrl(match[1], url),
          format: "mp4"
        });
      }
    }

    // 3b. Twitter Stream Player
    const twitterMatch = html.match(/<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/i);
    if (twitterMatch && twitterMatch[1]) {
      detectedStreams.push({
        type: "twitter_stream",
        url: this.resolveUrl(twitterMatch[1], url),
        format: "mp4"
      });
    }

    // 3c. HTML5 <video> / <source> tags
    const videoTagMatches = [...html.matchAll(/<video[^>]+src=["']([^"']+)["']/gi)];
    for (const match of videoTagMatches) {
      if (match[1] && !match[1].startsWith("blob:")) {
        detectedStreams.push({
          type: "html5_video",
          url: this.resolveUrl(match[1], url),
          format: "mp4"
        });
      }
    }

    const sourceTagMatches = [
      ...html.matchAll(/<source[^>]+src=["']([^"']+)["'](?:[^>]+type=["']([^"']+)["'])?/gi)
    ];
    for (const match of sourceTagMatches) {
      if (match[1] && !match[1].startsWith("blob:")) {
        const streamUrl = this.resolveUrl(match[1], url);
        const mime = (match[2] || "").toLowerCase();
        const isHls = mime.includes("mpegurl") || streamUrl.includes(".m3u8");
        detectedStreams.push({
          type: isHls ? "hls" : "html5_source",
          url: streamUrl,
          format: isHls ? "m3u8" : "mp4"
        });
      }
    }

    // 3d. HLS (.m3u8) manifest urls embedded in scripts / player configs
    const m3u8Matches = [...html.matchAll(/(https?:\\?\/\\?\/[^\s"'<>]+\.m3u8(?:[^\s"'<>]*)?)/gi)];
    for (const match of m3u8Matches) {
      const cleanStreamUrl = match[1].replace(/\\\//g, "/");
      detectedStreams.push({
        type: "hls_stream",
        url: cleanStreamUrl,
        format: "m3u8"
      });
    }

    // 3e. MP4 streams embedded in scripts (video.js, jwplayer, etc.)
    const scriptMp4Matches = [
      ...html.matchAll(/(https?:\\?\/\\?\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?)/gi)
    ];
    for (const match of scriptMp4Matches) {
      const cleanMp4Url = match[1].replace(/\\\//g, "/");
      detectedStreams.push({
        type: "script_mp4",
        url: cleanMp4Url,
        format: "mp4"
      });
    }

    // 3f. JSON-LD VideoObject
    const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const match of jsonLdMatches) {
      try {
        const json = JSON.parse(match[1]);
        const item = Array.isArray(json) ? json[0] : json;
        if (item && (item["@type"] === "VideoObject" || item.contentUrl)) {
          if (item.name) title = item.name;
          if (item.thumbnailUrl) thumbnail = item.thumbnailUrl;
          if (item.contentUrl) {
            detectedStreams.push({
              type: "jsonld_video",
              url: item.contentUrl,
              format: item.contentUrl.includes(".m3u8") ? "m3u8" : "mp4"
            });
          }
        }
      } catch {
        // Skip malformed JSON-LD
      }
    }

    if (detectedStreams.length === 0) {
      throw new Error(
        `No public video or media stream could be extracted from ${new URL(url).hostname}.`
      );
    }

    // Deduplicate streams
    const uniqueStreams = [];
    const seen = new Set();
    for (const s of detectedStreams) {
      if (!seen.has(s.url)) {
        seen.add(s.url);
        uniqueStreams.push(s);
      }
    }

    // Prioritize HLS / high quality direct streams
    const primaryStream =
      uniqueStreams.find((s) => s.format === "m3u8") || uniqueStreams[0];

    // Store primary stream in cache for download phase
    this.streamCache.set(url, primaryStream);

    const isHls = primaryStream.format === "m3u8";

    // Build standard format ladder
    const formats = [
      {
        formatId: "universal_best",
        extension: "mp4",
        container: "mp4",
        resolution: "1080x720",
        height: 720,
        width: 1280,
        fps: 30,
        videoCodec: isHls ? "H.264 (HLS Stream)" : "H.264",
        audioCodec: "AAC",
        hasVideo: true,
        hasAudio: true,
        isHls,
        streamUrl: primaryStream.url
      },
      {
        formatId: "universal_audio",
        extension: "mp3",
        container: "mp3",
        bitrate: 320,
        audioCodec: "MP3",
        hasVideo: false,
        hasAudio: true,
        streamUrl: primaryStream.url
      }
    ];

    return {
      platform: `${new URL(url).hostname.replace(/^www\./, "")} (Universal Stream)`,
      title,
      thumbnail,
      duration: "Stream",
      uploader: new URL(url).hostname,
      formats,
      hasVideo: true,
      hasAudio: true,
      provider: this.name,
      primaryStreamUrl: primaryStream.url
    };
  }

  async download(url, selectedFormat, outputPath) {
    const cachedStream = this.streamCache.get(url);
    let streamUrl =
      selectedFormat?.streamUrl ||
      selectedFormat?.url ||
      cachedStream?.url;

    // If streamUrl is missing or points to the webpage itself, attempt real stream extraction
    if (!streamUrl || (streamUrl === url && !isDirectMediaUrl(streamUrl))) {
      try {
        const recheck = await this.analyze(url);
        streamUrl =
          recheck?.primaryStreamUrl ||
          recheck?.formats?.[0]?.streamUrl ||
          recheck?.formats?.[0]?.url;
      } catch (_) {}
    }

    if (!streamUrl || (streamUrl === url && !isDirectMediaUrl(streamUrl))) {
      throw new Error(`No direct media stream URL could be resolved for ${url}.`);
    }

    const isHls =
      streamUrl.includes(".m3u8") ||
      cachedStream?.format === "m3u8" ||
      selectedFormat?.isHls;

    const ffmpegExecutable = getFfmpegExecutable();

    if (isHls) {
      // Use FFmpeg to stream-copy HLS (.m3u8) segments directly into outputPath
      const args = [
        "-y",
        "-protocol_whitelist",
        "file,http,https,tcp,tls",
        "-i",
        streamUrl,
        "-c",
        "copy",
        "-bsf:a",
        "aac_adtstoasc",
        "-movflags",
        "+faststart",
        outputPath
      ];

      await execFileAsync(ffmpegExecutable, args, { timeout: 180000 });
      return outputPath;
    }

    // Direct HTTP Media Download using streaming
    return new Promise((resolve, reject) => {
      const parsed = new URL(streamUrl);
      const isHttps = parsed.protocol === "https:";
      const client = isHttps ? https : http;

      const fileStream = fs.createWriteStream(outputPath);

      const isGoogleVideo = streamUrl.includes("googlevideo.com");
      const userAgent = isGoogleVideo
        ? "com.google.android.apps.youtube.vr/1.56.21 (Linux; U; Android 10)"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

      const req = client.get(
        streamUrl,
        {
          headers: {
            "User-Agent": userAgent,
            Referer: url
          },
          timeout: 30000
        },
        (res) => {
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            fileStream.close();
            const redirectUrl = new URL(res.headers.location, streamUrl).toString();
            return resolve(
              this.download(url, { ...selectedFormat, streamUrl: redirectUrl }, outputPath)
            );
          }

          if (res.statusCode >= 400) {
            fileStream.close();
            if (fs.existsSync(outputPath)) {
              try { fs.unlinkSync(outputPath); } catch (_) {}
            }
            return reject(
              new Error(`Failed to download stream, HTTP status ${res.statusCode}`)
            );
          }

          const contentType = (res.headers["content-type"] || "").toLowerCase();
          if (contentType.includes("text/html")) {
            fileStream.close();
            if (fs.existsSync(outputPath)) {
              try { fs.unlinkSync(outputPath); } catch (_) {}
            }
            return reject(
              new Error("Stream URL returned an HTML webpage instead of a media binary.")
            );
          }

          res.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close((closeErr) => {
              if (closeErr) reject(closeErr);
              else resolve(outputPath);
            });
          });
        }
      );

      req.on("error", (err) => {
        fileStream.close();
        if (fs.existsSync(outputPath)) {
          try { fs.unlinkSync(outputPath); } catch (_) {}
        }
        reject(err);
      });

      req.on("timeout", () => {
        req.destroy();
        fileStream.close();
        if (fs.existsSync(outputPath)) {
          try { fs.unlinkSync(outputPath); } catch (_) {}
        }
        reject(new Error("Media stream download timed out"));
      });
    });
  }
}
