import { api } from "@/lib/api";
import type { Notification, NotificationUnreadCount } from "@/lib/types";

export async function fetchNotification(id: string): Promise<Notification> {
  return api<Notification>(`/notifications/${id}`);
}

export async function fetchNotificationUnreadCount(): Promise<number> {
  const data = await api<NotificationUnreadCount>("/notifications/unread-count");
  return data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<number> {
  const data = await api<{ updated: number }>("/notifications/read-all", {
    method: "PATCH",
  });
  return data.updated;
}

export async function dismissNotification(id: string): Promise<void> {
  await api(`/notifications/${id}`, { method: "DELETE" });
}
