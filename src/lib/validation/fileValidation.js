/**
 * AnyFormat File Validation Module
 * Enforces 200 MB maximum file size limit, MIME type checks, and magic byte file signature verification.
 */

export const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * Reads the first header bytes of a file as a Uint8Array
 */
async function getFileHeaderBytes(file, numBytes = 16) {
  const blobSlice = file.slice(0, numBytes);
  const arrayBuffer = await blobSlice.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Validates file size, extension, MIME type, and magic bytes signature
 * @param {File} file
 * @param {Object} tool
 * @returns {Promise<{ valid: boolean, error?: string, fileMeta?: Object }>}
 */
export async function validateFile(file, tool) {
  if (!file) {
    return { valid: false, error: "No file selected." };
  }

  // 1. File Size Validation (Strict 200 MB Limit)
  const maxAllowedBytes = (tool?.maxFileSize || 200) * 1024 * 1024;
  if (file.size > maxAllowedBytes) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeInMB} MB) exceeds the maximum limit of ${tool?.maxFileSize || 200} MB.`
    };
  }

  if (file.size === 0) {
    return { valid: false, error: "The selected file is empty (0 bytes)." };
  }

  // Text/Dev utilities don't require magic binary byte validation
  if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".json") || file.name.endsWith(".csv") || file.name.endsWith(".xml")) {
    return { valid: true, fileMeta: { name: file.name, size: file.size, type: file.type } };
  }

  // 2. Magic Byte Signature Validation
  try {
    const bytes = await getFileHeaderBytes(file, 16);
    const signatureMatch = checkMagicBytes(bytes, file.name.toLowerCase());

    if (!signatureMatch.valid) {
      return {
        valid: false,
        error: signatureMatch.error || `File "${file.name}" header signature does not match its extension.`
      };
    }
  } catch {
    return { valid: false, error: "Failed to read file signature. File may be corrupted or unreadable." };
  }

  return { valid: true, fileMeta: { name: file.name, size: file.size, type: file.type } };
}

/**
 * Checks magic byte signatures for common formats
 */
function checkMagicBytes(bytes, filename) {
  // JPG / JPEG: FF D8 FF
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { valid: true };
    }
    return { valid: false, error: "File lacks valid JPG magic bytes (FF D8 FF)." };
  }

  // PNG: 89 50 4E 47
  if (filename.endsWith(".png")) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return { valid: true };
    }
    return { valid: false, error: "File lacks valid PNG magic bytes (89 50 4E 47)." };
  }

  // WebP: RIFF ... WEBP
  if (filename.endsWith(".webp")) {
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return { valid: true };
    }
    return { valid: false, error: "File lacks valid WebP magic bytes (RIFF ... WEBP)." };
  }

  // GIF: 47 49 46 38
  if (filename.endsWith(".gif")) {
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return { valid: true };
    }
    return { valid: false, error: "File lacks valid GIF magic bytes (GIF87a / GIF89a)." };
  }

  // PDF: 25 50 44 46 (%PDF)
  if (filename.endsWith(".pdf")) {
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { valid: true };
    }
    return { valid: false, error: "File lacks valid PDF magic bytes (%PDF)." };
  }

  // DOCX / ZIP: 50 4B 03 04 (PK..)
  if (filename.endsWith(".docx") || filename.endsWith(".zip")) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) && (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)) {
      return { valid: true };
    }
    return { valid: false, error: "File lacks valid DOCX / ZIP magic bytes (PK..)." };
  }

  // MP3: ID3 (49 44 33) or Sync bits (FF FB / FF FA / FF F3)
  if (filename.endsWith(".mp3")) {
    if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
      return { valid: true };
    }
    return { valid: false, error: "File lacks valid MP3 header bytes." };
  }

  // MP4 / MOV: ftyp at bytes[4..7] (66 74 79 70)
  if (filename.endsWith(".mp4") || filename.endsWith(".mov") || filename.endsWith(".m4a")) {
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return { valid: true };
    }
    return { valid: false, error: "File lacks valid MP4 / MOV container signature (ftyp)." };
  }

  // WebM / MKV: 1A 45 DF A3
  if (filename.endsWith(".webm") || filename.endsWith(".mkv")) {
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return { valid: true };
    }
    return { valid: false, error: "File lacks valid WebM / MKV container signature." };
  }

  // WAV: RIFF ... WAVE
  if (filename.endsWith(".wav")) {
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
      return { valid: true };
    }
    return { valid: false, error: "File lacks valid WAV header (RIFF ... WAVE)." };
  }

  // OGG: 4F 67 67 53 (OggS)
  if (filename.endsWith(".ogg")) {
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return { valid: true };
    }
    return { valid: false, error: "File lacks valid OGG header (OggS)." };
  }

  // Default fallback for other formats
  return { valid: true };
}

/**
 * Validates URLs for security and SSRF protection
 */
export function validateMediaUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, error: "Please enter a valid URL." };
  }

  const trimmed = urlStr.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return { valid: false, error: "Only HTTP and HTTPS URLs are allowed." };
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();

    // SSRF Protections
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname)
    ) {
      return { valid: false, error: "Access to local or private internal network addresses is restricted." };
    }

    return { valid: true, url: trimmed, domain: hostname };
  } catch {
    return { valid: false, error: "Invalid URL structure." };
  }
}
