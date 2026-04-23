import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const requiredEnv = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "S3_BUCKET_NAME",
] as const;

function getMissingEnv(): string[] {
  return requiredEnv.filter((key) => !process.env[key]);
}

export function isS3Configured(): boolean {
  return getMissingEnv().length === 0;
}

function getS3Client(): S3Client {
  const missing = getMissingEnv();

  if (missing.length > 0) {
    throw new Error(`Missing S3 env vars: ${missing.join(", ")}`);
  }

  const config: ConstructorParameters<typeof S3Client>[0] = {
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  };

  // Custom endpoint for S3-compatible services (R2, Spaces, MinIO, etc.)
  const endpoint = process.env.AWS_ENDPOINT?.trim();
  if (endpoint) {
    config.endpoint = endpoint;
    config.forcePathStyle = true;
  }

  return new S3Client(config);
}

function buildPublicS3Url(bucket: string, region: string, key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function uploadGeneratedImageToS3(params: {
  buffer: Buffer;
  contentType?: string;
  key?: string;
}): Promise<{ key: string; url: string }> {
  const bucket = process.env.S3_BUCKET_NAME!;
  const region = process.env.AWS_REGION!;
  const contentType = params.contentType ?? "image/png";
  const key =
    params.key ?? `generated/${Date.now()}-${crypto.randomUUID()}.png`;

  const s3 = getS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const url = buildPublicS3Url(bucket, region, key);
  return { key, url };
}

export async function getPresignedUploadUrl(params: {
  contentType: string;
  prefix?: string;
}): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const bucket = process.env.S3_BUCKET_NAME!;
  const region = process.env.AWS_REGION!;
  const ext = params.contentType.includes("png") ? "png" : params.contentType.includes("webp") ? "webp" : "jpg";
  const prefix = params.prefix ?? "before";
  const key = `${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const s3 = getS3Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const publicUrl = buildPublicS3Url(bucket, region, key);

  return { uploadUrl, key, publicUrl };
}

export function isOwnedS3Url(url: string): boolean {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) return false;
  return url.startsWith(`https://${bucket}.s3.${region}.amazonaws.com/`);
}

export function extractKeyFromS3Url(url: string): string | null {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) return null;
  const prefix = `https://${bucket}.s3.${region}.amazonaws.com/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length).split("?")[0];
}

export async function getObjectFromS3(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  const bucket = process.env.S3_BUCKET_NAME!;
  const s3 = getS3Client();

  const response = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );

  const stream = response.Body;
  if (!stream) throw new Error("Empty response body from S3");

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return {
    buffer: Buffer.concat(chunks),
    contentType: response.ContentType || "image/jpeg",
  };
}
