"use client";
import { useEffect, useRef } from "react";
import { useStore } from "./store";
import { fmtClock } from "./format";
import { toast } from "./toast";

const BASE_TITLE = "Jira Time Tracker";

/** Apply the selected theme to <html data-theme>. */
export function useApplyTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}

/** Show the running timer in the browser tab title. */
export function useTabTitle() {
  const timer = useStore((s) => s.timer);
  useEffect(() => {
    if (!timer) {
      document.title = BASE_TITLE;
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000);
      document.title = `⏱ ${fmtClock(elapsed)} · ${timer.issueKey}`;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      document.title = BASE_TITLE;
    };
  }, [timer]);
}

/** Nudge once when a timer has been running longer than `hours`. */
export function useIdleNudge(hours = 4) {
  const timer = useStore((s) => s.timer);
  const nudged = useRef<string | null>(null);
  useEffect(() => {
    if (!timer) {
      nudged.current = null;
      return;
    }
    const check = () => {
      const elapsed = Date.now() - new Date(timer.startedAt).getTime();
      if (elapsed > hours * 3600_000 && nudged.current !== timer.startedAt) {
        nudged.current = timer.startedAt;
        toast.info(`Timer for ${timer.issueKey} has been running over ${hours}h — still going?`);
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [timer, hours]);
}
