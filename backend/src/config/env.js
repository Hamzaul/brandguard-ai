// Reads configuration from environment variables (optionally from a local .env file).
// Node 20.12+ can load a .env file natively, so no extra package is needed.
import { randomBytes } from "node:crypto";

try {
  process.loadEnvFile();
} catch {
  // No .env file present - fall back to real environment variables / defaults.
}

function readNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const config = {
  port: readNumber("PORT", 5000),
  maxTextLength: readNumber("MAX_TEXT_LENGTH", 5000),
  // Auth. In production JWT_SECRET must be set; locally a random per-run secret is used.
  jwtSecret:
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production" || process.env.VERCEL ? "" : randomBytes(32).toString("hex")),
  adminEmails: (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
