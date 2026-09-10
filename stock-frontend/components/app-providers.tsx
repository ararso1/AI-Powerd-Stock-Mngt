"use client";

import { NotificationsProvider } from "@/components/notifications/notifications-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <NotificationsProvider>{children}</NotificationsProvider>;
}
