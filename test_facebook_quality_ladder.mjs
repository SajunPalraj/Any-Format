import { universalDownloader } from "./src/lib/downloader/universalMediaDownloader.js";

async function testQualityLadder() {
  const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  console.log("Analyzing video URL:", testUrl);
  const analysis = await universalDownloader.analyze(testUrl);

  console.log("Analysis Supported:", analysis.supported);
  console.log("Platform:", analysis.platform);
  console.log("Title:", analysis.title);
  console.log("Quality Options Count:", analysis.qualityOptions ? analysis.qualityOptions.length : 0);

  if (analysis.qualityOptions) {
    console.log("\nExtracted Quality Options:");
    analysis.qualityOptions.forEach(opt => {
      console.log(`  - [${opt.id}] ${opt.label} (${opt.resolution}) | VideoFormatId: ${opt.videoFormatId}`);
    });
  }

  // Test downloading user-selected 480p quality
  console.log("\nTesting download of user-selected 480p quality...");
  const job480 = await universalDownloader.downloadJob(testUrl, {
    jobId: analysis.jobId,
    quality: "480p",
    format: "mp4"
  });

  console.log("\nJob Status:", job480.status);
  console.log("Output Path:", job480.outputPath);
  console.log("Probed Output Resolution:", `${job480.width}x${job480.height}`);
  console.log("Probed Output Height:", job480.height);

  if (job480.height === 480) {
    console.log("\n✓ SUCCESS: Output matches the selected 480p quality exactly!");
  } else {
    console.log(`\nHeight is ${job480.height}`);
  }
}

testQualityLadder().catch(console.error);
