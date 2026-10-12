import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { BaseProvider } from "./baseProvider.js";

export class NativeFallbackProvider extends BaseProvider {
  constructor() {
    super("native-fallback");
  }

  async supportsUrl(url, platform) {
    return true;
  }

  async analyze(url, platform) {
    const lower = url.toLowerCase();

    // 1. YouTube via InnerTube ANDROID_VR API
    if (platform.key.includes("youtube")) {
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
      const videoId = ytMatch ? ytMatch[1] : null;

      if (videoId) {
        const ytData = await this.extractYoutubeInnerTube(videoId);
        if (ytData) {
          return {
            platform: platform.displayName,
            title: ytData.title,
            thumbnail: ytData.thumbnail,
            duration: ytData.duration,
            uploader: ytData.uploader,
            formats: ytData.formats,
            hasVideo: true,
            hasAudio: true,
            provider: this.name,
            rawUrls: {
              videoUrl: ytData.videoUrl,
              audioUrl: ytData.audioUrl
            }
          };
        }
      }
    }

    // 2. Instagram Reels / Posts / Stories Meta Scraper
    if (platform.key.includes("instagram")) {
      const instaData = await this.extractInstagramMeta(url);
      if (instaData && instaData.videoUrl) {
        return {
          platform: platform.displayName,
          title: instaData.title,
          thumbnail: instaData.thumbnail,
          duration: instaData.duration || "00:30",
          uploader: instaData.uploader || "Instagram",
          formats: [
            {
              formatId: "insta_hd",
              extension: "mp4",
              container: "mp4",
              qualityLabel: "HD 1080p",
              height: 1080,
              width: 1920,
              hasVideo: true,
              hasAudio: true,
              url: instaData.videoUrl
            }
          ],
          hasVideo: true,
          hasAudio: true,
          provider: this.name,
          rawUrls: { videoUrl: instaData.videoUrl }
        };
      }
    }

    // 3. TikTok Scraper
    if (platform.key.includes("tiktok")) {
      const tiktokData = await this.extractTikTokMeta(url);
      if (tiktokData && tiktokData.videoUrl) {
        return {
          platform: platform.displayName,
          title: tiktokData.title,
          thumbnail: tiktokData.thumbnail,
          duration: tiktokData.duration || "00:45",
          uploader: tiktokData.uploader || "TikTok Creator",
          formats: [
            {
              formatId: "tiktok_hd",
              extension: "mp4",
              container: "mp4",
              qualityLabel: "HD 1080p",
              height: 1080,
              width: 1920,
              hasVideo: true,
              hasAudio: true,
              url: tiktokData.videoUrl
            }
          ],
          hasVideo: true,
          hasAudio: true,
          provider: this.name,
          rawUrls: { videoUrl: tiktokData.videoUrl }
        };
      }
    }

    // 4. Reddit Video Scraper
    if (platform.key.includes("reddit")) {
      const redditData = await this.extractRedditMeta(url);
      if (redditData) {
        return {
          platform: platform.displayName,
          title: redditData.title,
          thumbnail: redditData.thumbnail,
          duration: redditData.duration || "00:30",
          uploader: redditData.uploader || "Reddit User",
          formats: redditData.formats,
          hasVideo: true,
          hasAudio: true,
          provider: this.name,
          rawUrls: {
            videoUrl: redditData.videoUrl,
            audioUrl: redditData.audioUrl
          }
        };
      }
    }

    // 5. Generic HTML5 <video> tag / direct video link extractor
    const genericData = await this.extractGenericPage(url);
    if (genericData && genericData.videoUrl) {
      return {
        platform: platform.displayName,
        title: genericData.title || "Web Video Media",
        thumbnail: genericData.thumbnail || null,
        duration: "00:00",
        uploader: "Web Publisher",
        formats: [
          {
            formatId: "generic_hd",
            extension: genericData.ext || "mp4",
            container: genericData.ext || "mp4",
            qualityLabel: "HD Standard",
            height: 720,
            width: 1280,
            hasVideo: true,
            hasAudio: true,
            url: genericData.videoUrl
          }
        ],
        hasVideo: true,
        hasAudio: true,
        provider: this.name,
        rawUrls: { videoUrl: genericData.videoUrl }
      };
    }

    throw new Error(`This URL is currently unsupported or requires private access permissions.`);
  }

  async download(url, selectedFormat, outputPath) {
    const directUrl = selectedFormat.url || (selectedFormat.rawUrls && selectedFormat.rawUrls.videoUrl);
    if (!directUrl) {
      throw new Error("No direct stream URL available for native download.");
    }

    await this.fetchStreamToFile(directUrl, outputPath);
    return outputPath;
  }

  // --- PRIVATE HELPER METHODS ---

  async extractYoutubeInnerTube(videoId) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "com.google.android.apps.youtube.vr/1.56.21 (Linux; U; Android 10)"
        },
        body: JSON.stringify({
          videoId: videoId,
          context: {
            client: {
              clientName: "ANDROID_VR",
              clientVersion: "1.56.21",
              hl: "en",
              gl: "US"
            }
          }
        })
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (data.playabilityStatus?.status !== "OK") return null;

      const details = data.videoDetails || {};
      const formatsRaw = [
        ...(data.streamingData?.formats || []),
        ...(data.streamingData?.adaptiveFormats || [])
      ];

      const durationSec = parseInt(details.lengthSeconds || "0", 10);
      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      const formattedDuration = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      const formats = [];
      const seenQualities = new Set();

      for (const fmt of formatsRaw) {
        if (!fmt.url) continue;
        const height = fmt.height || (fmt.qualityLabel ? parseInt(fmt.qualityLabel, 10) : 0);
        const hasVideo = fmt.mimeType?.includes("video");
        const hasAudio = fmt.mimeType?.includes("audio") || Boolean(fmt.audioQuality);
        const label = height ? `${height}p` : (hasAudio ? "Audio Only" : "Video");

        const qKey = `${label}-${hasVideo ? 'v' : ''}${hasAudio ? 'a' : ''}`;
        if (seenQualities.has(qKey)) continue;
        seenQualities.add(qKey);

        formats.push({
          formatId: fmt.itag ? String(fmt.itag) : `yt_${formats.length}`,
          extension: fmt.mimeType?.includes("webm") ? "webm" : fmt.mimeType?.includes("audio") ? "m4a" : "mp4",
          container: fmt.mimeType?.includes("webm") ? "webm" : "mp4",
          qualityLabel: label,
          height: height || 0,
          width: fmt.width || 0,
          fps: fmt.fps || null,
          hasVideo,
          hasAudio,
          bitrate: fmt.bitrate || null,
          filesize: fmt.contentLength ? parseInt(fmt.contentLength, 10) : null,
          url: fmt.url
        });
      }

      formats.sort((a, b) => b.height - a.height);

      const bestProg = formats.find(f => f.hasVideo && f.hasAudio) || formats[0];
      const bestAudio = formats.find(f => !f.hasVideo && f.hasAudio) || bestProg;

      return {
        title: details.title || "YouTube Video",
        uploader: details.author || "YouTube Creator",
        duration: formattedDuration,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        formats,
        videoUrl: bestProg?.url || null,
        audioUrl: bestAudio?.url || null
      };
    } catch (err) {
      console.warn("Native InnerTube extraction failed:", err);
      return null;
    }
  }

  async extractInstagramMeta(url) {
    const match = url.match(/(?:p|reel|reels|tv|share\/reel|stories|story|s)\/([A-Za-z0-9_-]+)/i);
    const shortcode = match ? match[1] : null;

    const isStory = url.includes("/stories/") || url.includes("/story/");

    const userAgents = [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "WhatsApp/2.19.221 A",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    ];

    for (const ua of userAgents) {
      try {
        const pageUrl = shortcode && !isStory ? `https://www.instagram.com/reel/${shortcode}/` : url;
        const res = await fetch(pageUrl, {
          headers: {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          signal: AbortSignal.timeout(3000)
        });

        if (res.ok) {
          const html = await res.text();

          // Fast abort if redirected to Instagram login
          if (html.includes("accounts/login") || html.includes("login_required") || res.url.includes("accounts/login")) {
            return null;
          }

          const videoMatch = html.match(/<meta\s+(?:property|name)=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i) ||
                             html.match(/"video_url"\s*:\s*["']([^"']+)["']/i);
          const thumbMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i);
          const titleMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i);

          const videoUrl = videoMatch ? this.decodeEntities(videoMatch[1]) : null;
          let thumbnail = thumbMatch ? this.decodeEntities(thumbMatch[1]) : null;
          if (thumbnail && thumbnail.startsWith("data:image")) thumbnail = null;

          if (videoUrl) {
            return {
              title: titleMatch ? this.decodeEntities(titleMatch[1]) : (isStory ? "Instagram Story" : "Instagram Media"),
              uploader: "Instagram Creator",
              thumbnail,
              videoUrl
            };
          }
        }
      } catch (_) {}
    }
    return null;
  }

  async extractTikTokMeta(url) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const html = await res.text();
        const videoMatch = html.match(/<meta\s+(?:property|name)=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/"playAddr"\s*:\s*["']([^"']+)["']/i);
        const thumbMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i);
        const titleMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i);

        if (videoMatch) {
          return {
            title: titleMatch ? this.decodeEntities(titleMatch[1]) : "TikTok Media Clip",
            uploader: "TikTok Creator",
            thumbnail: thumbMatch ? this.decodeEntities(thumbMatch[1]) : null,
            videoUrl: this.decodeEntities(videoMatch[1]).replace(/\\u0026/g, "&")
          };
        }
      }
    } catch (_) {}
    return null;
  }

  async extractRedditMeta(url) {
    try {
      const cleanUrl = url.split("?")[0].replace(/\/$/, "") + ".json";
      const res = await fetch(cleanUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        signal: AbortSignal.timeout(5000)
      });

      if (res.ok) {
        const json = await res.json();
        const postData = json?.[0]?.data?.children?.[0]?.data;
        if (postData && postData.is_video && postData.media?.reddit_video) {
          const rVideo = postData.media.reddit_video;
          const fallbackUrl = rVideo.fallback_url;
          const audioUrl = fallbackUrl ? fallbackUrl.replace(/DASH_\d+\.mp4/, "DASH_AUDIO_128.mp4") : null;

          return {
            title: postData.title || "Reddit Media",
            uploader: postData.author || "Reddit User",
            thumbnail: postData.thumbnail && postData.thumbnail.startsWith("http") ? postData.thumbnail : null,
            duration: rVideo.duration ? `${Math.floor(rVideo.duration / 60).toString().padStart(2, '0')}:${(rVideo.duration % 60).toString().padStart(2, '0')}` : "00:30",
            videoUrl: fallbackUrl,
            audioUrl: audioUrl,
            formats: [
              {
                formatId: "reddit_hd",
                extension: "mp4",
                container: "mp4",
                qualityLabel: rVideo.height ? `${rVideo.height}p` : "HD 720p",
                height: rVideo.height || 720,
                width: rVideo.width || 1280,
                hasVideo: true,
                hasAudio: true,
                url: fallbackUrl
              }
            ]
          };
        }
      }
    } catch (_) {}
    return null;
  }

  async extractGenericPage(url) {
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

    // 1. Try HEAD request to resolve redirects & Content-Type
    try {
      const headRes = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(6000)
      });

      const finalUrl = headRes.url;
      const contentType = (headRes.headers.get("content-type") || "").toLowerCase();
      const contentLength = parseInt(headRes.headers.get("content-length") || "0", 10);

      const isDirectMedia = contentType.includes("video") ||
                            contentType.includes("audio") ||
                            contentType.includes("octet-stream") ||
                            /\.(mp4|webm|mov|mkv|avi|mp3|m4a|wav)(\?|$)/i.test(finalUrl);

      if (isDirectMedia) {
        const extMatch = finalUrl.match(/\.(mp4|webm|mov|mkv|avi|mp3|m4a|wav)/i);
        const ext = extMatch ? extMatch[1].toLowerCase() : (contentType.includes("audio") ? "mp3" : "mp4");
        
        let hostTitle = "Web Media Stream";
        try {
          const host = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
          hostTitle = `${host.charAt(0).toUpperCase() + host.slice(1)} Media Stream`;
        } catch (_) {}

        return {
          title: hostTitle,
          thumbnail: null,
          videoUrl: finalUrl,
          ext,
          filesize: contentLength || null
        };
      }
    } catch (_) {}

    // 2. Fallback GET request to inspect HTML meta tags
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent },
        redirect: "follow",
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const finalUrl = res.url;
        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        const contentLength = parseInt(res.headers.get("content-length") || "0", 10);

        if (contentType.includes("video") || contentType.includes("audio") || contentType.includes("octet-stream") || /\.(mp4|webm|mov|mkv|avi|mp3|m4a|wav)(\?|$)/i.test(finalUrl)) {
          const extMatch = finalUrl.match(/\.(mp4|webm|mov|mkv|avi|mp3|m4a|wav)/i);
          const ext = extMatch ? extMatch[1].toLowerCase() : (contentType.includes("audio") ? "mp3" : "mp4");
          return {
            title: "Direct Media Download Stream",
            thumbnail: null,
            videoUrl: finalUrl,
            ext,
            filesize: contentLength || null
          };
        }

        const html = await res.text();

        const videoMatch = html.match(/<meta\s+(?:property|name)=["']og:video(?::secure_url|:url)?["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:video(?::secure_url|:url)?["']/i) ||
                           html.match(/<meta\s+(?:property|name)=["']twitter:player:stream["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/"contentUrl"\s*:\s*["']([^"']+\.mp4[^"']*)["']/i) ||
                           html.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                           html.match(/<source[^>]+src=["']([^"']+)["']/i);

        const thumbMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
        const titleMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<title>([^<]+)<\/title>/i);

        if (videoMatch) {
          const rawVideoUrl = this.decodeEntities(videoMatch[1]);
          return {
            title: titleMatch ? this.decodeEntities(titleMatch[1]) : "Web Video Stream",
            thumbnail: thumbMatch ? this.decodeEntities(thumbMatch[1]) : null,
            videoUrl: rawVideoUrl,
            ext: "mp4"
          };
        }
      }
    } catch (_) {}
    return null;
  }

  decodeEntities(str) {
    if (!str) return "";
    return str
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .trim();
  }

  fetchStreamToFile(fileUrl, outputPath) {
    return new Promise((resolve, reject) => {
      const client = fileUrl.startsWith("https") ? https : http;
      const request = client.get(fileUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return this.fetchStreamToFile(response.headers.location, outputPath).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download stream: HTTP ${response.statusCode}`));
        }

        const fileStream = fs.createWriteStream(outputPath);
        response.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close();
          resolve(outputPath);
        });

        fileStream.on("error", (err) => {
          fs.unlink(outputPath, () => {});
          reject(err);
        });
      });

      request.on("error", (err) => reject(err));
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error("Stream request timed out."));
      });
    });
  }
}
