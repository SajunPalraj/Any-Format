import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    // Validate request
    if (!body.outputFileUrl) {
       return NextResponse.json({ error: "Missing outputFileUrl" }, { status: 400 });
    }

    const job = await prisma.conversionJob.update({
      where: { id },
      data: {
        status: "completed",
        outputFileUrl: body.outputFileUrl,
      }
    });

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error("Complete Job Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
