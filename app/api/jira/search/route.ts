import type { NextRequest } from "next/server";
import { resolveCreds, jiraFetch, notConfigured } from "@/lib/jira-server";
import type { JiraIssue } from "@/lib/types";

// GET /api/jira/search?q=... — search any issue by key or text (not just assigned).
export async function GET(req: NextRequest) {
  const creds = resolveCreds(req);
  if (!creds) return notConfigured();

  const q = (new URL(req.url).searchParams.get("q") || "").trim().replace(/["\\]/g, "");
  if (!q) return Response.json({ issues: [] });

  const isKey = /^[A-Za-z][A-Za-z0-9]+-\d+$/.test(q);
  const jql = isKey
    ? `key = "${q.toUpperCase()}" OR text ~ "${q}*" ORDER BY updated DESC`
    : `text ~ "${q}*" ORDER BY updated DESC`;

  const r = await jiraFetch(creds, "POST", "/rest/api/3/search/jql", {
    jql,
    maxResults: 25,
    fields: ["summary", "status", "priority", "duedate"],
  });
  if (!r.ok) return Response.json({ error: "jira", message: r.message }, { status: r.status });

  const raw = (r.data as { issues?: RawIssue[] }).issues ?? [];
  const issues: JiraIssue[] = raw.map((it) => ({
    key: it.key,
    summary: it.fields?.summary ?? "(no summary)",
    status: it.fields?.status?.name ?? "Unknown",
    statusCategory: it.fields?.status?.statusCategory?.key ?? "new",
    priority: it.fields?.priority?.name,
    duedate: it.fields?.duedate ?? null,
  }));
  return Response.json({ issues });
}

interface RawIssue {
  key: string;
  fields?: {
    summary?: string;
    status?: { name?: string; statusCategory?: { key?: string } };
    priority?: { name?: string };
    duedate?: string | null;
  };
}
