/**
 * Cleans tracking query parameters from social media URLs while preserving vital IDs.
 */
export function normalizeMediaUrl(urlString) {
  if (!urlString || typeof urlString !== "string") return urlString;
  let trimmed = urlString.trim();

  try {
    const parsed = new URL(trimmed);

    // Strip common social media tracking parameters
    const paramsToStrip = ["igsh", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "ref", "s", "t"];
    
    // For YouTube, preserve 'v' parameter
    if (parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be")) {
      const v = parsed.searchParams.get("v");
      if (v) {
        return `https://www.youtube.com/watch?v=${v}`;
      }
    }

    // For Vimeo, normalize standard video URLs to player embed format to bypass web client login restriction
    if (parsed.hostname.includes("vimeo.com") && !parsed.hostname.includes("player.vimeo.com")) {
      const vimeoMatch = parsed.pathname.match(/(\d+)/);
      if (vimeoMatch && vimeoMatch[1]) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      }
    }

    // Strip tracking parameters
    for (const param of paramsToStrip) {
      parsed.searchParams.delete(param);
    }

    return parsed.toString();
  } catch (_) {
    return trimmed;
  }
}

// Known private / internal IP ranges for SSRF protection
const BLOCKED_IP_RANGES = [
  /^127\./,                 // Loopback
  /^10\./,                  // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
  /^192\.168\./,            // Private Class C
  /^169\.254\./,            // Link-local / AWS metadata
  /^0\./,                   // Current network
  /^::1$/,                  // IPv6 Loopback
  /^fe80:/i,                // IPv6 Link-local
  /^fc00:/i,                // IPv6 Unique local
  /^fd00:/i                 // IPv6 Unique local
];

/**
 * Validates a URL for SSRF protection.
 */
export async function validateUrlSecurity(urlString) {
  if (!urlString || typeof urlString !== "string") {
    return { valid: false, reason: "URL string is empty or invalid." };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch (err) {
    return { valid: false, reason: "Please enter a valid HTTP or HTTPS URL." };
  }

  // Protocol check
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, reason: "Only HTTP and HTTPS protocols are allowed." };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and explicit private names
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    return { valid: false, reason: "Access to local or internal addresses is restricted." };
  }

  // Check if hostname is an IP literal
  for (const regex of BLOCKED_IP_RANGES) {
    if (regex.test(hostname)) {
      return { valid: false, reason: "Access to private IP addresses is restricted." };
    }
  }

  // If executing in Node server environment, perform DNS lookup for IP resolution
  if (typeof window === "undefined") {
    try {
      const dns = await import("dns/promises");
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        for (const regex of BLOCKED_IP_RANGES) {
          if (regex.test(addr.address)) {
            return { valid: false, reason: "URL resolves to a restricted private network address." };
          }
        }
      }
    } catch (err) {
      return { valid: false, reason: "Could not resolve domain name." };
    }
  }

  return { valid: true, parsedUrl: parsed };
}

/**
 * Detects the media platform based on URL pattern.
 * This is purely INFORMATIONAL and does NOT decide whether a URL can be extracted.
 */
export function detectPlatform(urlString) {
  if (!urlString) return { key: "unknown", displayName: "Unknown", icon: "video" };

  const lower = urlString.toLowerCase();

  if (lower.includes("youtube.com/shorts/") || (lower.includes("youtu.be/") && lower.includes("shorts"))) {
    return { key: "youtube_shorts", displayName: "YouTube Shorts", icon: "youtube" };
  }
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    return { key: "youtube", displayName: "YouTube", icon: "youtube" };
  }
  if (lower.includes("instagram.com/reel/") || lower.includes("instagram.com/reels/") || lower.includes("instagr.am/reel/")) {
    return { key: "instagram_reel", displayName: "Instagram Reel", icon: "instagram" };
  }
  if (lower.includes("instagram.com/stories/") || lower.includes("instagram.com/story/")) {
    return { key: "instagram_story", displayName: "Instagram Story", icon: "instagram" };
  }
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) {
    return { key: "instagram", displayName: "Instagram Post / Video", icon: "instagram" };
  }
  if (lower.includes("facebook.com/reel/") || lower.includes("fb.watch/") || lower.includes("facebook.com/watch")) {
    return { key: "facebook_reel", displayName: "Facebook Reel", icon: "facebook" };
  }
  if (lower.includes("facebook.com") || lower.includes("fb.com")) {
    return { key: "facebook", displayName: "Facebook", icon: "facebook" };
  }
  if (lower.includes("tiktok.com") || lower.includes("vm.tiktok.com")) {
    return { key: "tiktok", displayName: "TikTok", icon: "tiktok" };
  }
  if (lower.includes("twitter.com") || lower.includes("x.com")) {
    return { key: "twitter", displayName: "X / Twitter", icon: "twitter" };
  }
  if (lower.includes("reddit.com") || lower.includes("v.redd.it")) {
    return { key: "reddit", displayName: "Reddit", icon: "reddit" };
  }
  if (lower.includes("vimeo.com")) {
    return { key: "vimeo", displayName: "Vimeo", icon: "vimeo" };
  }
  if (lower.includes("dailymotion.com") || lower.includes("dai.ly")) {
    return { key: "dailymotion", displayName: "Dailymotion", icon: "video" };
  }
  if (lower.includes("pinterest.com") || lower.includes("pin.it")) {
    return { key: "pinterest", displayName: "Pinterest Video", icon: "pinterest" };
  }
  if (lower.includes("twitch.tv")) {
    return { key: "twitch", displayName: "Twitch VOD", icon: "twitch" };
  }
  if (lower.includes("pexels.com")) {
    return { key: "pexels", displayName: "Pexels Video", icon: "video" };
  }

  try {
    const host = new URL(urlString).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    const domainName = parts.length >= 2 ? parts[parts.length - 2] : host;
    const capitalized = domainName.charAt(0).toUpperCase() + domainName.slice(1);
    return { key: "generic", displayName: capitalized, icon: "video" };
  } catch (_) {
    return { key: "generic", displayName: "Web Media Stream", icon: "video" };
  }
}
