import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "mavex-admin-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function sign(timestamp: string) {
  const password = process.env.MAVEX_ADMIN_PASSWORD;
  if (!password) return "";
  return createHmac("sha256", password).update(timestamp).digest("hex");
}

export function checkAdminPassword(candidate: string) {
  const expected = process.env.MAVEX_ADMIN_PASSWORD;
  if (!expected) return false;

  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);
  return expectedBuffer.length === candidateBuffer.length &&
    timingSafeEqual(expectedBuffer, candidateBuffer);
}

export function createAdminSession() {
  const timestamp = Date.now().toString();
  return `${timestamp}.${sign(timestamp)}`;
}

export function isAdminSessionValid(token?: string) {
  if (!token || !process.env.MAVEX_ADMIN_PASSWORD) return false;
  const [timestamp, signature] = token.split(".");
  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt) || !signature) return false;

  const age = Date.now() - issuedAt;
  if (age < 0 || age > SESSION_MAX_AGE_SECONDS * 1000) return false;

  const expected = Buffer.from(sign(timestamp));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
