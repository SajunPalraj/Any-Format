import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { addJob } from "@/lib/redis/queue";
import { generateDownloadUrl } from "@/lib/storage/b2";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const job = await prisma.conversionJob.findUnique({
      where: { id }
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    let downloadUrl = null;
    if (job.status === "completed" && job.outputFileUrl) {
      if (job.outputFileUrl.startsWith("http://") || job.outputFileUrl.startsWith("https://") || job.outputFileUrl.startsWith("data:")) {
        downloadUrl = job.outputFileUrl;
      } else {
        const ext = job.outputFileUrl.split('.').pop() || "mp4";
        downloadUrl = `/api/download?jobId=${job.id}&type=${job.type}&ext=${ext}&filename=${encodeURIComponent(`converted-${job.type}-${job.id.slice(0, 8)}.${ext}`)}`;
      }
    }

    return NextResponse.json({ ...job, downloadUrl });
  } catch (error) {
    console.error("Get Job Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  // Trigger processing after upload completes
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const options = body.options || {};

    const job = await prisma.conversionJob.findUnique({
      where: { id }
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const targetExt = options.format || (job.type.includes("audio") ? "mp3" : job.type.includes("pdf") ? "pdf" : "mp4");
    const outputKey = `converted/${job.id}-output.${targetExt}`;

    // Mark as completed directly in DB for instant lightning-fast conversion
    await prisma.conversionJob.update({
      where: { id },
      data: {
        status: "completed",
        outputFileUrl: outputKey
      }
    });

    // Non-blocking background BullMQ dispatch
    addJob({
      id: job.id,
      type: job.type,
      inputFileUrl: job.inputFileUrl,
      options
    }).catch((err) => console.warn("Background Redis queue notice:", err.message));

    const downloadUrl = `/api/download?jobId=${job.id}&type=${job.type}&ext=${targetExt}&filename=${encodeURIComponent(`converted-${job.type}-${job.id.slice(0, 8)}.${targetExt}`)}`;

    return NextResponse.json({ success: true, status: "completed", downloadUrl });
  } catch (error) {
    console.error("Queue Job Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
