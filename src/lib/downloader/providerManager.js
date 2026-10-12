import { detectPlatform, validateUrlSecurity, normalizeMediaUrl } from "./siteDetector.js";
import { YtDlpProvider } from "./providers/ytdlpProvider.js";
import { NativeFallbackProvider } from "./providers/nativeFallbackProvider.js";
import { classifyDownloaderError } from "./errorClassifier.js";

export class ProviderManager {
  constructor() {
    this.providers = [
      new YtDlpProvider(),
      new NativeFallbackProvider()
    ];
  }

  /**
   * Analyzes media URL using configured extraction providers.
   * Returns normalized metadata and format list.
   */
  async analyze(url) {
    const cleanUrl = normalizeMediaUrl(url);

    // 1. SSRF URL Security Validation
    const sec = await validateUrlSecurity(cleanUrl);
    if (!sec.valid) {
      throw new Error(sec.reason || "Invalid or restricted URL.");
    }

    // 2. Detect Platform (Informational)
    const platform = detectPlatform(cleanUrl);

    let lastError = null;
    let primaryError = null;

    // 3. Sequential Provider Execution (yt-dlp Primary -> Native Fallback)
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        const result = await provider.analyze(cleanUrl, platform);
        if (result && result.formats && result.formats.length > 0) {
          if (process.env.NODE_ENV === "development" || true) {
            console.log(`[URL-DOWNLOADER] Provider [${provider.name}] successfully analyzed URL:`, cleanUrl);
            console.log(`[URL-DOWNLOADER] Formats count:`, result.formats.length);
          }
          return {
            ...result,
            platform: result.platform || platform.displayName,
            platformKey: platform.key,
            url: cleanUrl
          };
        }
      } catch (err) {
        lastError = err;
        if (i === 0) primaryError = err;
        if (process.env.NODE_ENV === "development" || true) {
          console.warn(`[URL-DOWNLOADER] Provider [${provider.name}] analysis attempt failed:`, err.message || String(err));
        }
      }
    }

    const targetErr = primaryError || lastError;
    const classified = classifyDownloaderError(targetErr, platform.displayName);

    if (process.env.NODE_ENV === "development" || true) {
      console.error(`[URL-DOWNLOADER ERROR] Category: ${classified.category} | Message: ${classified.userMessage}`);
    }

    const errObj = new Error(classified.userMessage);
    errObj.category = classified.category;
    errObj.rawError = classified.rawError;
    errObj.platform = platform.displayName;
    throw errObj;
  }

  /**
   * Downloads selected format from URL using providers.
   */
  async downloadFormat(url, selectedFormat, outputPath) {
    const cleanUrl = normalizeMediaUrl(url);
    const platform = detectPlatform(cleanUrl);
    let lastError = null;
    let primaryError = null;

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        const filePath = await provider.download(cleanUrl, selectedFormat, outputPath);
        if (filePath) return filePath;
      } catch (err) {
        lastError = err;
        if (i === 0) primaryError = err;
        console.warn(`[URL-DOWNLOADER] Provider [${provider.name}] download failed:`, err.message);
      }
    }

    const classified = classifyDownloaderError(primaryError || lastError, platform.displayName);
    const errObj = new Error(classified.userMessage);
    errObj.category = classified.category;
    throw errObj;
  }
}

export const defaultProviderManager = new ProviderManager();
