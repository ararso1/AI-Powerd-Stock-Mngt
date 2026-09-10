"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import {
  getCurrencyRevision,
  setCurrencyConfig,
  subscribeCurrency,
  type Currency,
} from "@/lib/currency";
import type { HealthResponse } from "@/lib/types";

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  useSyncExternalStore(
    subscribeCurrency,
    getCurrencyRevision,
    () => 0
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await api<HealthResponse>("/health", { auth: false });
        if (!cancelled && health.currency) {
          setCurrencyConfig(health.currency);
        }
      } catch {
        /* keep DEFAULT_CURRENCY (ETB / Br) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return children;
}

export type { Currency };
