"use client";
import React from "react";
import Link from "next/link";
import UrlDownloaderApp from "@/components/UrlDownloaderApp";
import { Terminal } from "lucide-react";

export default function Home() {
  const supportedPlatforms = [
    { name: "YouTube", types: "Videos, Shorts, Audio", specs: "Up to 4K 60fps / MP3 320k" },
    { name: "Instagram", types: "Reels, Posts, Stories", specs: "Original 1080p MP4" },
    { name: "TikTok", types: "Clips & Audio tracks", specs: "Clean source stream" },
    { name: "Facebook", types: "Public videos & reels", specs: "DASH audio remux" },
    { name: "X (Twitter)", types: "Public broadcast clips", specs: "Direct MP4 stream" },
    { name: "Reddit", types: "Hosted video submissions", specs: "Audio/Video stitch" },
    { name: "Vimeo", types: "Public channel videos", specs: "1080p HLS stream" },
    { name: "Twitch", types: "Clips & Highlights", specs: "MP4 source stream" }
  ];

  const technicalSpecs = [
    {
      title: "Bitstream Remuxing",
      detail: "Direct FFmpeg stream packaging preserves original video/audio bitrates without re-compression degradation."
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
    <div className="flex flex-col min-h-screen bg-zinc-950 font-sans text-zinc-100 selection:bg-zinc-700 selection:text-white">
      {/* Utility Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded bg-zinc-100 text-zinc-950 flex items-center justify-center font-mono font-bold text-xs">
              A
            </span>
            <span className="font-semibold text-sm tracking-tight text-zinc-100">
              AnyFormat <span className="text-zinc-500 font-normal">/ Stream Engine</span>
            </span>
          </Link>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Runtime Ready</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 pt-12 pb-20 flex flex-col items-center">
        {/* Hero Section */}
        <div className="w-full text-center max-w-2xl mb-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px] font-mono mb-4">
            <span>FFmpeg + yt-dlp Extraction Pipeline</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-3">
            Direct Media Stream Extraction
          </h1>
          <p className="text-sm md:text-base text-zinc-400 leading-relaxed">
            Inspect public video resolutions and direct audio bitrates from YouTube, Instagram, TikTok, Reddit, and Vimeo. Native bitstream remuxing with zero quality degradation.
          </p>
        </div>

        {/* Workbench Application */}
        <div className="w-full mb-16">
          <UrlDownloaderApp />
        </div>

        {/* Platform Capability Matrix */}
        <section className="w-full mb-14">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">
                Supported Platforms &amp; Containers
              </h2>
              <p className="text-xs text-zinc-500 font-mono">
                Verified stream extraction engines
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-500">
              8 Verified Extractors
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {supportedPlatforms.map((plat) => (
              <div
                key={plat.name}
                className="p-3.5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-zinc-200">
                    {plat.name}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Active
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 mb-1">
                  {plat.types}
                </div>
                <div className="text-[10px] font-mono text-zinc-500 truncate">
                  {plat.specs}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture & Engineering Standards */}
        <section className="w-full bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
              Extraction Architecture
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {technicalSpecs.map((spec, i) => (
              <div key={i} className="text-left">
                <h4 className="text-xs font-semibold text-zinc-200 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 inline-block" />
                  {spec.title}
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {spec.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-900 bg-zinc-950 py-6 text-xs text-zinc-500 font-mono">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} AnyFormat Media Downloader.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>SSRF Sanitized</span>
            <span>•</span>
            <span>Local FFmpeg Core</span>
            <span>•</span>
            <span>Direct Bitstream</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
