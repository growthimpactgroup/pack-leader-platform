// Basic Auth gate for the whole app, one login per role (see lib/auth.ts).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { accounts, matchAccount } from "@/lib/accounts";

export function proxy(request: NextRequest) {
  if (accounts().length === 0) {
    return new Response("Pack Leader logins are not configured.", { status: 500 });
  }

  if (matchAccount(request.headers.get("authorization"))) {
    return NextResponse.next();
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Pack Leader"' },
  });
}

export const config = {
  // favicon.ico stays behind the gate: there is no icon file, so the request
  // falls through to the not-found page, which renders the signed-in layout.
  matcher: "/((?!_next/static|_next/image).*)",
};
