export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  publicUrl: process.env.VITE_PUBLIC_URL ?? "",
  ghlApiKey: process.env.GHL_API_KEY ?? "",
  reviewWebhookToken: process.env.REVIEW_WEBHOOK_TOKEN ?? "",
  ghlLocationId: process.env.GHL_LOCATION_ID ?? "",
  ghlWebhookUrl: process.env.GHL_WEBHOOK_URL ?? "",
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
  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeUsagePriceId: process.env.STRIPE_USAGE_PRICE_ID ?? "",
};
