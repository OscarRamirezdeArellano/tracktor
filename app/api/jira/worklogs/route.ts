import type { NextRequest } from "next/server";
import { resolveCreds, jiraFetch, notConfigured } from "@/lib/jira-server";
import type { RemoteWorklog } from "@/lib/types";

// GET /api/jira/worklogs?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns the current user's worklogs (including ones logged via Clockwork or the
// Jira UI) within the date range, so the timesheet reflects reality.
export async function GET(req: NextRequest) {
  const creds = resolveCreds(req);
  if (!creds) return notConfigured();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return Response.json({ error: "bad_request", message: "from and to (YYYY-MM-DD) are required." }, { status: 400 });
  }

  const meRes = await jiraFetch(creds, "GET", "/rest/api/3/myself");
  if (!meRes.ok) return Response.json({ error: "jira", message: meRes.message }, { status: meRes.status });
  const accountId = (meRes.data as { accountId: string }).accountId;

  const jql = `worklogAuthor = currentUser() AND worklogDate >= "${from}" AND worklogDate <= "${to}" ORDER BY updated DESC`;
  const search = await jiraFetch(creds, "POST", "/rest/api/3/search/jql", {
    jql,
    maxResults: 80,
    fields: ["summary"],
  });
  if (!search.ok) return Response.json({ error: "jira", message: search.message }, { status: search.status });

  const issues = ((search.data as { issues?: { key: string; fields?: { summary?: string } }[] }).issues ?? []).map(
    (i) => ({ key: i.key, summary: i.fields?.summary ?? "" }),
  );

  const fromMs = Date.parse(`${from}T00:00:00`);
  const toMs = Date.parse(`${to}T23:59:59.999`);

  const perIssue = await Promise.all(
    issues.map(async (issue) => {
      const wl = await jiraFetch(
        creds,
        "GET",
        `/rest/api/3/issue/${encodeURIComponent(issue.key)}/worklog?startedAfter=${fromMs - 1}&startedBefore=${toMs + 1}`,
      );
      if (!wl.ok) return [];
      const list = (wl.data as { worklogs?: RawWorklog[] }).worklogs ?? [];
      return list
        .filter((w) => w.author?.accountId === accountId)
        .map((w): RemoteWorklog => ({
          id: w.id,
          issueKey: issue.key,
          summary: issue.summary,
          seconds: w.timeSpentSeconds ?? 0,
          started: w.started,
          comment: extractText(w.comment),
        }))
        .filter((w) => {
          const t = Date.parse(w.started);
          return t >= fromMs && t <= toMs;
        });
    }),
  );

  return Response.json({ worklogs: perIssue.flat() });
}

interface RawWorklog {
  id: string;
  timeSpentSeconds?: number;
  started: string;
  author?: { accountId?: string };
  comment?: unknown;
}

// Best-effort extraction of plain text from an ADF comment.
function extractText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  const n = node as { text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (Array.isArray(n.content)) return n.content.map(extractText).join(" ").trim();
  return "";
}
