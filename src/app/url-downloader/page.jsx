"use client";
import React from "react";
import Link from "next/link";
import { ArrowLeft, Video } from "lucide-react";
import UrlDownloaderApp from "@/components/UrlDownloaderApp";

export default function UrlDownloaderPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white pt-10 pb-20 px-4 md:px-8 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-xs font-semibold mb-6 transition-colors font-mono">
          <ArrowLeft className="w-4 h-4" />
          Back to AnyFormat Home
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-600/10">
            <Video className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">URL Media Downloader</h1>
          <p className="text-zinc-400 text-sm max-w-xl mx-auto">
            Extract high quality video and audio from supported public media URLs with real resolution selection and SSRF protection.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-zinc-500 mt-3 font-mono">
            <span>Supported: YouTube, IG, FB, TikTok, X &amp; More</span>
            <span>•</span>
            <span>Unlimited File Size</span>
          </div>
        </div>

        <UrlDownloaderApp />
      </div>
    </div>
  );
}

