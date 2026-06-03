"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { editWorklog } from "@/lib/client";
import { toast } from "@/lib/toast";
import { fmtDuration, parseDuration, toDateTimeLocal, fromDateTimeLocal } from "@/lib/format";
import type { Entry } from "@/lib/types";
import { X, Loader2 } from "lucide-react";

export function EditEntryDialog({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const updateEntry = useStore((s) => s.updateEntry);
  const hoursPerDay = useStore((s) => s.settings.hoursPerDay);

  const [issueKey, setIssueKey] = useState(entry.issueKey);
  const [dur, setDur] = useState(fmtDuration(entry.seconds).replace(/\s/g, ""));
  const [when, setWhen] = useState(toDateTimeLocal(entry.started));
  const [comment, setComment] = useState(entry.comment);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const seconds = parseDuration(dur, hoursPerDay);
    if (!seconds) return toast.error("Couldn't read that duration. Try 1h30m, 45m, 1.5h or 1d.");
    if (!issueKey.trim()) return toast.error("Issue key is required.");

    const updated: Entry = {
      ...entry,
      issueKey: issueKey.trim().toUpperCase(),
      seconds,
      started: fromDateTimeLocal(when),
      comment,
    };

    // If it was already synced (and the issue key didn't change), push the edit to Jira.
    if (entry.synced && entry.jiraWorklogId && updated.issueKey === entry.issueKey) {
      setSaving(true);
      try {
        await editWorklog(updated);
        toast.success("Updated entry and Jira worklog");
      } catch (e) {
        setSaving(false);
        return toast.error(`Jira update failed: ${(e as Error).message}`);
      }
      setSaving(false);
    } else if (entry.synced && updated.issueKey !== entry.issueKey) {
      // Moving a synced entry to a different issue can't edit-in-place; mark for re-sync.
      updated.synced = false;
      updated.jiraWorklogId = null;
      toast.info("Issue changed — entry marked pending so it re-syncs to the new issue.");
    }

    updateEntry(entry.id, updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="panel mt-[12vh] w-full max-w-md p-6 shadow-2xl shadow-black/50">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit entry</h2>
          <button onClick={onClose} className="text-[var(--color-faint)] hover:text-[var(--color-text)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Issue</span>
              <input className="input font-mono uppercase" value={issueKey} onChange={(e) => setIssueKey(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Duration</span>
              <input className="input" value={dur} onChange={(e) => setDur(e.target.value)} placeholder="1h30m" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">When</span>
            <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Comment</span>
            <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="(optional)" />
          </label>
        </div>

        {entry.synced && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            This entry is already in Jira — saving will update the Jira worklog too.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving && <Loader2 size={15} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
