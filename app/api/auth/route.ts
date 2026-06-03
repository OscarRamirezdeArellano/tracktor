import { type NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  credsFromCookieValue,
  credsFromEnv,
  encodeCookieValue,
  jiraFetch,
  type Creds,
} from "@/lib/jira-server";

// Report whether we're configured, and via what source (never returns the token).
export async function GET(req: NextRequest) {
  const cookie = credsFromCookieValue(req.cookies.get(COOKIE_NAME)?.value);
  if (cookie) {
    return Response.json({ configured: true, baseUrl: cookie.baseUrl, email: cookie.email, source: "cookie" });
  }
  const env = credsFromEnv();
  if (env) {
    return Response.json({ configured: true, baseUrl: env.baseUrl, email: env.email, source: "env" });
  }
  return Response.json({ configured: false });
}

// Verify the credentials against Jira, then persist them in an httpOnly cookie.
export async function POST(req: NextRequest) {
  let body: { baseUrl?: string; email?: string; apiToken?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 });
  }
  const baseUrl = (body.baseUrl || "").trim().replace(/\/+$/, "");
  const email = (body.email || "").trim();
  const token = (body.apiToken || "").trim();
  if (!baseUrl || !email || !token) {
    return Response.json({ error: "bad_request", message: "Site URL, email and API token are required." }, { status: 400 });
  }

  const creds: Creds = { baseUrl, email, token };
  const check = await jiraFetch(creds, "GET", "/rest/api/3/myself");
  if (!check.ok) {
    return Response.json({ error: "jira", message: check.message }, { status: check.status });
  }
  const me = check.data as { displayName: string; avatarUrls?: Record<string, string> };

  const res = NextResponse.json({ ok: true, displayName: me.displayName, avatarUrl: me.avatarUrls?.["48x48"] });
  res.cookies.set(COOKIE_NAME, encodeCookieValue(creds), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

// Disconnect: clear the cookie.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
