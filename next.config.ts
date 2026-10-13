import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: [
    "@prisma/client",
    "bullmq",
    "ioredis",
    "ffmpeg-static",
    "ffprobe-static",
    "yt-dlp-exec",
  ],
};

export default nextConfig;
