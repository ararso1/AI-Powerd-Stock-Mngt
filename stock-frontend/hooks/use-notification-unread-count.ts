"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchNotificationUnreadCount } from "@/lib/notifications";

const POLL_MS = 60_000;

export function useNotificationUnreadCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const next = await fetchNotificationUnreadCount();
      setCount(next);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const next = await fetchNotificationUnreadCount();
        if (!cancelled) setCount(next);
      } catch {
        if (!cancelled) setCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return { count, loading, reload, setCount };
}
