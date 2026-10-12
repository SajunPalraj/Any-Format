"use client";
import React, { useState } from "react";
import Link from "next/link";
import UrlDownloaderApp from "@/components/UrlDownloaderApp";
import ThemeToggle from "@/components/ThemeToggle";
import { Terminal, ShieldCheck, Zap, LockOpen, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  const supportedPlatforms = [
    {
      name: "Mixkit",
      category: "Stock Video",
      types: "Free HD & 4K Clips",
      specs: "Up to 4K / Direct MP4",
      color: "border-cyan-500/30 bg-cyan-50/70 dark:bg-cyan-950/20 text-cyan-800 dark:text-cyan-300",
      badgeColor: "bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300"
    },
    {
      name: "Pixabay",
      category: "Stock Video",
      types: "Royalty-free Media",
      specs: "Original 4K / 1080p MP4",
      color: "border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300",
      badgeColor: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300"
    },
    {
      name: "YouTube",
      category: "Streaming",
      types: "Videos, Shorts, Audio",
      specs: "Up to 4K 60fps / MP3 320k",
      color: "border-red-500/30 bg-red-50/70 dark:bg-red-950/20 text-red-800 dark:text-red-300",
      badgeColor: "bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300"
    },
    {
      name: "Instagram",
      category: "Social Media",
      types: "Reels, Posts, Stories",
      specs: "Clean 1080p MP4 stream",
      color: "border-pink-500/30 bg-pink-50/70 dark:bg-pink-950/20 text-pink-800 dark:text-pink-300",
      badgeColor: "bg-pink-100 dark:bg-pink-900/60 text-pink-800 dark:text-pink-300"
    },
    {
      name: "TikTok",
      category: "Short Video",
      types: "Clips & Audio tracks",
      specs: "Original CDN source stream",
      color: "border-teal-500/30 bg-teal-50/70 dark:bg-teal-950/20 text-teal-800 dark:text-teal-300",
      badgeColor: "bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300"
    },
    {
      name: "Reddit",
      category: "Community",
      types: "Hosted v.redd.it videos",
      specs: "DASH audio/video remux",
      color: "border-orange-500/30 bg-orange-50/70 dark:bg-orange-950/20 text-orange-800 dark:text-orange-300",
      badgeColor: "bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-300"
    },
    {
      name: "Vimeo",
      category: "Pro Video",
      types: "Public channel videos",
      specs: "1080p HLS stream capture",
      color: "border-sky-500/30 bg-sky-50/70 dark:bg-sky-950/20 text-sky-800 dark:text-sky-300",
      badgeColor: "bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300"
    },
    {
      name: "X (Twitter)",
      category: "Microblogging",
      types: "Public broadcast clips",
      specs: "Direct MP4 stream stitch",
      color: "border-blue-500/30 bg-blue-50/70 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300",
      badgeColor: "bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300"
    }
  ];

  const technicalSpecs = [
    {
      title: "Bitstream Remuxing",
      detail: "Direct FFmpeg packaging preserves original video/audio bitrates without re-compression degradation."
    },
    {
      title: "SSRF Isolated",
      detail: "All extraction requests validate hostnames against private CIDR ranges (RFC 1918) and loopback interfaces."
    },
    {
      title: "Clean Demuxing",
      detail: "Extract isolated audio tracks (MP3 320k, M4A AAC, WAV) directly from multi-track DASH or HLS manifests."
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 selection:bg-blue-600 selection:text-white relative transition-colors overflow-x-hidden">
      {/* 
        GPU-Accelerated Zero-Lag Ambient Moving Background
        Composited on its own isolated layer via translate3d with will-change: transform.
        Zero JS overhead, zero main-thread block, buttery 60/120fps motion.
      */}
      <div className="ambient-background-container" aria-hidden="true">
        <div className="ambient-glow-layer" />
        <div className="ambient-grid-canvas bg-dot-grid" />
      </div>

      {/* Utility Header with Dark Mode Toggle on Top Right */}
      <header className="border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 transition-colors">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-xs sm:text-sm shadow-sm group-hover:scale-105 transition-transform">
              A
            </span>
            <span className="font-bold text-sm sm:text-base tracking-tight font-mono text-zinc-900 dark:text-white">
              AnyFormat <span className="text-zinc-500 dark:text-zinc-400 font-normal text-xs hidden sm:inline">/ Stream Engine</span>
            </span>
          </Link>

          {/* Right Action Bar with Status and Dark Mode Toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-zinc-900 border border-emerald-200 dark:border-zinc-800 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Service Ready</span>
            </div>

            {/* Dark Mode Toggle Button */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3.5 sm:px-6 pt-6 sm:pt-12 pb-16 sm:pb-20 flex flex-col items-center relative z-10">
        {/* Colorful Trust & Assurance Live Pills (Mobile Responsive Grid/Flex) */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2 sm:gap-2.5 w-full max-w-sm sm:max-w-none mb-6">
          <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] sm:text-xs font-mono font-bold shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>100% Private</span>
          </span>

          <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] sm:text-xs font-mono font-bold shadow-xs">
            <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Free Forever</span>
          </span>

          <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px] sm:text-xs font-mono font-bold shadow-xs">
            <LockOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>No Sign Up</span>
          </span>

          <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[11px] sm:text-xs font-mono font-bold shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>Zero Watermarks</span>
          </span>
        </div>

        {/* Hero Title */}
        <div className="w-full text-center max-w-2xl mb-8 sm:mb-10 px-2">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-zinc-950 dark:text-white mb-2.5 sm:mb-3 leading-tight sm:leading-tight">
            Universal Media Stream Downloader
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans max-w-xl mx-auto">
            Direct video and audio stream extractor for Mixkit, Pixabay, YouTube, Instagram, TikTok, Reddit, and Vimeo. Native bitstream remuxing with zero quality loss.
          </p>
        </div>

        {/* Interactive Workbench Console */}
        <div className="w-full mb-12 sm:mb-14">
          <UrlDownloaderApp />
        </div>

        {/* Colorful Platform Capabilities Deck */}
        <section className="w-full mb-10 sm:mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                SUPPORTED PLATFORMS &amp; CODECS
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-500 font-mono">
                Tap any platform to inspect verified stream pipelines
              </p>
            </div>
            <span className="text-[11px] sm:text-xs font-mono text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-semibold shadow-xs self-start sm:self-auto">
              8 Verified Pipelines
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
            {supportedPlatforms.map((plat) => {
              const isSelected = selectedPlatform?.name === plat.name;
              return (
                <button
                  key={plat.name}
                  type="button"
                  onClick={() => setSelectedPlatform(isSelected ? null : plat)}
                  className={`p-2.5 sm:p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? "ring-2 ring-blue-500 bg-white dark:bg-zinc-800 shadow-md scale-[1.02]"
                      : `${plat.color} hover:scale-[1.01]`
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold font-mono">
                      {plat.name}
                    </span>
                    <span className={`text-[9px] sm:text-[10px] font-mono font-semibold px-1 sm:px-1.5 py-0.5 rounded ${plat.badgeColor}`}>
                      {plat.category}
                    </span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] opacity-90 mb-1 font-medium truncate">
                    {plat.types}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-mono opacity-75 truncate">
                    {plat.specs}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Platform Inspector Detail Card */}
          {selectedPlatform && (
            <div className="mt-3 p-3.5 sm:p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-md animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div className="leading-snug">
                  <span className="text-zinc-950 dark:text-white font-bold">{selectedPlatform.name} Pipeline:</span>{" "}
                  <span className="text-zinc-600 dark:text-zinc-400">{selectedPlatform.specs} ({selectedPlatform.types})</span>
                </div>
              </div>
              <div className="text-blue-600 dark:text-blue-400 font-semibold text-[10px] sm:text-[11px] shrink-0">
                Engine: yt-dlp + Native FFmpeg Core
              </div>
            </div>
          )}
        </section>

        {/* Architecture & Engineering Standards */}
        <section className="w-full bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-xs transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Extraction Architecture &amp; Privacy
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {technicalSpecs.map((spec, i) => (
              <div key={i} className="text-left font-mono">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-200 mb-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 inline-block" />
                  {spec.title}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                  {spec.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 py-6 text-xs text-zinc-500 font-mono transition-colors relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>© {new Date().getFullYear()} AnyFormat Media Downloader. 100% Private &amp; Free.</p>
          <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px]">
            <span>Zero Data Logs</span>
            <span>•</span>
            <span>No Account Needed</span>
            <span>•</span>
            <span>Direct Bitstream</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
