import fs from "fs";
import path from "path";
import { defaultProviderManager } from "./providerManager.js";
import { validateMediaOutput } from "./outputValidator.js";
import { mergeVideoAudio, convertMediaContainer, scaleVideoResolution } from "./ffmpegProcessor.js";
import { JobManager } from "./jobManager.js";
import { detectPlatform, validateUrlSecurity, normalizeMediaUrl } from "./siteDetector.js";
import { classifyDownloaderError, ErrorCategory } from "./errorClassifier.js";

export class UniversalMediaDownloader {
  constructor(providerManager = defaultProviderManager) {
    this.providerManager = providerManager;
  }

  /**
   * 1. ANALYZE
   * Extracts real media information and available format list.
   * Builds full quality options list for all standard heights up to max source height.
   */
  async analyze(url) {
    const cleanUrl = normalizeMediaUrl(url);

    // SSRF URL Security Check
    const sec = await validateUrlSecurity(cleanUrl);
    if (!sec.valid) {
      return {
        supported: false,
        category: ErrorCategory.UNSUPPORTED_URL,
        error: sec.reason || "Invalid URL or restricted address.",
        url: cleanUrl
      };
    }

    const platform = detectPlatform(cleanUrl);

    try {
      const data = await this.providerManager.analyze(cleanUrl);
      const rawFormats = data.formats || [];

      const videoFormats = rawFormats.filter(f => f.hasVideo || f.height > 0);
      const audioFormats = rawFormats.filter(f => f.hasAudio && !f.hasVideo);

      const bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || null;

      // Parse duration seconds for size estimation
      let durationSec = 0;
      if (typeof data.duration === "number") {
        durationSec = data.duration;
      } else if (typeof data.duration === "string" && data.duration.includes(":")) {
        const parts = data.duration.split(":").map(Number);
        if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
        else if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }

      const estimateFormatSize = (fmt, bAudio) => {
        if (fmt && fmt.filesize) return fmt.filesize + (bAudio?.filesize || 0);
        const vBitrate = fmt?.bitrate || (fmt?.height >= 2160 ? 15000 : fmt?.height >= 1440 ? 8000 : fmt?.height >= 1080 ? 3500 : fmt?.height >= 720 ? 1800 : fmt?.height >= 480 ? 900 : 500);
        const aBitrate = bAudio?.bitrate || 160;
        if (durationSec > 0) {
          return Math.round(((vBitrate + aBitrate) * 1000 / 8) * durationSec);
        }
        return fmt?.filesize || (bAudio ? bAudio.filesize || null : null);
      };

      // Determine maximum source video height
      const rawHeights = videoFormats.map(f => f.height).filter(h => h > 0);
      const maxSourceHeight = rawHeights.length > 0 ? Math.max(...rawHeights) : 720;

      // Standard resolutions ladder
      const standardHeights = [2160, 1440, 1080, 720, 480, 360, 240, 144];

      // Include all standard heights <= maxSourceHeight (plus any higher resolution standard heights present in source)
      const targetHeights = standardHeights.filter(h => h <= maxSourceHeight || rawHeights.includes(h));

      // Make sure heights are sorted descending
      const heights = Array.from(new Set(targetHeights)).sort((a, b) => b - a);

      const qualityOptions = [];

      // 1. Add "Best Available" Option
      // Prioritize fast, reliable streams (prefer formats with both video and audio <= 1080p)
      const hdCandidates = videoFormats.filter(f => (f.height || 0) <= 1080);
      const progressiveHD = hdCandidates.find(f => f.hasVideo && f.hasAudio) || hdCandidates[0];
      const topVideo = progressiveHD || videoFormats.find(f => f.height === maxSourceHeight) || videoFormats[0] || {};
      const topHeight = topVideo.height || Math.min(maxSourceHeight, 1080);
      const topWidth = topVideo.width || Math.round(topHeight * (16 / 9));
      const topEstSize = estimateFormatSize(topVideo, bestAudio);

      qualityOptions.push({
        id: "best",
        quality: "best",
        label: `Best Available (${topHeight}p)`,
        height: topHeight,
        width: topWidth,
        resolution: `${topWidth}x${topHeight}`,
        fps: topVideo.fps || 30,
        videoFormatId: topVideo.formatId || "best",
        audioFormatId: bestAudio ? bestAudio.formatId : "best",
        extension: topVideo.extension || "mp4",
        filesize: topEstSize,
        hasVideo: true,
        hasAudio: true,
        streamUrl: topVideo.url || topVideo.streamUrl
      });

      // 2. Add Standard Resolution Options (1080p, 720p, 480p, 360p, 240p, 144p)
      for (const h of heights) {
        const matchingFormats = videoFormats.filter(f => Math.abs((f.height || 0) - h) <= 30);
        // Prefer progressive formats (both video and audio) for instant downloading
        const fmt =
          matchingFormats.find(f => f.hasVideo && f.hasAudio && f.extension === "mp4") ||
          matchingFormats.find(f => f.hasVideo && f.hasAudio) ||
          matchingFormats.find(f => f.extension === "mp4") ||
          matchingFormats[0];

        const width = fmt && fmt.width ? fmt.width : Math.round(h * (16 / 9));
        const estSize = estimateFormatSize(fmt, bestAudio);

        let label = `${h}p`;
        if (h >= 2160) label = `${h}p 4K`;
        else if (h === 1440) label = `${h}p 2K`;
        else if (h === 1080) label = `${h}p Full HD`;
        else if (h === 720) label = `${h}p HD`;
        else if (h === 480) label = `${h}p SD`;
        else if (h === 360) label = `${h}p SD`;

        qualityOptions.push({
          id: `${h}p`,
          quality: `${h}p`,
          label,
          height: h,
          width,
          resolution: `${width}x${h}`,
          fps: fmt ? fmt.fps || 30 : 30,
          videoFormatId: fmt ? fmt.formatId : "best",
          audioFormatId: bestAudio ? bestAudio.formatId : "best",
          extension: fmt ? fmt.extension || "mp4" : "mp4",
          videoCodec: fmt ? fmt.videoCodec || "H.264" : "H.264",
          audioCodec: bestAudio ? bestAudio.audioCodec : null,
          filesize: estSize,
          hasVideo: true,
          hasAudio: true,
          streamUrl: fmt ? (fmt.url || fmt.streamUrl) : null
        });
      }

      const analysisPayload = {
        supported: true,
        platformKey: data.platformKey || platform.key,
        platform: data.platform || platform.displayName,
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        uploader: data.uploader,
        qualityOptions,
        formats: rawFormats,
        audioFormats,
        hasVideo: data.hasVideo,
        hasAudio: data.hasAudio,
        provider: data.provider,
        url: cleanUrl
      };

      // Store in JobManager analysis session
      const session = JobManager.storeAnalysis(cleanUrl, analysisPayload);

      return {
        ...analysisPayload,
        jobId: session.jobId
      };
    } catch (err) {
      const classified = classifyDownloaderError(err, platform.displayName);
      return {
        supported: false,
        platformKey: platform.key,
        platform: platform.displayName,
        category: classified.category,
        error: classified.userMessage,
        rawError: classified.rawError,
        url: cleanUrl
      };
    }
  }

  /**
   * 2. DOWNLOAD & PROCESS JOB
   * Downloads exact user-selected quality, downscales with FFmpeg if needed, validates output.
   */
  async downloadJob(url, options = {}) {
    const cleanUrl = normalizeMediaUrl(url);

    const sec = await validateUrlSecurity(cleanUrl);
    if (!sec.valid) {
      throw new Error(sec.reason || "Invalid URL.");
    }

    // 1. Retrieve or run analysis
    let cachedAnalysis = null;
    if (options.jobId) {
      cachedAnalysis = JobManager.getAnalysis(options.jobId);
    }
    if (!cachedAnalysis) {
      cachedAnalysis = JobManager.findAnalysisByUrl(cleanUrl);
    }

    // Serverless optimization: If cached analysis was lost due to cross-instance execution on Vercel/serverless,
    // but the client provided the direct streamUrl from the analysis step, synthesize a lightweight cachedAnalysis
    // so we avoid costly and timeout-prone re-analysis!
    if (!cachedAnalysis && options.streamUrl) {
      const targetFormat = (options.format || "mp4").toLowerCase();
      const isAudioOnly = ["mp3", "m4a", "wav", "aac", "flac"].includes(targetFormat);
      const parsedHeight = parseInt(options.selectedQuality || options.quality, 10) || 720;

      const synthesizedFormat = {
        formatId: options.videoFormatId || "best",
        streamUrl: options.streamUrl,
        url: options.streamUrl,
        rawUrls: { videoUrl: options.streamUrl },
        extension: targetFormat,
        hasVideo: !isAudioOnly,
        hasAudio: true,
        height: parsedHeight,
        width: Math.round(parsedHeight * (16 / 9))
      };

      cachedAnalysis = {
        supported: true,
        platformKey: "generic",
        platform: "Web Media",
        title: options.title || "Extracted Media Stream",
        thumbnail: options.thumbnail || null,
        duration: options.duration || "00:00",
        primaryStreamUrl: options.streamUrl,
        streamUrl: options.streamUrl,
        rawUrls: { videoUrl: options.streamUrl },
        formats: [synthesizedFormat],
        audioFormats: isAudioOnly ? [synthesizedFormat] : [],
        qualityOptions: [
          {
            id: options.quality || "best",
            quality: options.quality || "best",
            label: `Best Available (${parsedHeight}p)`,
            height: parsedHeight,
            videoFormatId: synthesizedFormat.formatId,
            audioFormatId: "best",
            streamUrl: options.streamUrl
          }
        ],
        provider: "NativeFallbackProvider"
      };
    }

    if (!cachedAnalysis) {
      const freshAnalysis = await this.analyze(cleanUrl);
      if (!freshAnalysis.supported) {
        const err = new Error(freshAnalysis.error || "Media extraction failed.");
        err.category = freshAnalysis.category;
        throw err;
      }
      cachedAnalysis = freshAnalysis;
    }

    const targetFormat = (options.format || "mp4").toLowerCase();
    const isAudioOnly = ["mp3", "m4a", "wav", "aac", "flac"].includes(targetFormat);

    // 2. Format & Quality Selection
    let selectedVideoFormatId = options.videoFormatId || options.formatId;
    let selectedAudioFormatId = options.audioFormatId;
    let targetHeight = null;
    let requiresDownscale = false;

    const qualityParam = options.selectedQuality || options.quality || "best";

    if (qualityParam && qualityParam !== "best") {
      const parsedH = parseInt(qualityParam, 10);
      if (parsedH > 0) {
        targetHeight = parsedH;
        // Check if extracted formats have an exact stream for parsedH
        const matchingFormat = cachedAnalysis.formats.find(f => Math.abs((f.height || 0) - parsedH) <= 20);

        if (matchingFormat) {
          selectedVideoFormatId = matchingFormat.formatId;
        } else {
          // Pick closest/best available stream without CPU downscaling to avoid serverless timeouts
          const bestOpt = cachedAnalysis.qualityOptions.find(q => q.id === "best") || cachedAnalysis.qualityOptions[0];
          selectedVideoFormatId = bestOpt ? bestOpt.videoFormatId : "best";
        }
      }
    }

    if (!selectedVideoFormatId && cachedAnalysis.qualityOptions.length > 0) {
      selectedVideoFormatId = cachedAnalysis.qualityOptions[0].videoFormatId;
      selectedAudioFormatId = cachedAnalysis.qualityOptions[0].audioFormatId;
      targetHeight = cachedAnalysis.qualityOptions[0].height;
    }

    // Resolve matching stream format objects from analysis
    const matchingVideoFormat =
      (cachedAnalysis.formats || []).find((f) => f.formatId === selectedVideoFormatId) ||
      (cachedAnalysis.formats || []).find((f) => f.hasVideo || (f.height || 0) > 0) ||
      (cachedAnalysis.formats || [])[0] ||
      null;

    const matchingAudioFormat =
      (cachedAnalysis.audioFormats || []).find((f) => f.formatId === selectedAudioFormatId) ||
      (cachedAnalysis.formats || []).find((f) => f.formatId === selectedAudioFormatId) ||
      (cachedAnalysis.audioFormats || [])[0] ||
      null;

    const directStreamUrl =
      matchingVideoFormat?.streamUrl ||
      matchingVideoFormat?.url ||
      matchingVideoFormat?.rawUrls?.videoUrl ||
      cachedAnalysis.primaryStreamUrl ||
      cachedAnalysis.rawUrls?.videoUrl ||
      null;

    // 3. Create Job Record
    const job = JobManager.createJob(cleanUrl, {
      title: cachedAnalysis.title,
      platform: cachedAnalysis.platform,
      thumbnail: cachedAnalysis.thumbnail,
      duration: cachedAnalysis.duration,
      qualityTarget: targetHeight ? `${targetHeight}p` : "Best",
      outputFormat: targetFormat
    });

    JobManager.updateJob(job.id, { status: "DOWNLOADING" });

    const rawOutputPath = JobManager.getJobTempFilePath(job.id, "raw." + (isAudioOnly ? "m4a" : "mp4"));
    const finalOutputPath = JobManager.getJobTempFilePath(job.id, targetFormat);

    try {
      // 4. Download requested video + audio stream using provider
      const downloadedPath = await this.providerManager.downloadFormat(cleanUrl, {
        videoFormatId: selectedVideoFormatId,
        audioFormatId: selectedAudioFormatId,
        targetHeight,
        outputFormat: targetFormat,
        format: matchingVideoFormat,
        audioFormat: matchingAudioFormat,
        url: directStreamUrl,
        streamUrl: directStreamUrl,
        rawUrls: matchingVideoFormat?.rawUrls || cachedAnalysis.rawUrls || (directStreamUrl ? { videoUrl: directStreamUrl } : null),
        isHls: matchingVideoFormat?.isHls || Boolean(directStreamUrl?.includes(".m3u8")),
        formats: cachedAnalysis.formats
      }, rawOutputPath);

      // Validate raw downloaded file before processing with FFmpeg
      if (!fs.existsSync(downloadedPath) || fs.statSync(downloadedPath).size < 512) {
        throw new Error("Downloaded raw media stream file is empty or missing.");
      }

      try {
        const headerBuf = Buffer.alloc(256);
        const fd = fs.openSync(downloadedPath, "r");
        fs.readSync(fd, headerBuf, 0, 256, 0);
        fs.closeSync(fd);
        const headerStr = headerBuf.toString("utf8", 0, 256).toLowerCase();
        if (headerStr.includes("<!doctype") || headerStr.includes("<html") || headerStr.includes("<head")) {
          throw new Error("Stream extraction received an HTML webpage or anti-bot challenge instead of a media file.");
        }
      } catch (checkErr) {
        if (checkErr.message.includes("HTML webpage")) throw checkErr;
      }

      JobManager.updateJob(job.id, { status: "PROCESSING" });

      // 5. Container Conversion / Remuxing / Instant Stream Copy
      if (downloadedPath !== finalOutputPath) {
        const downloadedExt = path.extname(downloadedPath).replace(".", "").toLowerCase();
        if (downloadedExt === targetFormat.toLowerCase() || (targetFormat === "mp4" && (downloadedExt === "mp4" || downloadedExt === "m4v"))) {
          fs.copyFileSync(downloadedPath, finalOutputPath);
        } else {
          await convertMediaContainer(downloadedPath, targetFormat, finalOutputPath);
        }
      }

      // 6. Check file size limit
      const sizeCheck = JobManager.checkFileSizeLimit(finalOutputPath);
      if (sizeCheck.exceeded) {
        const err = new Error(sizeCheck.error);
        err.category = ErrorCategory.FILE_TOO_LARGE;
        throw err;
      }

      // 7. Output Validation with ffprobe
      const validation = await validateMediaOutput(finalOutputPath, isAudioOnly ? "audio" : "video");
      if (!validation.valid) {
        const err = new Error(validation.error || "Generated output file failed media validation.");
        err.category = ErrorCategory.OUTPUT_VALIDATION_FAILED;
        throw err;
      }

      const mimeType = isAudioOnly
        ? (targetFormat === "mp3" ? "audio/mpeg" : targetFormat === "wav" ? "audio/wav" : "audio/mp4")
        : (targetFormat === "webm" ? "video/webm" : "video/mp4");

      // 8. Update job status to COMPLETED
      JobManager.updateJob(job.id, {
        status: "COMPLETED",
        outputPath: finalOutputPath,
        mimeType,
        ext: targetFormat,
        fileSize: validation.metadata.fileSize,
        duration: validation.metadata.duration,
        validation: validation.metadata,
        resolution: validation.metadata.width && validation.metadata.height ? `${validation.metadata.width}x${validation.metadata.height}` : null,
        height: validation.metadata.height,
        width: validation.metadata.width,
        fps: validation.metadata.fps,
        videoCodec: validation.metadata.videoCodec,
        audioCodec: validation.metadata.audioCodec
      });

      return JobManager.getJob(job.id);
    } catch (err) {
      // Clean up final output on failure
      if (fs.existsSync(finalOutputPath)) {
        try { fs.unlinkSync(finalOutputPath); } catch (_) {}
      }
      JobManager.updateJob(job.id, {
        status: "FAILED",
        error: err.message || "Media processing failed."
      });
      throw err;
    } finally {
      // Clean up raw downloaded temp file if different from final output
      if (rawOutputPath && rawOutputPath !== finalOutputPath && fs.existsSync(rawOutputPath)) {
        try { fs.unlinkSync(rawOutputPath); } catch (_) {}
      }
    }
  }

  /**
   * 3. CONVERT
   */
  async convert(inputPath, targetFormat, outputPath) {
    return await convertMediaContainer(inputPath, targetFormat, outputPath);
  }

  /**
   * 4. VALIDATE
   */
  async validate(outputPath, expectedType = "any") {
    return await validateMediaOutput(outputPath, expectedType);
  }

  /**
   * 5. PROVIDER HEALTH CHECK DIAGNOSTICS
   */
  async getDiagnostics() {
    const testUrls = {
      YouTube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      Instagram: "https://www.instagram.com/reel/DavS9yXTFna/",
      TikTok: "https://www.tiktok.com/@tiktok/video/7000000000000000000",
      Facebook: "https://www.facebook.com/watch/?v=10159182393378729",
      Twitter: "https://x.com/Twitter/status/1600000000000000000",
      Reddit: "https://www.reddit.com/r/videos/",
      Vimeo: "https://vimeo.com/76979871",
      Pexels: "https://www.pexels.com/download/video/10395606/"
    };

    const diagnostics = {};

    for (const [platformName, testUrl] of Object.entries(testUrls)) {
      try {
        const platform = detectPlatform(testUrl);
        const res = await this.providerManager.analyze(testUrl);
        diagnostics[platformName] = {
          status: res && res.formats && res.formats.length > 0 ? "Working" : "Degraded",
          available: true,
          provider: res.provider || "yt-dlp"
        };
      } catch (err) {
        diagnostics[platformName] = {
          status: "Unavailable / Auth Required",
          available: false,
          error: err.message
        };
      }
    }

    return diagnostics;
  }
}

export const universalDownloader = new UniversalMediaDownloader();
