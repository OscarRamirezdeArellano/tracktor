// Server-side Jira proxy helpers. Runs only in Route Handlers (Node runtime).
// Credentials resolve from: the httpOnly cookie (set via /api/auth) -> request
// headers (legacy) -> environment variables (recommended for a personal deploy).
import type { NextRequest } from "next/server";

export interface Creds {
  baseUrl: string;
  email: string;
  token: string;
}

export const COOKIE_NAME = "jira_creds";

export function credsFromCookieValue(value: string | undefined): Creds | null {
  if (!value) return null;
  try {
    const obj = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    if (obj?.baseUrl && obj?.email && obj?.token) {
      return { baseUrl: String(obj.baseUrl).replace(/\/+$/, ""), email: obj.email, token: obj.token };
    }
  } catch {
    /* ignore malformed cookie */
  }
  return null;
}

export function encodeCookieValue(c: Creds): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64");
}

export function credsFromEnv(): Creds | null {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!baseUrl || !email || !token) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), email, token };
}

export function resolveCreds(req: NextRequest): Creds | null {
  const cookie = credsFromCookieValue(req.cookies.get(COOKIE_NAME)?.value);
  if (cookie) return cookie;

  const baseUrl = req.headers.get("x-jira-base-url");
  const email = req.headers.get("x-jira-email");
  const token = req.headers.get("x-jira-token");
  if (baseUrl && email && token) {
    return { baseUrl: baseUrl.replace(/\/+$/, ""), email, token };
  }
  return credsFromEnv();
}

export interface JiraResult {
  ok: boolean;
  status: number;
  data: unknown;
  message?: string;
}

export async function jiraFetch(
  creds: Creds,
  method: string,
  path: string,
  body?: unknown,
): Promise<JiraResult> {
  const auth = Buffer.from(`${creds.email}:${creds.token}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(creds.baseUrl + path, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, data: null, message: `Could not reach Jira: ${(e as Error).message}` };
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    let message = `Jira returned ${res.status}`;
    const d = data as { errorMessages?: string[]; errors?: Record<string, string> };
    if (d?.errorMessages?.length) message = d.errorMessages.join("; ");
    else if (d?.errors && Object.keys(d.errors).length) message = Object.values(d.errors).join("; ");
    else if (res.status === 401) message = "Authentication failed — check your email and API token.";
    else if (res.status === 404) message = "Not found — check the issue key or your Jira URL.";
    return { ok: false, status: res.status, data, message };
  }
  return { ok: true, status: res.status, data };
}

/** Plain text -> Atlassian Document Format (required for v3 worklog comments). */
export function adf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
  };
}

export function notConfigured() {
  return Response.json(
    {
      error: "not_configured",
      message: "Jira credentials are not set. Add them in Settings, or set JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN.",
    },
    { status: 400 },
  );
}
