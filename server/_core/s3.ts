import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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

  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
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

  return {
    key,
    url: buildPublicS3Url(bucket, region, key),
  };
}
