import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const MAX_FILE_SIZE_BYTES = Infinity; // Unlimited File Size
const TEMP_DIR = path.join(os.tmpdir(), "anyformat-media-jobs");

// Ensure temp storage directory exists
if (!fs.existsSync(TEMP_DIR)) {
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  } catch (_) {}
}

const jobsStore = new Map();
const analysisStore = new Map();

export class JobManager {
  static storeAnalysis(url, analysisData) {
    const jobId = crypto.randomUUID();
    const session = {
      jobId,
      url,
      title: analysisData.title,
      platform: analysisData.platform,
      platformKey: analysisData.platformKey,
      thumbnail: analysisData.thumbnail,
      duration: analysisData.duration,
      uploader: analysisData.uploader,
      formats: analysisData.formats || [],
      qualityOptions: analysisData.qualityOptions || [],
      audioFormats: analysisData.audioFormats || [],
      createdAt: Date.now()
    };
    analysisStore.set(jobId, session);
    return session;
  }

  static getAnalysis(jobId) {
    if (!jobId) return null;
    return analysisStore.get(jobId) || null;
  }

  static findAnalysisByUrl(url) {
    if (!url) return null;
    const now = Date.now();
    for (const session of analysisStore.values()) {
      if (session.url === url && now - session.createdAt < 15 * 60 * 1000) {
        return session;
      }
    }
    return null;
  }

  static createJob(url, metadata) {
    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      url,
      metadata,
      status: "PENDING",
      outputPath: null,
      mimeType: "video/mp4",
      ext: "mp4",
      fileSize: 0,
      createdAt: Date.now(),
      error: null
    };
    jobsStore.set(jobId, job);
    return job;
  }

  static getJob(jobId) {
    return jobsStore.get(jobId) || null;
  }

  static updateJob(jobId, updates) {
    const job = jobsStore.get(jobId);
    if (!job) return null;
    Object.assign(job, updates);
    jobsStore.set(jobId, job);
    return job;
  }

  static getJobTempFilePath(jobId, ext = "mp4") {
    return path.join(TEMP_DIR, `job_${jobId}.${ext}`);
  }

  static checkFileSizeLimit(filePath) {
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      if (size > MAX_FILE_SIZE_BYTES) {
        return {
          exceeded: true,
          size,
          limit: MAX_FILE_SIZE_BYTES,
          error: `Output file size (${(size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed limit of 200MB.`
        };
      }
      return { exceeded: false, size };
    }
    return { exceeded: false, size: 0 };
  }

  static cleanupOldJobs() {
    const now = Date.now();
    const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

    for (const [jobId, job] of jobsStore.entries()) {
      if (now - job.createdAt > MAX_AGE_MS) {
        if (job.outputPath && fs.existsSync(job.outputPath)) {
          try {
            fs.unlinkSync(job.outputPath);
          } catch (_) {}
        }
        jobsStore.delete(jobId);
      }
    }

    for (const [jobId, session] of analysisStore.entries()) {
      if (now - session.createdAt > 30 * 60 * 1000) {
        analysisStore.delete(jobId);
      }
    }
  }
}

// Periodically clean up old jobs
setInterval(() => {
  JobManager.cleanupOldJobs();
}, 15 * 60 * 1000);
