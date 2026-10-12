import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { JobManager } from "@/lib/downloader/jobManager";

export async function GET(request, { params }) {
  const { id: jobId } = await params;
  const url = new URL(request.url);
  const isDownload = url.searchParams.get("download") === "1";

  const job = JobManager.getJob(jobId);

  if (!job || job.status !== "COMPLETED" || !job.outputPath || !fs.existsSync(job.outputPath)) {
    return new NextResponse("Job output file not found or incomplete.", { status: 404 });
  }

  const filePath = job.outputPath;
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const mimeType = job.mimeType || "video/mp4";
  const fileName = job.metadata?.title
    ? `${job.metadata.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50)}.${job.ext}`
    : `media_output.${job.ext}`;

  // If download parameter is set, trigger file download attachment
  if (isDownload) {
    const fileStream = fs.createReadStream(filePath);
    return new NextResponse(fileStream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileSize.toString(),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "public, max-age=3600"
      }
    });
  }

  // Handle HTTP Range Requests (206 Partial Content) for browser HTML5 video playback
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` }
      });
    }

    const chunksize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    return new NextResponse(stream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600"
      }
    });
  }

  // Full file stream (200 OK)
  const fileStream = fs.createReadStream(filePath);
  return new NextResponse(fileStream, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": fileSize.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
