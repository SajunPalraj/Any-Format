/**
 * AnyFormat URL Downloader Processing Engine
 */

export async function processUrlMedia(urlInput, options = {}, signal = null) {
  const targetExt = (options.format || "mp4").toLowerCase();
  const jobId = options.jobId;
  const quality = options.quality || "best";
  const qualityMode = options.qualityMode || "exact";
  const videoFormatId = options.videoFormatId || options.formatId;
  const audioFormatId = options.audioFormatId;
  const streamUrl = options.streamUrl;

  let requestUrl = `/api/download?url=${encodeURIComponent(urlInput)}&format=${encodeURIComponent(targetExt)}&quality=${encodeURIComponent(quality)}&qualityMode=${encodeURIComponent(qualityMode)}`;
  if (jobId) requestUrl += `&jobId=${encodeURIComponent(jobId)}`;
  if (videoFormatId) requestUrl += `&videoFormatId=${encodeURIComponent(videoFormatId)}`;
  if (audioFormatId) requestUrl += `&audioFormatId=${encodeURIComponent(audioFormatId)}`;
  if (streamUrl) requestUrl += `&streamUrl=${encodeURIComponent(streamUrl)}`;

  // Default 55-second client timeout to prevent indefinite hanging in the UI
  const internalController = new AbortController();
  const timeoutId = setTimeout(() => {
    internalController.abort(new Error("Media processing timed out (exceeded 55s limit)."));
  }, 55000);

  // Link external cancellation signal if provided
  if (signal) {
    signal.addEventListener("abort", () => {
      internalController.abort(signal.reason || new Error("Processing was cancelled."));
    });
  }

  try {
    const response = await fetch(requestUrl, { signal: internalController.signal });

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
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        internalController.signal.reason?.message ||
        "Media processing timed out or was cancelled. The media stream may be unreachable or transcoding took too long."
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
