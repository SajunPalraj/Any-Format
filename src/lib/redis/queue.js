import { Queue } from "bullmq";
import Redis from "ioredis";

let redisClient = null;
let queueInstance = null;

export function getRedis() {
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    redisClient.on("error", (err) => {
      console.warn("Redis client warning:", err.message);
    });
  }
  return redisClient;
}

export function getConversionQueue() {
  const conn = getRedis();
  if (!conn) {
    return null;
  }
  if (!queueInstance) {
    queueInstance = new Queue("conversion", {
      connection: conn,
    });
  }
  return queueInstance;
}

export async function addJob(jobData) {
  const queue = getConversionQueue();
  if (!queue) {
    console.warn("REDIS_URL not configured. Background queue dispatch skipped.");
    return null;
  }
  return await queue.add("process", jobData, {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 2,
  });
}

