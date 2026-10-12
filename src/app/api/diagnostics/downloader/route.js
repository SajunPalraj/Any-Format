import { NextResponse } from "next/server";
import { universalDownloader } from "@/lib/downloader/universalMediaDownloader";

export async function GET() {
  try {
    const status = await universalDownloader.getDiagnostics();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics: status
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err.message || "Diagnostics check failed."
    }, { status: 500 });
  }
}
