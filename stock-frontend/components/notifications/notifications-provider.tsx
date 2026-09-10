"use client";

import * as React from "react";
import { useNotificationUnreadCount } from "@/hooks/use-notification-unread-count";
import { NOTIFICATIONS_REFRESH_EVENT } from "@/lib/notification-events";

type NotificationsContextValue = {
  unreadCount: number;
  unreadLoading: boolean;
  refreshUnreadCount: () => Promise<void>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
};

const NotificationsContext =
  React.createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { count, loading, reload, setCount } = useNotificationUnreadCount();

  React.useEffect(() => {
    function onRefresh() {
      void reload();
    }
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
  }, [reload]);

  const value = React.useMemo(
    () => ({
      unreadCount: count,
      unreadLoading: loading,
      refreshUnreadCount: reload,
      setUnreadCount: setCount,
    }),
    [count, loading, reload, setCount]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = React.useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
