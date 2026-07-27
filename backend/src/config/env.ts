import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  // Cheaper/faster model for lightweight, non-critical calls (interest tags,
  // quick-suggestion buttons) that don't need the primary model's quality.
  anthropicFastModel: process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-4-5",
};
