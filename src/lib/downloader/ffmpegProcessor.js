import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

function getFfmpegExecutable() {
  const defaultPath = typeof ffmpegPath === "string" ? ffmpegPath : ffmpegPath?.path;
  if (defaultPath && fs.existsSync(defaultPath)) return defaultPath;

  const cwdPath = path.join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  if (fs.existsSync(cwdPath)) return cwdPath;

  return defaultPath || "ffmpeg";
}

/**
 * Handles FFmpeg media operations (merging video+audio streams, container conversion, remuxing).
 */
export async function mergeVideoAudio(videoPath, audioPath, outputPath) {
  const ffmpegExecutable = getFfmpegExecutable();

  const args = [
    "-y",
    "-threads", "0",
    "-i", videoPath,
    "-i", audioPath,
    "-c:v", "copy",
    "-c:a", "aac",
    "-movflags", "+faststart",
    outputPath
  ];

  try {
    await execFileAsync(ffmpegExecutable, args, { timeout: 120000 });
    return outputPath;
  } catch (err) {
    console.error("FFmpeg merge fast copy failed, retrying with ultrafast re-encoding...", err);
    const reencodeArgs = [
      "-y",
      "-threads", "0",
      "-i", videoPath,
      "-i", audioPath,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-c:a", "aac",
      "-movflags", "+faststart",
      outputPath
    ];
    await execFileAsync(ffmpegExecutable, reencodeArgs, { timeout: 240000 });
    return outputPath;
  }
}

/**
 * Transcodes or remuxes input media file into target container format (mp4, webm, mkv, mp3, m4a).
 */
export async function convertMediaContainer(inputPath, targetFormat, outputPath) {
  const ffmpegExecutable = getFfmpegExecutable();
  const ext = targetFormat.toLowerCase();

  let args = [];

  if (ext === "mp3") {
    args = [
      "-y",
      "-threads", "0",
      "-i", inputPath,
      "-vn",
      "-acodec", "libmp3lame",
      "-qscale:a", "2",
      "-ar", "44100",
      outputPath
    ];
  } else if (ext === "m4a") {
    args = [
      "-y",
      "-threads", "0",
      "-i", inputPath,
      "-vn",
      "-c:a", "aac",
      "-b:a", "256k",
      outputPath
    ];
  } else if (ext === "webm") {
    args = [
      "-y",
      "-threads", "0",
      "-i", inputPath,
      "-c:v", "libvpx-vp9",
      "-crf", "32",
      "-b:v", "0",
      "-deadline", "realtime",
      "-cpu-used", "8",
      "-c:a", "libopus",
      outputPath
    ];
  } else if (ext === "mkv") {
    args = [
      "-y",
      "-threads", "0",
      "-i", inputPath,
      "-c", "copy",
      outputPath
    ];
  } else {
    // Default MP4 - Stream Copy for maximum speed
    args = [
      "-y",
      "-threads", "0",
      "-i", inputPath,
      "-c:v", "copy",
      "-c:a", "aac",
      "-movflags", "+faststart",
      outputPath
    ];
  }

  try {
    await execFileAsync(ffmpegExecutable, args, { timeout: 180000 });
    return outputPath;
  } catch (err) {
    console.error(`FFmpeg conversion to ${targetFormat} failed, trying compatible ultrafast re-encode...`, err);
    let fallbackArgs = [];
    if (ext === "mp3" || ext === "m4a") {
      fallbackArgs = ["-y", "-threads", "0", "-i", inputPath, "-vn", outputPath];
    } else if (ext === "webm") {
      fallbackArgs = [
        "-y",
        "-threads", "0",
        "-i", inputPath,
        "-c:v", "libvpx-vp9",
        "-crf", "35",
        "-b:v", "0",
        "-deadline", "realtime",
        "-cpu-used", "8",
        "-c:a", "libopus",
        outputPath
      ];
    } else {
      fallbackArgs = ["-y", "-threads", "0", "-i", inputPath, "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-movflags", "+faststart", outputPath];
    }
    await execFileAsync(ffmpegExecutable, fallbackArgs, { timeout: 300000 });
    return outputPath;
  }
}

/**
 * Transcodes or downscales video to exact target height preserving aspect ratio.
 */
export async function scaleVideoResolution(inputPath, targetHeight, targetFormat, outputPath) {
  const ffmpegExecutable = getFfmpegExecutable();
  const ext = (targetFormat || "mp4").toLowerCase();

  const isWebM = ext === "webm";
  const vcodec = isWebM ? "libvpx-vp9" : "libx264";
  const acodec = isWebM ? "libopus" : "aac";

  const args = [
    "-y",
    "-threads", "0",
    "-i", inputPath,
    "-vf", `scale=-2:${targetHeight}`,
    "-c:v", vcodec,
    ...(isWebM ? ["-crf", "32", "-b:v", "0", "-deadline", "realtime", "-cpu-used", "8"] : ["-preset", "ultrafast", "-crf", "23"]),
    "-c:a", acodec,
    ...(isWebM ? [] : ["-movflags", "+faststart"]),
    outputPath
  ];

  try {
    await execFileAsync(ffmpegExecutable, args, { timeout: 300000 });
    return outputPath;
  } catch (err) {
    console.error(`FFmpeg video scaling to ${targetHeight}p failed:`, err);
    const fallbackArgs = [
      "-y",
      "-threads", "0",
      "-i", inputPath,
      "-vf", `scale=-2:${targetHeight}`,
      outputPath
    ];
    await execFileAsync(ffmpegExecutable, fallbackArgs, { timeout: 300000 });
    return outputPath;
  }
}

