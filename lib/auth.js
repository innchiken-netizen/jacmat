import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "jacmat_admin_session";
const SESSION_DURATION_SECONDS = 10 * 60 * 60; // 10 hours

/**
 * Get the session secret key as a Uint8Array for jose
 */
function getSecretKey() {
  const secret = process.env.SESSION_SECRET || "jacmat_super_secret_dev_key_change_in_production_min_32_chars";
  return new TextEncoder().encode(secret);
}

/**
 * Parse standard HTTP cookie header
 */
function parseCookies(header = "") {
  const map = {};
  if (!header) return map;
  const parts = String(header).split(";");
  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx !== -1) {
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      if (key) map[key] = decodeURIComponent(val);
    }
  }
  return map;
}

/**
 * Sign a new JWT session for the authenticated admin
 * @param {string} email
 * @returns {Promise<string>}
 */
export async function signAdminSession(email) {
  const key = getSecretKey();
  return await new SignJWT({ email, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(key);
}

/**
 * Verify incoming admin session from HTTP request headers
 * @param {object} req - Standard Node/Vercel HTTP request
 * @returns {Promise<{ authenticated: boolean, email?: string, error?: string }>}
 */
export async function verifyAdminSession(req) {
  try {
    const rawCookie = req.headers?.cookie || (req.headers?.get && req.headers.get("cookie")) || "";
    const cookies = parseCookies(rawCookie);
    const token = cookies[COOKIE_NAME];

    if (!token) {
      return { authenticated: false, error: "Missing session token" };
    }

    const key = getSecretKey();
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"]
    });

    if (!payload || payload.role !== "admin") {
      return { authenticated: false, error: "Invalid session role" };
    }

    return { authenticated: true, email: payload.email };
  } catch (err) {
    return { authenticated: false, error: err.message || "Token verification failed" };
  }
}

/**
 * Build the Set-Cookie header string for login
 * @param {string} token
 * @param {boolean} isProduction
 * @returns {string}
 */
export function createSessionCookie(token, isProduction = false) {
  const flags = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${SESSION_DURATION_SECONDS}`
  ];
  if (isProduction) flags.push("Secure");
  return flags.join("; ");
}

/**
 * Build the Set-Cookie header string for logout
 * @param {boolean} isProduction
 * @returns {string}
 */
export function createLogoutCookie(isProduction = false) {
  const flags = [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  ];
  if (isProduction) flags.push("Secure");
  return flags.join("; ");
}
