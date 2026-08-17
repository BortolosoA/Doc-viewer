import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const endpoint = process.env.MINIO_ENDPOINT || "minio";
const port = Number(process.env.MINIO_PORT || 9000);
const accessKey = process.env.MINIO_ROOT_USER || "minioadmin";
const secretKey = process.env.MINIO_ROOT_PASSWORD || "minioadmin";
const bucket = process.env.MINIO_BUCKET || "docs";

export const s3 = new S3Client({
  endpoint: `http://${endpoint}:${port}`,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  },
});

export const BUCKET = bucket;

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function putObject(key, body, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObjectBuffer(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
