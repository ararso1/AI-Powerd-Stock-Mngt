"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NotificationDetail } from "@/components/notifications/notification-detail";
import { PageLoading } from "@/components/shared/page-loading";
import { FrappeButtonLink } from "@/components/frappe";
import { useNotifications } from "@/components/notifications/notifications-provider";
import {
  fetchNotification,
  markNotificationRead,
} from "@/lib/notifications";
import { useFetch } from "@/hooks/use-fetch";
import { useCallback } from "react";

export default function NotificationDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { refreshUnreadCount } = useNotifications();

  const loadNotification = useCallback(async () => {
    const notification = await fetchNotification(id);
    if (!notification.isRead) {
      await markNotificationRead(id);
      await refreshUnreadCount();
      return { ...notification, isRead: true, readAt: new Date().toISOString() };
    }
    return notification;
  }, [id, refreshUnreadCount]);

  const { data: notification, loading, error, reload } = useFetch(
    () =>
      id
        ? loadNotification()
        : Promise.reject(new Error("Invalid notification id")),
    [id, loadNotification]
  );

  return (
    <AppShell
      title={loading ? "Notification" : (notification?.title ?? "Notification")}
      variant="form"
      breadcrumbs={[
        { label: "Home", href: "/dashboard" },
        { label: "Notifications", href: "/notifications" },
        { label: id ? id.slice(0, 8) : "…" },
      ]}
    >
      {loading ? (
        <PageLoading />
      ) : error || !notification ? (
        <div className="mx-auto max-w-lg rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-6 text-center">
          <p className="font-medium text-[var(--frappe-text)]">
            Notification not found
          </p>
          <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
            {error ?? "This alert may have been dismissed."}
          </p>
          <FrappeButtonLink href="/notifications" className="mt-4">
            Back to notifications
          </FrappeButtonLink>
        </div>
      ) : (
        <NotificationDetail notification={notification} onUpdated={reload} />
      )}
    </AppShell>
  );
}
