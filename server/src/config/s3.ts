import "dotenv/config";
import { S3Client } from "@aws-sdk/client-s3";

export const s3BucketName = process.env.S3_BUCKET_NAME || "payroll";
const s3Region = process.env.S3_REGION || "us-east-1";
const s3Endpoint = process.env.S3_ENDPOINT;
const hasCustomEndpoint = Boolean(s3Endpoint);
const s3AccessKey = String(process.env.S3_ACCESS_KEY || "").trim();
const s3SecretKey = String(process.env.S3_SECRET_KEY || "").trim();

export const s3Client = new S3Client({
  region: s3Region,
  ...(hasCustomEndpoint ? { endpoint: s3Endpoint } : {}),
  credentials: {
    accessKeyId: s3AccessKey,
    secretAccessKey: s3SecretKey,
  },
  forcePathStyle: hasCustomEndpoint,
});
