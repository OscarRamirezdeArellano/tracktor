import type { NextRequest } from "next/server";
import { resolveCreds, jiraFetch, adf, notConfigured } from "@/lib/jira-server";

interface WorklogBody {
  issueKey: string;
  worklogId?: string;
  timeSpentSeconds: number;
  started: string; // Jira timestamp format
  comment?: string;
  newRemaining?: string; // optional: set remaining estimate, e.g. "2h"
}

function estimateQuery(newRemaining?: string): string {
  if (!newRemaining) return "";
  return `?adjustEstimate=new&newEstimate=${encodeURIComponent(newRemaining)}`;
}

function buildPayload(body: WorklogBody) {
  const payload: Record<string, unknown> = {
    timeSpentSeconds: body.timeSpentSeconds,
    started: body.started,
  };
  if (body.comment) payload.comment = adf(body.comment);
  return payload;
}

async function parse(req: NextRequest): Promise<WorklogBody | null> {
  try {
    return (await req.json()) as WorklogBody;
  } catch {
    return null;
  }
}

// Create a worklog.
export async function POST(req: NextRequest) {
  const creds = resolveCreds(req);
  if (!creds) return notConfigured();
  const body = await parse(req);
  if (!body?.issueKey || !body.timeSpentSeconds || !body.started) {
    return Response.json({ error: "bad_request", message: "issueKey, timeSpentSeconds and started are required." }, { status: 400 });
  }
  const r = await jiraFetch(
    creds,
    "POST",
    `/rest/api/3/issue/${encodeURIComponent(body.issueKey)}/worklog${estimateQuery(body.newRemaining)}`,
    buildPayload(body),
  );
  if (!r.ok) return Response.json({ error: "jira", message: r.message }, { status: r.status });
  return Response.json({ id: (r.data as { id?: string }).id ?? null });
}

// Edit an existing worklog.
export async function PUT(req: NextRequest) {
  const creds = resolveCreds(req);
  if (!creds) return notConfigured();
  const body = await parse(req);
  if (!body?.issueKey || !body.worklogId) {
    return Response.json({ error: "bad_request", message: "issueKey and worklogId are required." }, { status: 400 });
  }
  const r = await jiraFetch(
    creds,
    "PUT",
    `/rest/api/3/issue/${encodeURIComponent(body.issueKey)}/worklog/${encodeURIComponent(body.worklogId)}`,
    buildPayload(body),
  );
  if (!r.ok) return Response.json({ error: "jira", message: r.message }, { status: r.status });
  return Response.json({ id: (r.data as { id?: string }).id ?? body.worklogId });
}

// Delete a worklog.
export async function DELETE(req: NextRequest) {
  const creds = resolveCreds(req);
  if (!creds) return notConfigured();
  const body = await parse(req);
  if (!body?.issueKey || !body.worklogId) {
    return Response.json({ error: "bad_request", message: "issueKey and worklogId are required." }, { status: 400 });
  }
  const r = await jiraFetch(
    creds,
    "DELETE",
    `/rest/api/3/issue/${encodeURIComponent(body.issueKey)}/worklog/${encodeURIComponent(body.worklogId)}`,
  );
  if (!r.ok) return Response.json({ error: "jira", message: r.message }, { status: r.status });
  return Response.json({ ok: true });
}
