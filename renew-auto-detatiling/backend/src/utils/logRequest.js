/**
 * Shared request logger with automatic redaction of sensitive fields.
 *
 * Centralised here so every controller uses the same function,
 * and passwords / tokens never leak into logs.
 */

const SENSITIVE_KEYS = [
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "otp",
  "token",
  "resetToken",
  "smtpPassword"
];

const redact = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const clean = { ...obj };
  for (const key of Object.keys(clean)) {
    if (SENSITIVE_KEYS.includes(key)) {
      clean[key] = "[REDACTED]";
    }
  }
  return clean;
};

const LOG_REQUEST = (req, context) => {
  console.log(`[${context}] Body:`, JSON.stringify(redact(req.body), null, 2));
  console.log(`[${context}] Params:`, JSON.stringify(req.params, null, 2));
  console.log(`[${context}] Query:`, JSON.stringify(req.query, null, 2));
};

module.exports = LOG_REQUEST;
