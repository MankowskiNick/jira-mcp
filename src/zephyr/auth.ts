import crypto from "crypto";
import jwt from "jsonwebtoken";

// Helper function to generate a JWT token for Zephyr API
export function generateZephyrJwt(
  method: string,
  apiPath: string,
  queryParams: Record<string, string> = {},
  expirationSec: number = 3600
): string {
  // Zephyr base URL from environment variable
  const zephyrBase = (
    process.env.ZAPI_BASE_URL || "https://prod-api.zephyr4jiracloud.com/connect"
  ).replace(/\/$/, "");

  // Sort query parameters alphabetically
  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map((key) => `${key}=${queryParams[key as keyof typeof queryParams]}`)
    .join("&");

  // Build the canonical string: METHOD&<path>&<query>
  const canonical = `${method.toUpperCase()}&${apiPath}&${canonicalQuery}`;

  // Create SHA-256 hex hash of canonical string
  const qsh = crypto
    .createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");

  // Timestamps
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expirationSec;

  // JWT claims
  const payload = {
    iss: process.env.ZAPI_ACCESS_KEY, // Zephyr Access Key
    qsh, // query-string hash
    iat: now,
    exp,
  };

  // Sign with HMAC-SHA256 using Zephyr Secret Key
  return jwt.sign(payload, process.env.ZAPI_SECRET_KEY || "", {
    algorithm: "HS256",
  });
}
