import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION,
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.B2_BUCKET_NAME;

export async function generateUploadUrl(key, contentType, expires_in = 3600) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: expires_in });
}

export async function generateDownloadUrl(key, expires_in = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: expires_in });
  } catch (err) {
    console.warn("generateDownloadUrl fallback:", err.message);
    return `https://s3.eu-central-003.backblazeb2.com/${BUCKET}/${key}`;
  }
}

export async function deleteFile(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  await s3Client.send(command);
}
