import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/auth") || pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }
  if (req.cookies.get(AUTH_COOKIE)?.value === (await authToken(password))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|icon.png|sw.js|manifest.json|offline.html|favicon.ico|robots.txt).*)"],
};
