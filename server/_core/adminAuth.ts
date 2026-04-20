import { SignJWT, jwtVerify } from "jose";
import * as cookie from "cookie";
import { ENV } from "./env";
import type { Request } from "express";

const ADMIN_COOKIE_NAME = "admin_session";
const secret = () => new TextEncoder().encode(ENV.cookieSecret || "esticlose-fallback-secret");

export { ADMIN_COOKIE_NAME };

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(req: Request): Promise<boolean> {
  // If no admin password is configured, skip the gate entirely
  if (!ENV.adminPassword) return true;

  const cookies = cookie.parse(req.headers.cookie || "");
  const token = cookies[ADMIN_COOKIE_NAME];
  if (!token) return false;
  return verifyAdminToken(token);
}
