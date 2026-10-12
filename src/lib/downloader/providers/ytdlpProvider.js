import path from "path";
import fs from "fs";
import youtubedl from "yt-dlp-exec";
import ffmpegPath from "ffmpeg-static";
import { BaseProvider } from "./baseProvider.js";

function getExec() {
  const binaryPath = path.join(process.cwd(), "node_modules", "yt-dlp-exec", "bin", "yt-dlp" + (process.platform === "win32" ? ".exe" : ""));
  if (fs.existsSync(binaryPath)) {
    return typeof youtubedl.create === "function" ? youtubedl.create(binaryPath) : youtubedl;
  }
  return youtubedl;
}

function getFfmpegExecutable() {
  const defaultPath = typeof ffmpegPath === "string" ? ffmpegPath : ffmpegPath?.path;
  if (defaultPath && fs.existsSync(defaultPath)) return defaultPath;
  const cwdPath = path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  if (fs.existsSync(cwdPath)) return cwdPath;
  return defaultPath || "ffmpeg";
}

let ytdlpVersionLogged = false;

async function logYtdlpVersionOnce() {
  if (ytdlpVersionLogged) return;
  ytdlpVersionLogged = true;
  try {
    const runner = getExec();
    const ver = await runner("--version");
    console.log(`[URL-DOWNLOADER STARTUP] Active yt-dlp binary version: ${typeof ver === "string" ? ver.trim() : ver}`);
  } catch (err) {
    console.warn(`[URL-DOWNLOADER STARTUP] Could not query yt-dlp version:`, err.message);
  }
}

function runWithTimeout(commandPromise, timeoutMs, timeoutMsg) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        if (commandPromise && typeof commandPromise.cancel === "function") commandPromise.cancel();
        else if (commandPromise && typeof commandPromise.kill === "function") commandPromise.kill();
      } catch (_) {}
      const err = new Error(timeoutMsg);
      err.code = "ETIMEDOUT";
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([commandPromise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

function prepareYtDlpUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("vimeo.com") && !parsed.hostname.includes("player.vimeo.com")) {
      const vimeoMatch = parsed.pathname.match(/(\d+)/);
      if (vimeoMatch && vimeoMatch[1]) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      }
    }
  } catch (_) {}
  return url;
}

export class YtDlpProvider extends BaseProvider {
  constructor() {
    super("yt-dlp");
    logYtdlpVersionOnce();
  }

  async supportsUrl(url, platform) {
    return true;
  }

  async analyze(url, platform) {
    const targetUrl = prepareYtDlpUrl(url);
    try {
      const runner = getExec();
      const commandPromise = runner(targetUrl, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificate: true,
        preferFreeFormats: true,
        extractorArgs: "generic:impersonate"
      });

      const output = await runWithTimeout(commandPromise, 25000, "Metadata extraction timed out. Please try again.");

      if (!output) {
        throw new Error("yt-dlp returned empty extraction output.");
      }

      const title = output.title || output.fulltitle || "Extracted Video Media";
      const uploader = output.uploader || output.channel || output.creator || platform.displayName;
      const thumbnail = output.thumbnail || (output.thumbnails && output.thumbnails.length > 0 ? output.thumbnails[output.thumbnails.length - 1].url : null);
      
      const durationSec = output.duration || 0;
      const mins = Math.floor(durationSec / 60);
      const secs = Math.floor(durationSec % 60);
      const formattedDuration = durationSec > 0 ? `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}` : "00:00";

      const rawFormats = output.formats || [];
      const formats = [];

      for (const fmt of rawFormats) {
        if (!fmt.url && !fmt.format_id) continue;

        const hasVideo = Boolean(fmt.vcodec && fmt.vcodec !== "none");
        const hasAudio = Boolean(fmt.acodec && fmt.acodec !== "none");
        
        const height = fmt.height || (fmt.format_note ? parseInt(fmt.format_note, 10) : 0) || 0;
        const width = fmt.width || (height ? Math.round(height * (16 / 9)) : 0);
        const resolutionLabel = height ? `${height}p` : (hasVideo ? "Video" : "Audio Only");
        const ext = (fmt.ext || "mp4").toLowerCase();

        formats.push({
          formatId: fmt.format_id || `fmt_${formats.length}`,
          type: hasVideo ? "video" : (hasAudio ? "audio" : "unknown"),
          extension: ext,
          container: ext,
          qualityLabel: resolutionLabel,
          resolution: width && height ? `${width}x${height}` : (height ? `${height}p` : null),
          height,
          width,
          fps: fmt.fps || null,
          bitrate: fmt.tbr || fmt.vbr || fmt.abr || null,
          filesize: fmt.filesize || fmt.filesize_approx || null,
          hasVideo,
          hasAudio,
          videoCodec: fmt.vcodec || null,
          audioCodec: fmt.acodec || null,
          vcodec: fmt.vcodec || null,
          acodec: fmt.acodec || null,
          dynamicRange: fmt.dynamic_range || null,
          protocol: fmt.protocol || null,
          formatNote: fmt.format_note || null,
          url: fmt.url || null
        });
      }

      if (formats.length === 0 && output.url) {
        formats.push({
          formatId: "best",
          type: "video",
          extension: (output.ext || "mp4").toLowerCase(),
          container: (output.ext || "mp4").toLowerCase(),
          qualityLabel: output.height ? `${output.height}p` : "HD",
          height: output.height || 720,
          width: output.width || 1280,
          hasVideo: true,
          hasAudio: true,
          filesize: output.filesize || null,
          url: output.url
        });
      }

      // Sort formats by height (descending), then bitrate (descending)
      formats.sort((a, b) => (b.height || 0) - (a.height || 0) || (b.bitrate || 0) - (a.bitrate || 0));

      return {
        platform: platform.displayName,
        title,
        thumbnail,
        duration: formattedDuration,
        uploader,
        formats,
        hasVideo: formats.some(f => f.hasVideo),
        hasAudio: formats.some(f => f.hasAudio),
        provider: this.name,
        rawExtractorOutput: {
          url: output.url,
          extractor: output.extractor
        }
      };
    } catch (err) {
      console.warn("YtDlpProvider analyze failed:", err.message || err);
      throw new Error(`yt-dlp extraction failed: ${err.message || "Unknown error"}`);
    }
  }

  async download(url, selectedOptions = {}, outputPath) {
    let formatArg = "bestvideo+bestaudio/best";

    const { videoFormatId, audioFormatId, targetHeight, exactHeight, outputFormat } = selectedOptions;

    if (videoFormatId && audioFormatId) {
      formatArg = `${videoFormatId}+${audioFormatId}`;
    } else if (videoFormatId && videoFormatId !== "best") {
      formatArg = `${videoFormatId}+bestaudio/best`;
    } else if (audioFormatId && audioFormatId !== "best") {
      formatArg = audioFormatId;
    } else if (targetHeight && targetHeight > 0) {
      if (exactHeight) {
        // Exact height format selection (exact height match or small tolerance)
        formatArg = `bestvideo[height=${targetHeight}]+bestaudio/bestvideo[height<=${targetHeight}][height>=${Math.max(1, targetHeight - 50)}]+bestaudio/best`;
      } else {
        // Up to target height format selection
        formatArg = `bestvideo[height<=${targetHeight}]+bestaudio/bestvideo+bestaudio/best`;
      }
    }

    const mergeFormat = (outputFormat || selectedOptions.extension || "mp4").toLowerCase();

    try {
      const runner = getExec();
      const commandPromise = runner(prepareYtDlpUrl(url), {
        format: formatArg,
        output: outputPath,
        mergeOutputFormat: mergeFormat === "mp3" || mergeFormat === "m4a" ? undefined : mergeFormat,
        ffmpegLocation: getFfmpegExecutable(),
        concurrentFragments: 4,
        bufferSize: "16M",
        noWarnings: true,
        noCheckCertificate: true,
        preferFreeFormats: true,
        extractorArgs: "generic:impersonate"
      });

      await runWithTimeout(commandPromise, 90000, "Download timed out. Please try again.");

      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        return outputPath;
      }

      // Check if output file was created with extension like .mp4 or .m4a
      if (fs.existsSync(/*turbopackIgnore: true*/ `${outputPath}.${mergeFormat}`)) {
        fs.renameSync(`${outputPath}.${mergeFormat}`, outputPath);
        return outputPath;
      }

      // Check if output file exists with any extension
      const dir = path.dirname(outputPath);
      const base = path.basename(outputPath);
      const filesInDir = fs.readdirSync(dir);
      const matchingFile = filesInDir.find(f => f.startsWith(base));

      if (matchingFile) {
        const fullMatchedPath = path.join(dir, matchingFile);
        if (fullMatchedPath !== outputPath) {
          fs.renameSync(fullMatchedPath, outputPath);
        }
        return outputPath;
      }

      throw new Error("yt-dlp download finished but output file is missing or empty.");
    } catch (err) {
      console.warn("YtDlpProvider download error:", err.message);
      throw err;
    }
  }
}
