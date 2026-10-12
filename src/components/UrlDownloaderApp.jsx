"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getToolById } from "@/lib/tools/registry";
import ToolOptions from "@/components/ToolOptions";
import { processUrlMedia } from "@/lib/tools/engine";
import { detectPlatform } from "@/lib/downloader/siteDetector";
import {
  Download,
  RotateCcw,
  Play,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ClipboardPaste,
  X,
  ShieldCheck,
  FileAudio
} from "lucide-react";

function UrlDownloaderContent() {
  const searchParams = useSearchParams();
  const tool = getToolById("url-downloader");

  const [urlInput, setUrlInput] = useState(() => searchParams.get("url") || "");
  const [analyzedMedia, setAnalyzedMedia] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [unsupportedState, setUnsupportedState] = useState(null);

  const [options, setOptions] = useState(() => ({
    format: "mp4",
    quality: "1080p",
    formatId: null,
    audioBitrate: "320k"
  }));

  const [status, setStatus] = useState("idle");
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const livePlatform = urlInput ? detectPlatform(urlInput) : null;

  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        const clipText = await navigator.clipboard.readText();
        if (clipText) {
          setUrlInput(clipText.trim());
          setErrorMsg("");
          setUnsupportedState(null);
        }
      }
    } catch {
      // Clipboard permission denied or unavailable
    }
  };

  const handleAnalyzeUrl = useCallback(
    async (overrideUrl) => {
      const targetUrl = (overrideUrl || urlInput || "").trim();
      if (!targetUrl) {
        setErrorMsg("Enter a valid HTTP or HTTPS media link to inspect.");
        return;
      }

      setErrorMsg("");
      setUnsupportedState(null);
      setIsAnalyzing(true);

      try {
        const res = await fetch(`/api/download?url=${encodeURIComponent(targetUrl)}&analyze=true`);
        const data = await res.json();

        if (res.ok && data.success && data.supported) {
          setAnalyzedMedia({
            jobId: data.jobId,
            title: data.title || "Extracted Media Stream",
            uploader: data.uploader || "",
            duration: data.duration || "00:00",
            platform: data.platform || (targetUrl ? detectPlatform(targetUrl)?.displayName : "Web Media"),
            thumbnail: data.thumbnail,
            qualityOptions: data.qualityOptions || [],
            formats: data.formats || [],
            audioFormats: data.audioFormats || []
          });

          if (data.qualityOptions && data.qualityOptions.length > 0) {
            const defaultOpt = data.qualityOptions[0];
            setOptions((prev) => ({
              ...prev,
              jobId: data.jobId,
              quality: defaultOpt.quality,
              videoFormatId: defaultOpt.videoFormatId,
              audioFormatId: defaultOpt.audioFormatId,
              format: defaultOpt.extension || "mp4"
            }));
          }
          setIsAnalyzing(false);
          return;
        } else {
          setUnsupportedState({
            isUnsupported: true,
            platform: data.platform || (targetUrl ? detectPlatform(targetUrl)?.displayName : "Web Media"),
            category: data.category,
            error: data.error || "This media stream could not be extracted or is unsupported."
          });
          setAnalyzedMedia(null);
        }
      } catch {
        setUnsupportedState({
          isUnsupported: true,
          platform: targetUrl ? detectPlatform(targetUrl)?.displayName : "Web Media",
          error: "Failed to connect to extraction worker. Verify the URL or check your network."
        });
        setAnalyzedMedia(null);
      }

      setIsAnalyzing(false);
    },
    [urlInput]
  );

  useEffect(() => {
    const queryUrl = searchParams.get("url");
    if (queryUrl && !analyzedMedia && !isAnalyzing) {
      const timer = setTimeout(() => {
        handleAnalyzeUrl(queryUrl);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, analyzedMedia, isAnalyzing, handleAnalyzeUrl]);

  const handleStartConversion = async () => {
    if (!urlInput) {
      setErrorMsg("Please enter a media URL to process.");
      return;
    }

    setStatus("processing");
    setErrorMsg("");

    try {
      const urlRes = await processUrlMedia(urlInput, options);
      const activeExt = (urlRes.ext || options.format || "mp4").toLowerCase();
      const activeMime =
        urlRes.mimeType ||
        (activeExt === "mp3"
          ? "audio/mpeg"
          : activeExt === "webm"
          ? "video/webm"
          : "video/mp4");

      const mediaTitle = urlRes.mediaTitle || analyzedMedia?.title || "downloaded-media";
      const safeTitle = mediaTitle.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 60);

      setResultData({
        originalName: mediaTitle,
        originalSize: urlRes.size,
        outputName: `${safeTitle}.${activeExt}`,
        outputSize: urlRes.size,
        blobUrl: urlRes.blobUrl,
        downloadUrl: urlRes.downloadUrl || `${urlRes.blobUrl}?download=1`,
        thumbnailUrl: analyzedMedia?.thumbnail,
        platform: analyzedMedia?.platform || livePlatform?.displayName || "Media Stream",
        ext: activeExt,
        mimeType: activeMime,
        resolution: urlRes.resolution,
        height: urlRes.height,
        width: urlRes.width,
        fps: urlRes.fps,
        videoCodec: urlRes.videoCodec,
        audioCodec: urlRes.audioCodec,
        type:
          activeExt === "mp3" || activeExt === "m4a" || activeExt === "wav"
            ? "audio"
            : "video"
      });
      setStatus("completed");
    } catch (err) {
      console.warn("URL Downloader Error:", err.message);
      setErrorMsg(err.message || "An unexpected error occurred during URL processing.");
      setStatus("idle");
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    return `${formatted} (${bytes.toLocaleString()} B)`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Main Console Box */}
      <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-xl text-left">
        {/* Status Idle Screen */}
        {status === "idle" && (
          <div className="w-full">
            {/* Console Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span className="text-xs font-mono font-semibold tracking-wider text-zinc-300 uppercase">
                  Stream Workbench
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" /> SSRF Sanitized
                </span>
                <span>•</span>
                <span>Direct Demux</span>
              </div>
            </div>

            {/* Input Form */}
            <div className="mb-4">
              <label className="block text-xs font-mono text-zinc-400 mb-2">
                SOURCE STREAM URL
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setUnsupportedState(null);
                      setErrorMsg("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyzeUrl()}
                    placeholder="https://www.youtube.com/watch?v=... or https://instagram.com/reel/..."
                    className="w-full pl-3.5 pr-20 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {urlInput ? (
                      <button
                        type="button"
                        onClick={() => {
                          setUrlInput("");
                          setAnalyzedMedia(null);
                          setErrorMsg("");
                          setUnsupportedState(null);
                        }}
                        className="p-1 text-zinc-500 hover:text-zinc-300 rounded"
                        title="Clear input"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePasteClipboard}
                        className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-800/80 hover:bg-zinc-800 transition-colors"
                        title="Paste from clipboard"
                      >
                        <ClipboardPaste className="w-3 h-3" />
                        <span>Paste</span>
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleAnalyzeUrl()}
                  disabled={isAnalyzing}
                  className="px-6 py-3 bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-50 font-semibold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 font-mono shadow-sm"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                      <span>Inspecting...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Inspect Stream</span>
                    </>
                  )}
                </button>
              </div>

              {/* Detected Platform Tag & Examples */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  {livePlatform && livePlatform.key !== "unknown" ? (
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Platform: <strong className="text-white">{livePlatform.displayName}</strong>
                    </span>
                  ) : (
                    <span className="text-zinc-500 text-[11px] font-mono">
                      Accepts YouTube, Instagram, TikTok, Reddit, Vimeo, Twitter/X &amp; Facebook links
                    </span>
                  )}
                </div>

                {/* Quick Test Samples */}
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
                  <span>Samples:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
                      setUrlInput(sample);
                      handleAnalyzeUrl(sample);
                    }}
                    className="underline hover:text-zinc-300"
                  >
                    YouTube
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 mb-4 rounded-xl bg-red-950/40 border border-red-800/80 text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Unsupported / Extraction Issue Banner */}
            {unsupportedState?.isUnsupported && (
              <div className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-5 my-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-zinc-200 mb-1">
                      Extraction Not Available
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                      {unsupportedState.error || "The URL could not be resolved to a downloadable media stream."}
                    </p>
                    <button
                      onClick={() => {
                        setUnsupportedState(null);
                        setUrlInput("");
                        setAnalyzedMedia(null);
                      }}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded-lg transition-colors"
                    >
                      Reset and Try Another Link
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Analyzed Media Inspector Card */}
            {analyzedMedia && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {analyzedMedia.thumbnail ? (
                    <div className="relative w-full sm:w-36 h-24 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={analyzedMedia.thumbnail}
                        alt="Stream thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] text-zinc-200">
                        {analyzedMedia.duration || "00:00"}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {analyzedMedia.platform}
                      </span>
                      {analyzedMedia.uploader && (
                        <span className="text-xs font-mono text-zinc-400 truncate">
                          by {analyzedMedia.uploader}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-snug mb-1">
                      {analyzedMedia.title}
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-500">
                      Duration: {analyzedMedia.duration} • Streams available:{" "}
                      {analyzedMedia.qualityOptions?.length || 0}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Options & Action */}
            {!unsupportedState?.isUnsupported && analyzedMedia && (
              <>
                <ToolOptions
                  tool={tool}
                  options={options}
                  setOptions={setOptions}
                  analyzedMedia={analyzedMedia}
                />

                <div className="pt-2">
                  <button
                    onClick={handleStartConversion}
                    className="w-full bg-zinc-100 hover:bg-white text-zinc-950 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2 font-mono"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      Extract &amp; Download {options.format ? options.format.toUpperCase() : "Media"} (
                      {options.quality || "Original"})
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Processing State */}
        {status === "processing" && (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-200" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-1">
              Processing Media Stream...
            </h3>
            <p className="text-xs font-mono text-zinc-400 max-w-sm mx-auto mb-6">
              Fetching segments, demuxing tracks, and assembling the requested{" "}
              {options.format ? options.format.toUpperCase() : "media"} container.
            </p>
            <div className="w-48 h-1 bg-zinc-800 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-zinc-300 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {/* Completed State */}
        {status === "completed" && resultData && (
          <div className="py-4">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-zinc-800">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Extraction Complete
                </h3>
                <p className="text-[11px] font-mono text-zinc-400">
                  Target container ready for direct download
                </p>
              </div>
            </div>

            {/* Video Player Preview if Video */}
            {resultData.type === "video" && resultData.blobUrl && (
              <div className="mb-6 rounded-xl overflow-hidden bg-black border border-zinc-800">
                <video
                  controls
                  preload="metadata"
                  src={resultData.blobUrl}
                  className="w-full max-h-80 mx-auto"
                >
                  <source
                    src={resultData.blobUrl}
                    type={resultData.mimeType || `video/${resultData.ext || "mp4"}`}
                  />
                </video>
              </div>
            )}

            {/* Audio Player Preview if Audio */}
            {resultData.type === "audio" && resultData.blobUrl && (
              <div className="mb-6 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-2 mb-2 text-xs font-mono text-zinc-400">
                  <FileAudio className="w-4 h-4" />
                  <span>Audio Stream Playback</span>
                </div>
                <audio controls src={resultData.blobUrl} className="w-full" />
              </div>
            )}

            {/* Stream Specs Summary */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-6 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-zinc-400">
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span>Filename:</span>
                  <span className="text-zinc-200 truncate max-w-[200px]" title={resultData.outputName}>
                    {resultData.outputName}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span>Container:</span>
                  <span className="text-zinc-200 uppercase font-bold">{resultData.ext}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span>File Size:</span>
                  <span className="text-zinc-200 font-semibold">{formatBytes(resultData.outputSize)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span>Source Platform:</span>
                  <span className="text-zinc-200">{resultData.platform}</span>
                </div>
                {resultData.resolution && (
                  <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                    <span>Resolution:</span>
                    <span className="text-zinc-200">{resultData.resolution}</span>
                  </div>
                )}
                {resultData.fps && (
                  <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                    <span>Frame Rate:</span>
                    <span className="text-zinc-200">{resultData.fps} fps</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {resultData.blobUrl && (
                <a
                  href={resultData.downloadUrl || resultData.blobUrl}
                  download={resultData.outputName}
                  className="flex-1 bg-zinc-100 hover:bg-white text-zinc-950 py-3 rounded-xl font-semibold text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Save {resultData.ext.toUpperCase()} to Disk</span>
                </a>
              )}

              <button
                onClick={() => {
                  setStatus("idle");
                  setResultData(null);
                  setUnsupportedState(null);
                  setAnalyzedMedia(null);
                }}
                className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-mono text-xs flex items-center justify-center gap-2 transition-colors border border-zinc-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Inspect Another URL</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UrlDownloaderApp() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 font-mono text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span>Initializing Stream Workbench...</span>
        </div>
      }
    >
      <UrlDownloaderContent />
    </Suspense>
  );
}
