/**
 * AnyFormat URL Downloader Processing Engine
 */

export async function processUrlMedia(urlInput, options = {}) {
  const targetExt = (options.format || "mp4").toLowerCase();
  const jobId = options.jobId;
  const quality = options.quality || "best";
  const qualityMode = options.qualityMode || "exact";
  const videoFormatId = options.videoFormatId || options.formatId;
  const audioFormatId = options.audioFormatId;

  let requestUrl = `/api/download?url=${encodeURIComponent(urlInput)}&format=${encodeURIComponent(targetExt)}&quality=${encodeURIComponent(quality)}&qualityMode=${encodeURIComponent(qualityMode)}`;
  if (jobId) requestUrl += `&jobId=${encodeURIComponent(jobId)}`;
  if (videoFormatId) requestUrl += `&videoFormatId=${encodeURIComponent(videoFormatId)}`;
  if (audioFormatId) requestUrl += `&audioFormatId=${encodeURIComponent(audioFormatId)}`;

  const response = await fetch(requestUrl);

  if (response.ok) {
    const data = await response.json();
    if (data.success && data.previewUrl) {
      return {
        jobId: data.jobId,
        mediaTitle: data.title,
        blobUrl: data.previewUrl,
        downloadUrl: data.downloadUrl,
        size: data.fileSize || 0,
        mimeType: data.mimeType || (targetExt === "mp3" ? "audio/mpeg" : "video/mp4"),
        ext: data.ext || targetExt,
        resolution: data.resolution,
        height: data.height,
        width: data.width,
        fps: data.fps,
        videoCodec: data.videoCodec,
        audioCodec: data.audioCodec
      };
    }
    throw new Error(data.error || "This URL media could not be processed.");
  }

  let errorText = "The media engine encountered an issue processing this URL.";
  try {
    const errJson = await response.json();
    if (errJson.error) errorText = errJson.error;
    else if (errJson.message) errorText = errJson.message;
  } catch (_) {}

  throw new Error(errorText);
}
