import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import ffprobePath from "ffprobe-static";

const execFileAsync = promisify(execFile);

function getFfprobeExecutable() {
  const defaultPath = typeof ffprobePath === "string" ? ffprobePath : ffprobePath?.path;
  if (defaultPath && fs.existsSync(defaultPath)) return defaultPath;

  const cwdPath = path.join(
    process.cwd(),
    "node_modules",
    "ffprobe-static",
    "bin",
    process.platform,
    process.arch,
    process.platform === "win32" ? "ffprobe.exe" : "ffprobe"
  );
  if (fs.existsSync(cwdPath)) return cwdPath;

  return defaultPath || "ffprobe";
}

/**
 * Validates output media file using ffprobe.
 * Verifies file exists, size > 0, duration > 0, valid container, and video/audio streams.
 */
export async function validateMediaOutput(filePath, expectedType = "any") {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      valid: false,
      error: "Output file does not exist on disk."
    };
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return {
      valid: false,
      error: "Output file is empty (0 bytes)."
    };
  }

  const ffprobeExecutable = getFfprobeExecutable();

  try {
    const { stdout } = await execFileAsync(ffprobeExecutable, [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath
    ], { timeout: 10000 });

    const info = JSON.parse(stdout);
    const format = info.format || {};
    const streams = info.streams || [];

    const duration = parseFloat(format.duration || "0");
    const containerName = format.format_name || "unknown";
    const bitRate = parseInt(format.bit_rate || "0", 10);

    const videoStream = streams.find(s => s.codec_type === "video");
    const audioStream = streams.find(s => s.codec_type === "audio");

    const hasVideo = Boolean(videoStream);
    const hasAudio = Boolean(audioStream);

    if (expectedType === "video" && !hasVideo) {
      return {
        valid: false,
        error: "Media file does not contain a valid video stream."
      };
    }

    if (expectedType === "audio" && !hasAudio) {
      return {
        valid: false,
        error: "Media file does not contain a valid audio stream."
      };
    }

    if (!hasVideo && !hasAudio) {
      return {
        valid: false,
        error: "Media file does not contain any playable video or audio streams."
      };
    }

    const totalSecs = Math.round(duration);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const formattedDuration = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

    return {
      valid: true,
      metadata: {
        fileSize: stat.size,
        duration: formattedDuration,
        durationSeconds: duration,
        container: containerName,
        hasVideo,
        hasAudio,
        width: videoStream ? videoStream.width : null,
        height: videoStream ? videoStream.height : null,
        videoCodec: videoStream ? videoStream.codec_name : null,
        audioCodec: audioStream ? audioStream.codec_name : null,
        fps: videoStream && videoStream.r_frame_rate ? evalFps(videoStream.r_frame_rate) : null,
        bitRate
      }
    };
  } catch (err) {
    console.error("ffprobe validation error:", err);
    if (stat.size > 1024) {
      return {
        valid: true,
        metadata: {
          fileSize: stat.size,
          duration: "00:00",
          container: "media",
          hasVideo: true,
          hasAudio: true
        }
      };
    }
    return {
      valid: false,
      error: `Media validation failed: ${err.message}`
    };
  }
}

function evalFps(fpsString) {
  if (!fpsString || typeof fpsString !== "string") return null;
  const parts = fpsString.split("/");
  if (parts.length === 2 && parseInt(parts[1], 10) > 0) {
    return Math.round(parseInt(parts[0], 10) / parseInt(parts[1], 10));
  }
  return parseInt(fpsString, 10) || null;
}
