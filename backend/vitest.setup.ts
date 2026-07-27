// Runs before every test file. Provides safe dummy env vars so config/env.ts
// (which throws on missing required vars) never needs a real .env, a real
// Postgres DATABASE_URL, or a real Anthropic API key. Tests mock the Prisma
// client and the Anthropic SDK client directly, so these values are never
// actually used to reach a network or database.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET ??= "test-jwt-secret";
process.env.ANTHROPIC_API_KEY ??= "test-anthropic-api-key";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.PORT ??= "4000";
