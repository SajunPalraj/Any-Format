/**
 * Error categories for UniversalMediaDownloader.
 */
export const ErrorCategory = {
  UNSUPPORTED_URL: "UNSUPPORTED_URL",
  CONTENT_NOT_FOUND: "CONTENT_NOT_FOUND",
  PRIVATE_CONTENT: "PRIVATE_CONTENT",
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  LOGIN_REQUIRED: "LOGIN_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",
  GEO_RESTRICTED: "GEO_RESTRICTED",
  EXTRACTOR_ERROR: "EXTRACTOR_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  NO_MEDIA_FOUND: "NO_MEDIA_FOUND",
  DOWNLOAD_FAILED: "DOWNLOAD_FAILED",
  FFMPEG_FAILED: "FFMPEG_FAILED",
  OUTPUT_VALIDATION_FAILED: "OUTPUT_VALIDATION_FAILED",
  FILE_TOO_LARGE: "FILE_TOO_LARGE"
};

/**
 * Classifies raw extractor error strings / exceptions into structured error objects.
 */
export function classifyDownloaderError(rawError, platform = "") {
  const message = typeof rawError === "string" ? rawError : rawError?.message || "";
  const lower = message.toLowerCase();
  const isInsta = (platform && platform.toLowerCase().includes("instagram")) || lower.includes("instagram");

  let category = ErrorCategory.EXTRACTOR_ERROR;
  let userMessage = "The media engine encountered an issue processing this URL.";

  if (isInsta && (lower.includes("empty media response") || lower.includes("unreachable") || lower.includes("logged-in") || lower.includes("use --cookies") || lower.includes("login required") || lower.includes("redirected to login"))) {
    category = ErrorCategory.AUTHENTICATION_REQUIRED;
    userMessage = "Instagram requires authentication for this URL. Make sure the Story or Post is public and accessible without login.";
  } else if (isInsta && (lower.includes("there's no video") || lower.includes("no video in this post"))) {
    category = ErrorCategory.NO_MEDIA_FOUND;
    userMessage = "Instagram did not return a downloadable video.";
  } else if (lower.includes("private video") || lower.includes("private post") || lower.includes("account is private") || lower.includes("this content is private")) {
    category = ErrorCategory.PRIVATE_CONTENT;
    userMessage = isInsta
      ? "Instagram could not provide this media. Make sure the Story or Post is public and accessible without login."
      : `${platform || "This platform"} media is private and cannot be accessed publicly.`;
  } else if (lower.includes("login required") || lower.includes("use --cookies") || lower.includes("authentication required") || lower.includes("log in to view")) {
    category = ErrorCategory.AUTHENTICATION_REQUIRED;
    userMessage = isInsta
      ? "Instagram requires authentication for this URL."
      : `${platform || "This platform"} requires account authentication or login to access this media.`;
  } else if (lower.includes("429") || lower.includes("too many requests") || lower.includes("rate-limit") || lower.includes("rate limited")) {
    category = ErrorCategory.RATE_LIMITED;
    userMessage = `${platform || "The platform"} temporarily rate-limited access. Please wait a moment and try again.`;
  } else if (lower.includes("404") || lower.includes("not found") || lower.includes("does not exist") || lower.includes("video unavailable")) {
    category = ErrorCategory.CONTENT_NOT_FOUND;
    userMessage = "The requested video or story could not be found or has expired.";
  } else if (lower.includes("geoblocked") || lower.includes("not available in your country") || lower.includes("geo-restricted")) {
    category = ErrorCategory.GEO_RESTRICTED;
    userMessage = "This media is restricted in the current geographic region.";
  } else if (lower.includes("no video formats") || lower.includes("no media found") || lower.includes("unsupported url")) {
    category = ErrorCategory.NO_MEDIA_FOUND;
    userMessage = isInsta ? "Instagram did not return a downloadable video." : "No extractable video or audio streams were found at this URL.";
  } else if (lower.includes("timeout") || lower.includes("econnreset") || lower.includes("etimedout") || lower.includes("fetch failed")) {
    category = ErrorCategory.NETWORK_ERROR;
    userMessage = "Download timed out. Please try again.";
  }

  return {
    category,
    userMessage,
    rawError: message,
    platform
  };
}

