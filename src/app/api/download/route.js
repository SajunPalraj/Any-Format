import { NextResponse } from "next/server";
import { universalDownloader } from "@/lib/downloader/universalMediaDownloader";

// Route updated to reload provider manager with impersonate and universal sniffer

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const urlParam = searchParams.get("url");
    const isAnalyze = searchParams.get("analyze") === "true";
    const format = searchParams.get("format") || "mp4";
    const jobId = searchParams.get("jobId");
    const streamUrl = searchParams.get("streamUrl");

    // UNIVERSAL MEDIA DOWNLOADER PIPELINE
    if (urlParam) {
      // 1. ANALYSIS STEP
      if (isAnalyze) {
        const analysis = await universalDownloader.analyze(urlParam);
        if (analysis.supported) {
          return NextResponse.json({
            success: true,
            supported: true,
            jobId: analysis.jobId,
            platform: analysis.platform,
            platformKey: analysis.platformKey,
            title: analysis.title,
            thumbnail: analysis.thumbnail,
            duration: analysis.duration,
            uploader: analysis.uploader,
            qualityOptions: analysis.qualityOptions || [],
            formats: analysis.formats || [],
            audioFormats: analysis.audioFormats || [],
            hasVideo: analysis.hasVideo,
            hasAudio: analysis.hasAudio,
            provider: analysis.provider,
            primaryStreamUrl: analysis.primaryStreamUrl || null
          });
        }

        const statusCode =
          analysis.category === "AUTHENTICATION_REQUIRED" || analysis.category === "LOGIN_REQUIRED"
            ? 401
            : analysis.category === "RATE_LIMITED"
            ? 429
            : 400;

        return NextResponse.json(
          {
            success: false,
            supported: false,
            platform: analysis.platform || "Web Media",
            platformKey: analysis.platformKey || "generic",
            category: analysis.category || "UNSUPPORTED_URL",
            error: analysis.error || "This URL media could not be extracted."
          },
          { status: statusCode }
        );
      }

      // 2. DOWNLOAD & CONVERSION STEP
      try {
        const videoFormatId = searchParams.get("videoFormatId");
        const audioFormatId = searchParams.get("audioFormatId");
        const selectedQuality = searchParams.get("quality") || searchParams.get("selectedQuality");
        const qualityMode = searchParams.get("qualityMode") || "exact";

        const job = await universalDownloader.downloadJob(urlParam, {
          jobId,
          format,
          quality: selectedQuality,
          qualityMode,
          videoFormatId,
          audioFormatId,
          streamUrl
        });

        if (job && job.status === "COMPLETED") {
          const previewUrl = `/api/jobs/${job.id}/output`;
          const downloadUrl = `/api/jobs/${job.id}/output?download=1`;

          return NextResponse.json({
            success: true,
            jobId: job.id,
            title: job.metadata?.title || "downloaded-media",
            fileSize: job.fileSize,
            duration: job.duration,
            ext: job.ext,
            mimeType: job.mimeType,
            resolution: job.resolution || (job.width && job.height ? `${job.width}x${job.height}` : null),
            height: job.height,
            width: job.width,
            fps: job.fps,
            videoCodec: job.videoCodec,
            audioCodec: job.audioCodec,
            previewUrl,
            downloadUrl
          });
        }
      } catch (err) {
        return NextResponse.json(
          {
            success: false,
            category: err.category || "DOWNLOAD_FAILED",
            error: err.message || "Failed to extract or convert requested URL media."
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Missing url parameter for media download." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Download Endpoint Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process download request" },
      { status: 500 }
    );
  }
}
