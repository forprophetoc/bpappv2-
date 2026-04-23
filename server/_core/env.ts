// Resolve PUBLIC_URL: require it in production, warn in dev if missing
function resolvePublicUrl(): string {
  const raw = process.env.PUBLIC_URL;
  if (raw) return raw.replace(/\/+$/, ""); // strip trailing slashes
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[ENV] CRITICAL: PUBLIC_URL is not set in production. " +
      "Estimate links and GHL writebacks will use fallback 'https://esticlose.com'. " +
      "Set PUBLIC_URL to the real deployment domain."
    );
  }
  return "https://esticlose.com";
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  ghlApiKey: process.env.GHL_API_KEY ?? "",
  ghlWebhookSecret: process.env.GHL_WEBHOOK_SECRET ?? "",
  // OpenAI (legacy — kept for reference but no longer used for image generation)
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  // Gemini
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // S3-compatible storage
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  awsBucketName: process.env.S3_BUCKET_NAME ?? process.env.AWS_BUCKET_NAME ?? "",
  awsEndpoint: process.env.AWS_ENDPOINT ?? "",   // optional — leave blank for standard AWS S3
  publicUrl: resolvePublicUrl(),
};
