"use client";
import React from "react";
import { Film, Music2, Check, SlidersHorizontal, Activity } from "lucide-react";

export default function ToolOptions({ tool, options, setOptions, analyzedMedia }) {
  const updateOption = (key, value) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  if (!tool) return null;

  if (tool.category === "url") {
    const qualityOptions = analyzedMedia?.qualityOptions || [];
    const currentFormat = options.format || "mp4";
    const isAudioOnly = ["mp3", "m4a", "wav", "aac"].includes(currentFormat);

    return (
      <div className="w-full bg-zinc-50/80 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 sm:p-5 mb-4 sm:mb-5 text-left transition-all">
        {/* Deck Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-xs font-semibold tracking-wider uppercase text-zinc-800 dark:text-zinc-300 font-mono">
              Output Configuration
            </span>
          </div>
          {analyzedMedia?.platform && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-500 hidden xs:inline">Source:</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700/80 text-zinc-800 dark:text-zinc-200 font-semibold shadow-xs">
                {analyzedMedia.platform}
              </span>
            </div>
          )}
        </div>

        {/* Media Type Segmented Tabs */}
        <div className="mb-4">
          <label className="block text-[11px] font-mono font-medium text-zinc-600 dark:text-zinc-400 mb-2 uppercase flex items-center justify-between">
            <span>Stream Demux Mode</span>
            <span className="text-[10px] text-zinc-500 font-normal hidden sm:inline">
              {isAudioOnly ? "Isolated Audio Track" : "Audio + Video Combined"}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xs">
            <button
              type="button"
              onClick={() => updateOption("format", "mp4")}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-mono transition-all cursor-pointer ${
                !isAudioOnly
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <Film className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span>Video + Audio</span>
            </button>
            <button
              type="button"
              onClick={() => updateOption("format", "mp3")}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-mono transition-all cursor-pointer ${
                isAudioOnly
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <Music2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Audio Only</span>
            </button>
          </div>
        </div>

        {/* Container Format Selector */}
        <div className="mb-5">
          <label className="block text-[11px] font-mono font-medium text-zinc-600 dark:text-zinc-400 mb-2 uppercase">
            Target Container Format
          </label>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {!isAudioOnly ? (
              [
                { value: "mp4", label: "MP4", desc: "Universal H.264" },
                { value: "webm", label: "WebM", desc: "Web VP9 Stream" },
                { value: "mkv", label: "MKV", desc: "Matroska Container" }
              ].map((fmt) => (
                <button
                  key={fmt.value}
                  type="button"
                  onClick={() => updateOption("format", fmt.value)}
                  className={`p-2 sm:p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    currentFormat === fmt.value
                      ? "border-blue-500 dark:border-blue-400 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/70 text-zinc-700 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="text-xs font-mono font-bold">{fmt.label}</div>
                  <div className="text-[9px] sm:text-[10px] text-zinc-500 font-mono truncate">{fmt.desc}</div>
                </button>
              ))
            ) : (
              [
                { value: "mp3", label: "MP3", desc: "MPEG Layer 3" },
                { value: "m4a", label: "M4A", desc: "Native AAC Stream" },
                { value: "wav", label: "Lossless", desc: "Lossless PCM" }
              ].map((fmt) => (
                <button
                  key={fmt.value}
                  type="button"
                  onClick={() => updateOption("format", fmt.value)}
                  className={`p-2 sm:p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    currentFormat === fmt.value
                      ? "border-emerald-500 dark:border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/70 text-zinc-700 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="text-xs font-mono font-bold">{fmt.label}</div>
                  <div className="text-[9px] sm:text-[10px] text-zinc-500 font-mono truncate">{fmt.desc}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Dynamic Video Qualities */}
        {!isAudioOnly && qualityOptions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-mono font-medium text-zinc-600 dark:text-zinc-400 uppercase flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-500" />
                <span>Available Streams ({qualityOptions.length})</span>
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                Direct source streams
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {qualityOptions.map((opt, idx) => {
                const activeQuality = options.selectedQuality || options.quality || "best";
                const isSelected =
                  activeQuality === opt.id ||
                  activeQuality === opt.quality ||
                  (!options.quality && !options.selectedQuality && idx === 0);
                const estMB = opt.filesize
                  ? (opt.filesize / (1024 * 1024)).toFixed(1) + " MB"
                  : "~10 MB";

                return (
                  <button
                    key={opt.id || idx}
                    type="button"
                    onClick={() => {
                      updateOption("quality", opt.quality || opt.id);
                      updateOption("selectedQuality", opt.quality || opt.id);
                      updateOption("videoFormatId", opt.videoFormatId);
                      updateOption("audioFormatId", opt.audioFormatId);
                    }}
                    className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer group ${
                      isSelected
                        ? "bg-white dark:bg-zinc-800 border-zinc-900 dark:border-zinc-200 text-zinc-950 dark:text-white shadow-sm ring-1 ring-zinc-900 dark:ring-zinc-300"
                        : "bg-white dark:bg-zinc-950/80 border-zinc-200 dark:border-zinc-800/90 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium text-xs mb-1.5">
                      <span className="flex items-center gap-1.5">
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 font-bold" />}
                        <span className={isSelected ? "font-bold text-zinc-950 dark:text-white" : ""}>
                          {opt.label || `${opt.height}p`}
                        </span>
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected
                            ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 font-bold"
                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800"
                        }`}
                      >
                        {opt.resolution || `${opt.height}p`}
                      </span>
                    </div>

                    <div className="text-[10px] flex items-center justify-between font-mono pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 text-zinc-500">
                      <span>{opt.fps ? `${opt.fps} fps` : "standard fps"}</span>
                      <span className="font-semibold text-zinc-600 dark:text-zinc-300">{estMB}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Audio Bitrate Selector */}
        {isAudioOnly && (
          <div>
            <label className="block text-[11px] font-mono font-medium text-zinc-600 dark:text-zinc-400 mb-2 uppercase">
              Target Audio Bitrate
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { rate: "320", note: "Studio (Best)" },
                { rate: "256", note: "High Quality" },
                { rate: "192", note: "Standard" },
                { rate: "128", note: "Compact" }
              ].map(({ rate, note }) => {
                const isSelected =
                  options.audioBitrate === `${rate}k` ||
                  (!options.audioBitrate && rate === "320");
                return (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => updateOption("audioBitrate", `${rate}k`)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white dark:bg-zinc-800 border-emerald-600 dark:border-emerald-400 text-emerald-950 dark:text-white shadow-sm ring-1 ring-emerald-500"
                        : "bg-white dark:bg-zinc-950/80 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="text-xs font-mono font-bold flex items-center justify-between">
                      <span>{rate} kbps</span>
                      {isSelected && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {note}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
