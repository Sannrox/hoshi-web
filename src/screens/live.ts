import { onlineManager } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";

/** Re-render every `everyMs` so countdowns tick between fetches. */
export const useNow = (everyMs = 1000) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
};

export const clockTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hourCycle: "h23" });

export const useOnline = () =>
  useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
  );

/** Actions need a state hoshi confirmed within this window (three refreshes). */
export const FRESH_MS = 15_000;
