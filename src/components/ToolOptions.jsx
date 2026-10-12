"use client";
import React from "react";
import { Film, Music2, Check, SlidersHorizontal } from "lucide-react";

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
      <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 mb-5 text-left transition-all">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-semibold tracking-wider uppercase text-zinc-300 font-mono">
              Output Configuration
            </span>
          </div>
          {analyzedMedia?.platform && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-zinc-300">
              {analyzedMedia.platform}
            </span>
          )}
        </div>

        {/* Media Type Segmented Tabs */}
        <div className="mb-4">
          <label className="block text-[11px] font-mono font-medium text-zinc-400 mb-2 uppercase">
            Output Stream Type
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 border border-zinc-800 rounded-lg">
            <button
              type="button"
              onClick={() => {
                updateOption("format", "mp4");
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                !isAudioOnly
                  ? "bg-zinc-800 text-white font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Video + Audio (Remux)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                updateOption("format", "mp3");
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                isAudioOnly
                  ? "bg-zinc-800 text-white font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Music2 className="w-3.5 h-3.5" />
              <span>Audio Only (Demux)</span>
            </button>
          </div>
        </div>

        {/* Container Format Selector */}
        <div className="mb-5">
          <label className="block text-[11px] font-mono font-medium text-zinc-400 mb-1.5 uppercase">
            Container Format
          </label>
          <div className="flex flex-wrap gap-2">
            {!isAudioOnly ? (
              [
                { value: "mp4", label: "MP4 (H.264 / AAC universal)" },
                { value: "webm", label: "WebM (VP9 / Opus web stream)" },
                { value: "mkv", label: "MKV (Matroska lossless container)" }
              ].map((fmt) => (
                <button
                  key={fmt.value}
                  type="button"
                  onClick={() => updateOption("format", fmt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                    currentFormat === fmt.value
                      ? "border-zinc-300 bg-zinc-200 text-zinc-950 font-bold"
                      : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  {fmt.label}
                </button>
              ))
            ) : (
              [
                { value: "mp3", label: "MP3 (MPEG Layer 3)" },
                { value: "m4a", label: "M4A (AAC Stream Direct)" },
                { value: "wav", label: "WAV (Uncompressed PCM)" }
              ].map((fmt) => (
                <button
                  key={fmt.value}
                  type="button"
                  onClick={() => updateOption("format", fmt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                    currentFormat === fmt.value
                      ? "border-zinc-300 bg-zinc-200 text-zinc-950 font-bold"
                      : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  {fmt.label}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Dynamic Video Qualities */}
        {!isAudioOnly && qualityOptions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-mono font-medium text-zinc-400 uppercase">
                Available Video Qualities ({qualityOptions.length})
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
                    className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-zinc-800 border-zinc-400 text-white shadow-sm"
                        : "bg-zinc-950/80 border-zinc-800/90 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium text-xs mb-1.5">
                      <span className="flex items-center gap-1.5">
                        {isSelected && <Check className="w-3.5 h-3.5 text-zinc-200" />}
                        <span className={isSelected ? "font-bold text-white" : ""}>
                          {opt.label || `${opt.height}p`}
                        </span>
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected
                            ? "bg-zinc-900 text-zinc-200 border border-zinc-700"
                            : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                        }`}
                      >
                        {opt.resolution || `${opt.height}p`}
                      </span>
                    </div>

                    <div className="text-[10px] flex items-center justify-between font-mono pt-1 border-t border-zinc-800/80 text-zinc-500">
                      <span>{opt.fps ? `${opt.fps} fps` : "standard fps"}</span>
                      <span>{estMB}</span>
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
            <label className="block text-[11px] font-mono font-medium text-zinc-400 mb-2 uppercase">
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
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "bg-zinc-800 border-zinc-400 text-white shadow-sm"
                        : "bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <div className="text-xs font-mono font-bold flex items-center justify-between">
                      <span>{rate} kbps</span>
                      {isSelected && <Check className="w-3 h-3 text-zinc-200" />}
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
