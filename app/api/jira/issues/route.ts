import type { NextRequest } from "next/server";
import { resolveCreds, jiraFetch, notConfigured } from "@/lib/jira-server";
import type { JiraIssue } from "@/lib/types";

export async function GET(req: NextRequest) {
  const creds = resolveCreds(req);
  if (!creds) return notConfigured();

  const jql = "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";
  const r = await jiraFetch(creds, "POST", "/rest/api/3/search/jql", {
    jql,
    maxResults: 50,
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
