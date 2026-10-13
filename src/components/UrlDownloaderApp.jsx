"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
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
  FileAudio,
  Radio,
  Copy,
  Check,
  Code2
} from "lucide-react";

// Curated live sample presets with vibrant brand tags
const SAMPLE_PRESETS = [
  {
    id: "mixkit",
    label: "Mixkit Stock",
    tag: "Free 4K Clip",
    color: "text-cyan-800 dark:text-cyan-300 border-cyan-500/30 bg-cyan-50/70 dark:bg-cyan-950/20",
    url: "https://mixkit.co/free-stock-video/tunnel-of-futuristic-neon-lights-41584/"
  },
  {
    id: "pixabay",
    label: "Pixabay 4K",
    tag: "Stock Undersea",
    color: "text-emerald-800 dark:text-emerald-300 border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20",
    url: "https://pixabay.com/videos/octopus-underwater-sea-152482/"
  },
  {
    id: "youtube",
    label: "YouTube HD",
    tag: "Video & Audio",
    color: "text-red-800 dark:text-red-300 border-red-500/30 bg-red-50/70 dark:bg-red-950/20",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }
];

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
  const [processingStep, setProcessingStep] = useState(1);
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const conversionAbortRef = useRef(null);

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
      setShowRawJson(false);

      try {
        const res = await fetch(`/api/download?url=${encodeURIComponent(targetUrl)}&analyze=true`);
        const data = await res.json();

        if (res.ok && data.success && data.supported) {
          const mediaObj = {
            jobId: data.jobId,
            title: data.title || "Extracted Media Stream",
            uploader: data.uploader || "",
            duration: data.duration || "00:00",
            platform: data.platform || (targetUrl ? detectPlatform(targetUrl)?.displayName : "Web Media"),
            thumbnail: data.thumbnail,
            qualityOptions: data.qualityOptions || [],
            formats: data.formats || [],
            audioFormats: data.audioFormats || [],
            rawJson: data
          };

          setAnalyzedMedia(mediaObj);

          if (data.qualityOptions && data.qualityOptions.length > 0) {
            const defaultOpt = data.qualityOptions[0];
            setOptions((prev) => ({
              ...prev,
              jobId: data.jobId,
              quality: defaultOpt.quality,
              videoFormatId: defaultOpt.videoFormatId,
              audioFormatId: defaultOpt.audioFormatId,
              format: defaultOpt.extension || "mp4",
              streamUrl: defaultOpt.streamUrl || defaultOpt.url || data.primaryStreamUrl || null
            }));
          } else {
            setOptions((prev) => ({
              ...prev,
              jobId: data.jobId,
              streamUrl: data.primaryStreamUrl || null
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

  const handleCancelConversion = () => {
    if (conversionAbortRef.current) {
      conversionAbortRef.current.abort(new Error("Processing was cancelled by user."));
      conversionAbortRef.current = null;
    }
    setStatus("idle");
    setErrorMsg("Media processing was cancelled.");
  };

  const handleStartConversion = async () => {
    if (!urlInput) {
      setErrorMsg("Please enter a media URL to process.");
      return;
    }

    const abortController = new AbortController();
    conversionAbortRef.current = abortController;

    setStatus("processing");
    setProcessingStep(1);
    setErrorMsg("");

    const stepInterval = setInterval(() => {
      setProcessingStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1200);

    try {
      const urlRes = await processUrlMedia(urlInput, options, abortController.signal);
      clearInterval(stepInterval);

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

      const completedRecord = {
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
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type:
          activeExt === "mp3" || activeExt === "m4a" || activeExt === "wav"
            ? "audio"
            : "video"
      };

      setResultData(completedRecord);
      setSessionHistory((prev) => [completedRecord, ...prev.slice(0, 4)]);
      setStatus("completed");
    } catch (err) {
      clearInterval(stepInterval);
      console.warn("URL Downloader Error:", err.message);
      setErrorMsg(err.message || "An unexpected error occurred during URL processing.");
      setStatus("idle");
    } finally {
      conversionAbortRef.current = null;
    }
  };

  const handleCopyLink = () => {
    if (resultData?.downloadUrl || resultData?.blobUrl) {
      navigator.clipboard.writeText(resultData.downloadUrl || resultData.blobUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
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
      {/* Workbench Card - Mobile-Optimized Padding and Elevation */}
      <div className="w-full bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 md:p-8 shadow-xl text-left backdrop-blur-md transition-colors">
        {/* Status Idle Screen */}
        {status === "idle" && (
          <div className="w-full">
            {/* Studio Monitor Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 mb-4 sm:mb-5 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                {/* Colorful Live Equalizer */}
                <div className="flex items-end gap-1 h-5 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shrink-0">
                  <div className="w-1 bg-emerald-500 rounded-full vu-bar-1" />
                  <div className="w-1 bg-teal-400 rounded-full vu-bar-2" />
                  <div className="w-1 bg-cyan-500 rounded-full vu-bar-3" />
                  <div className="w-1 bg-amber-400 rounded-full vu-bar-4" />
                  <div className="w-1 bg-rose-500 rounded-full vu-bar-5" />
                </div>
                <div>
                  <span className="text-xs font-mono font-bold tracking-wider text-zinc-900 dark:text-zinc-100 uppercase">
                    Stream Inspection Deck
                  </span>
                  <div className="text-[10px] font-mono text-zinc-500">
                    Engine Active · Ready for Input
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> 100% Private
                </span>
                <span>•</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">Free &amp; No Sign Up</span>
              </div>
            </div>

            {/* Quick Test Presets (Mobile Responsive) */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-mono font-medium text-zinc-600 dark:text-zinc-400 uppercase flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Quick Test Presets (1-Click Test)</span>
                </label>
                <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">Instant extraction check</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SAMPLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setUrlInput(preset.url);
                      handleAnalyzeUrl(preset.url);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] shadow-xs ${preset.color}`}
                  >
                    <div>
                      <div className="text-xs font-mono font-bold">
                        {preset.label}
                      </div>
                      <div className="text-[10px] font-mono opacity-80">
                        {preset.tag}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/80 dark:bg-zinc-900 border border-black/10 dark:border-white/10 font-bold shrink-0">
                      Load ↵
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* URL Input Form (Mobile Stack on phone, inline on tablet+) */}
            <div className="mb-4">
              <label className="block text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                ENTER PUBLIC VIDEO / AUDIO STREAM URL
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAnalyzeUrl();
                      if (e.key === "Escape") {
                        setUrlInput("");
                        setAnalyzedMedia(null);
                      }
                    }}
                    placeholder="https://mixkit.co/... or https://pixabay.com/... or https://youtube.com/..."
                    className="w-full pl-3.5 pr-20 py-3 sm:py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
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
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded cursor-pointer"
                        title="Clear (Esc)"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePasteClipboard}
                        className="flex items-center gap-1 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-2 py-1 rounded bg-zinc-200/70 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Paste from clipboard"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5 text-blue-500" />
                        <span>Paste</span>
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleAnalyzeUrl()}
                  disabled={isAnalyzing}
                  className="w-full sm:w-auto px-6 py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 font-mono shadow-md shadow-blue-500/20 active:scale-[0.98]"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
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

              {/* Detected Platform Tag & Mobile Keyboard Hints */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                <div className="flex items-center gap-2">
                  {livePlatform && livePlatform.key !== "unknown" ? (
                    <span className="font-mono text-[10px] sm:text-[11px] px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 flex items-center gap-2 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>Platform:</span> <strong className="text-zinc-950 dark:text-white">{livePlatform.displayName}</strong>
                    </span>
                  ) : (
                    <span className="text-zinc-500 text-[10px] sm:text-[11px] font-mono">
                      Accepts Mixkit, Pixabay, YouTube, Instagram, TikTok, Reddit, Vimeo &amp; web HTML5
                    </span>
                  )}
                </div>

                <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                  <span>Press <kbd className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-1 py-0.5 rounded text-zinc-600 dark:text-zinc-400">↵</kbd> to inspect</span>
                  <span>•</span>
                  <span><kbd className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-1 py-0.5 rounded text-zinc-600 dark:text-zinc-400">ESC</kbd> to clear</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 sm:p-3.5 mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Unsupported Banner */}
            {unsupportedState?.isUnsupported && (
              <div className="w-full bg-amber-50/50 dark:bg-zinc-950 border border-amber-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 my-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-zinc-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-amber-950 dark:text-zinc-200 mb-1">
                      Stream Extraction Notice
                    </h4>
                    <p className="text-xs text-amber-800 dark:text-zinc-400 leading-relaxed mb-3">
                      {unsupportedState.error || "The URL could not be resolved to an unencrypted stream."}
                    </p>
                    <button
                      onClick={() => {
                        setUnsupportedState(null);
                        setUrlInput("");
                        setAnalyzedMedia(null);
                      }}
                      className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-200 hover:bg-zinc-800 text-xs font-mono rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      Reset and Try Another Link
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Analyzed Media Inspector Card (Mobile-responsive aspect ratio) */}
            {analyzedMedia && (
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 sm:p-4 mb-4 sm:mb-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  {analyzedMedia.thumbnail ? (
                    <div className="relative w-full sm:w-40 h-40 sm:h-24 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={analyzedMedia.thumbnail}
                        alt="Stream thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/85 font-mono text-[10px] text-white">
                        {analyzedMedia.duration || "00:00"}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center justify-between sm:justify-start gap-2 mb-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-zinc-800 text-blue-700 dark:text-zinc-300 border border-blue-200 dark:border-zinc-700 font-bold">
                        {analyzedMedia.platform}
                      </span>
                      {analyzedMedia.uploader && (
                        <span className="text-[11px] sm:text-xs font-mono text-zinc-500 truncate">
                          Channel: {analyzedMedia.uploader}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug mb-1">
                      {analyzedMedia.title}
                    </h3>
                    <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono text-zinc-500">
                      <span>Duration: {analyzedMedia.duration}</span>
                      <span>•</span>
                      <span>Streams: {analyzedMedia.qualityOptions?.length || 0}</span>
                    </div>
                  </div>

                  {/* Dev Raw JSON Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="p-1.5 sm:p-2 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-mono flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-xs self-end sm:self-center"
                    title="Toggle raw metadata inspector"
                  >
                    <Code2 className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[11px] sm:text-xs">{showRawJson ? "Hide JSON" : "Raw JSON"}</span>
                  </button>
                </div>

                {/* Collapsible Raw Manifest Viewer */}
                {showRawJson && analyzedMedia.rawJson && (
                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
                      Stream Diagnostic Manifest (Raw JSON)
                    </div>
                    <pre className="max-h-48 overflow-x-auto overflow-y-auto p-3 rounded-lg bg-zinc-900 text-[10px] sm:text-[11px] font-mono text-emerald-400 leading-tight border border-zinc-800">
                      {JSON.stringify(analyzedMedia.rawJson, null, 2)}
                    </pre>
                  </div>
                )}
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
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 font-mono shadow-md shadow-blue-500/20 active:scale-[0.99]"
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

        {/* Processing State with Step Diagnostics */}
        {status === "processing" && (
          <div className="py-10 sm:py-14 text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mx-auto mb-4 sm:mb-5 shadow-xs">
              <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin text-blue-600 dark:text-blue-400" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1 font-mono">
              Processing Media Stream
            </h3>

            {/* Step Progression */}
            <div className="max-w-md mx-auto my-5 sm:my-6 space-y-2 text-left font-mono text-xs">
              <div className={`p-2 sm:p-2.5 rounded-lg border flex items-center justify-between ${
                processingStep >= 1
                  ? "bg-blue-50/60 dark:bg-zinc-950 border-blue-200 dark:border-zinc-700 text-blue-900 dark:text-zinc-200"
                  : "border-zinc-200 dark:border-zinc-900 text-zinc-400"
              }`}>
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[11px] sm:text-xs">1. Connecting to origin stream</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">200 OK</span>
              </div>

              <div className={`p-2 sm:p-2.5 rounded-lg border flex items-center justify-between ${
                processingStep >= 2
                  ? "bg-blue-50/60 dark:bg-zinc-950 border-blue-200 dark:border-zinc-700 text-blue-900 dark:text-zinc-200"
                  : "border-zinc-200 dark:border-zinc-900 text-zinc-400"
              }`}>
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[11px] sm:text-xs">2. FFmpeg demuxing &amp; bitstream packaging</span>
                </span>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">In-Memory</span>
              </div>

              <div className={`p-2 sm:p-2.5 rounded-lg border flex items-center justify-between ${
                processingStep >= 3
                  ? "bg-blue-50/60 dark:bg-zinc-950 border-blue-200 dark:border-zinc-700 text-blue-900 dark:text-zinc-200"
                  : "border-zinc-200 dark:border-zinc-900 text-zinc-400"
              }`}>
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[11px] sm:text-xs">3. Validating container header integrity</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Ready</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center">
              <button
                type="button"
                onClick={handleCancelConversion}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5 text-zinc-500" />
                <span>Cancel Processing</span>
              </button>
            </div>
          </div>
        )}

        {/* Completed State */}
        {status === "completed" && resultData && (
          <div className="py-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-zinc-950 border border-emerald-200 dark:border-zinc-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                    Extraction Complete
                  </h3>
                  <p className="text-[10px] sm:text-[11px] font-mono text-zinc-500">
                    Validated output ready for instant preview and download
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs self-start sm:self-auto"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "Copied" : "Copy Direct Link"}</span>
              </button>
            </div>

            {/* Video Player Preview if Video */}
            {resultData.type === "video" && resultData.blobUrl && (
              <div className="mb-5 sm:mb-6 rounded-xl overflow-hidden bg-black border border-zinc-200 dark:border-zinc-800 shadow-xl">
                <video
                  controls
                  autoPlay={false}
                  preload="metadata"
                  src={resultData.blobUrl}
                  className="w-full max-h-64 sm:max-h-80 mx-auto bg-black"
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
              <div className="mb-5 sm:mb-6 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-2 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                  <FileAudio className="w-4 h-4 text-emerald-500" />
                  <span>Audio Stream Playback</span>
                </div>
                <audio controls src={resultData.blobUrl} className="w-full" />
              </div>
            )}

            {/* Stream Specs Summary */}
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 sm:p-4 mb-5 sm:mb-6 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between border-b border-zinc-200/80 dark:border-zinc-900 pb-1.5">
                  <span>Filename:</span>
                  <span className="text-zinc-900 dark:text-zinc-200 font-semibold truncate max-w-[170px] sm:max-w-[200px]" title={resultData.outputName}>
                    {resultData.outputName}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-200/80 dark:border-zinc-900 pb-1.5">
                  <span>Container:</span>
                  <span className="text-blue-600 dark:text-blue-400 uppercase font-bold">{resultData.ext}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200/80 dark:border-zinc-900 pb-1.5">
                  <span>Verified Size:</span>
                  <span className="text-zinc-900 dark:text-zinc-200 font-semibold">{formatBytes(resultData.outputSize)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200/80 dark:border-zinc-900 pb-1.5">
                  <span>Source Platform:</span>
                  <span className="text-zinc-900 dark:text-zinc-200 font-semibold">{resultData.platform}</span>
                </div>
                {resultData.resolution && (
                  <div className="flex justify-between border-b border-zinc-200/80 dark:border-zinc-900 pb-1.5">
                    <span>Resolution:</span>
                    <span className="text-zinc-900 dark:text-zinc-200">{resultData.resolution}</span>
                  </div>
                )}
                {resultData.fps && (
                  <div className="flex justify-between border-b border-zinc-200/80 dark:border-zinc-900 pb-1.5">
                    <span>Frame Rate:</span>
                    <span className="text-zinc-900 dark:text-zinc-200">{resultData.fps} fps</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons (Mobile-optimized full width stack) */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              {resultData.blobUrl && (
                <a
                  href={resultData.downloadUrl || resultData.blobUrl}
                  download={resultData.outputName}
                  className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 sm:py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer active:scale-[0.98]"
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
                className="w-full sm:w-auto px-5 py-3 sm:py-3.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl font-mono text-xs flex items-center justify-center gap-2 transition-colors border border-zinc-300 dark:border-zinc-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Inspect Another Stream</span>
              </button>
            </div>
          </div>
        )}

        {/* Session Extractions Tray */}
        {sessionHistory.length > 0 && status === "idle" && (
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-5 border-t border-zinc-200 dark:border-zinc-800/80">
            <div className="flex items-center justify-between mb-2.5 text-xs font-mono text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-[11px] sm:text-xs">RECENT SESSION EXTRACTIONS ({sessionHistory.length})</span>
              <button
                type="button"
                onClick={() => setSessionHistory([])}
                className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 underline cursor-pointer"
              >
                Clear History
              </button>
            </div>

            <div className="space-y-2">
              {sessionHistory.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 shrink-0">
                      {item.ext}
                    </span>
                    <span className="text-zinc-800 dark:text-zinc-200 truncate max-w-[160px] sm:max-w-xs font-medium text-[11px] sm:text-xs">
                      {item.outputName}
                    </span>
                    <span className="text-zinc-500 text-[10px] hidden xs:inline">({formatBytes(item.outputSize)})</span>
                  </div>

                  <a
                    href={item.downloadUrl || item.blobUrl}
                    download={item.outputName}
                    className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded shrink-0"
                    title="Download file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
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
        <div className="flex items-center justify-center p-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-500 font-mono text-xs shadow-md">
          <Loader2 className="w-4 h-4 animate-spin mr-2 text-blue-600" />
          <span>Initializing Stream Workbench...</span>
        </div>
      }
    >
      <UrlDownloaderContent />
    </Suspense>
  );
}
