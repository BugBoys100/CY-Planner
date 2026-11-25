import { NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const expected = process.env.APP_PASSWORD;
  if (!expected || password !== expected) {
    return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(safeNext)}`, req.url), 303);
  }
  const res = NextResponse.redirect(new URL(safeNext, req.url), 303);
  res.cookies.set(AUTH_COOKIE, await authToken(password), {
    httpOnly: true, sameSite: "lax", secure: req.url.startsWith("https") || req.headers.get("x-forwarded-proto") === "https", path: "/", maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
