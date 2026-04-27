import { SignJWT, jwtVerify } from "jose";
import * as cookie from "cookie";
import { ENV } from "./env";
import type { Request } from "express";

const ADMIN_COOKIE_NAME = "admin_session";
const secret = () => new TextEncoder().encode(ENV.cookieSecret || "esticlose-fallback-secret");

export { ADMIN_COOKIE_NAME };

export interface AdminTokenPayload {
  admin: true;
  companyId: number;
  companySlug: string;
  userId: number;
  email: string;
}

export async function signAdminToken(payload: AdminTokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.admin || !payload.companyId || !payload.companySlug) return null;
    return payload as unknown as AdminTokenPayload;
  } catch {
    return null;
  }
}

export async function getAdminSession(req: Request): Promise<AdminTokenPayload | null> {
  const cookies = cookie.parse(req.headers.cookie || "");
  const token = cookies[ADMIN_COOKIE_NAME];
  if (!token) return null;
  return verifyAdminToken(token);
}

/**
 * Legacy compatibility: returns true if any valid admin session exists.
 * Used by the old adminGateProcedure middleware.
 */
export async function isAdminAuthenticated(req: Request): Promise<boolean> {
  const session = await getAdminSession(req);
  return session !== null;
}
