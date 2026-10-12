/**
 * Base abstract extraction provider for UniversalMediaDownloader.
 */
export class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Check whether this provider supports the given URL and platform.
   * Should return boolean or Promise<boolean>.
   */
  async supportsUrl(url, platform) {
    return false;
  }

  /**
   * Extracts media metadata and available format options.
   * Returns standard metadata object:
   * {
   *   platform: string,
   *   title: string,
   *   thumbnail: string,
   *   duration: string,
   *   uploader: string,
   *   formats: Array<Format>,
   *   hasVideo: boolean,
   *   hasAudio: boolean,
   *   provider: string
   * }
   */
  async analyze(url, platform) {
    throw new Error("analyze() must be implemented by provider subclass.");
  }

  /**
   * Downloads and processes requested media format.
   * Returns path to temporary downloaded output file.
   */
  async download(url, selectedFormat, outputDir) {
    throw new Error("download() must be implemented by provider subclass.");
  }
}
