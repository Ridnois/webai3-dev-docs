import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { cookies } from "next/headers";
import { createToken, isAllowed, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/session";

export async function POST(req: NextRequest) {
  let body: { message: string; signature: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, signature } = body;

  try {
    const siwe = new SiweMessage(message);
    const { data: fields } = await siwe.verify({ signature });

    if (!isAllowed(fields.address)) {
      return NextResponse.json(
        { error: "Address not authorized" },
        { status: 403 }
      );
    }

    const token = await createToken({
      address: fields.address,
      chainId: fields.chainId ?? 1,
    });

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return NextResponse.json({ ok: true, address: fields.address });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
