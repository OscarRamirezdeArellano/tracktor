import type { NextRequest } from "next/server";
import { resolveCreds, jiraFetch, notConfigured } from "@/lib/jira-server";

export async function GET(req: NextRequest) {
  const creds = resolveCreds(req);
  if (!creds) return notConfigured();

  const r = await jiraFetch(creds, "GET", "/rest/api/3/myself");
  if (!r.ok) return Response.json({ error: "jira", message: r.message }, { status: r.status });

  const d = r.data as {
    displayName: string;
    emailAddress?: string;
    accountId: string;
    avatarUrls?: Record<string, string>;
  };
  return Response.json({
    displayName: d.displayName,
    emailAddress: d.emailAddress,
    accountId: d.accountId,
    avatarUrl: d.avatarUrls?.["48x48"],
  });
}
