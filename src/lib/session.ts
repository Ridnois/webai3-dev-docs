import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const COOKIE_NAME = "devdocs-session";
export const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is required");
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  address: string;
  chainId: number;
  iat?: number;
  exp?: number;
}

export async function createToken(payload: { address: string; chainId: number }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as SessionPayload;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export function getAllowedAddresses(): string[] {
  return (process.env.ALLOWED_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(address: string): boolean {
  const allowed = getAllowedAddresses();
  if (allowed.length === 0) return true;
  return allowed.includes(address.toLowerCase());
}
