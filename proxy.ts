// Sign-in gate for the whole app: every page needs a valid session cookie,
// otherwise the visitor is sent to /login (see lib/session.ts).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { accounts } from "@/lib/accounts";
import { SESSION_COOKIE, readSession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  if (accounts().length === 0) {
    return new Response("Pack Leader logins are not configured.", { status: 500 });
  }
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  // Scheduled jobs check their own secret (CRON_SECRET) instead of a session.
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  if (await readSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" && !search ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/((?!_next/static|_next/image).*)",
};
