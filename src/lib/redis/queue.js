import { Queue } from "bullmq";
import Redis from "ioredis";

// Use Upstash Redis
export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const conversionQueue = new Queue("conversion", {
  connection: redis,
});

export async function addJob(jobData) {
  return await conversionQueue.add("process", jobData, {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 2,
  });
}
