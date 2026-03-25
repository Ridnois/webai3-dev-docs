import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "devdocs-session";

function getSecret() {
  const secret = process.env.SESSION_SECRET ?? "";
  return new TextEncoder().encode(secret);
}

function getAllowedAddresses(): string[] {
  return (process.env.ALLOWED_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const address = ((payload.address as string) ?? "").toLowerCase();
    const allowed = getAllowedAddresses();

    if (allowed.length > 0 && !allowed.includes(address)) {
      const url = req.nextUrl.clone();
      url.pathname = "/auth";
      url.searchParams.set("error", "unauthorized");
      const res = NextResponse.redirect(url);
      res.cookies.delete(COOKIE_NAME);
      return res;
    }

    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("from", pathname);
    const res = NextResponse.redirect(url);
    res.cookies.delete(COOKIE_NAME);
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|\\.svg|\\.png|\\.jpg).*)"],
};
