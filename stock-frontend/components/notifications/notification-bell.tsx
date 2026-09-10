"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BellIcon,
  CheckCheckIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import { useNotifications } from "@/components/notifications/notifications-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiList } from "@/lib/list-response";
import {
  dismissNotification,
  markAllNotificationsRead,
} from "@/lib/notifications";
import { notificationDetailPath } from "@/lib/notification-routes";
import { errorMessage, formatRelativeDate } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function NotificationTypeBadge({ type }: { type: Notification["type"] }) {
  return (
    <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
      {type.replace(/_/g, " ")}
    </Badge>
  );
}

function NotificationRow({
  notification,
  compact,
  onAction,
  onNavigate,
}: {
  notification: Notification;
  compact?: boolean;
  onAction: () => void;
  onNavigate: () => void;
}) {
  const router = useRouter();

  function openNotification() {
    onNavigate();
    router.push(notificationDetailPath(notification.id));
  }

  async function dismiss(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await dismissNotification(notification.id);
      toast.success("Notification dismissed");
      onAction();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openNotification()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openNotification();
        }
      }}
      className={cn(
        "group relative flex w-full cursor-pointer gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-[var(--frappe-border)] hover:bg-[var(--frappe-section-head)]/80",
        !notification.isRead &&
          "border-[var(--frappe-primary)]/15 bg-[var(--frappe-primary)]/5",
        compact && "px-2 py-2"
      )}
    >
      {!notification.isRead ? (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--frappe-primary)]"
          aria-hidden
        />
      ) : (
        <span className="mt-1.5 size-2 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-[var(--frappe-text)]">
            {notification.title}
          </p>
          <NotificationTypeBadge type={notification.type} />
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--frappe-text-muted)]">
          {notification.message}
        </p>
        <p className="mt-1 text-[11px] text-[var(--frappe-text-muted)]">
          {formatRelativeDate(notification.createdAt)}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 opacity-0 group-hover:opacity-100"
        onClick={dismiss}
        aria-label="Dismiss notification"
      >
        <XIcon className="size-3.5" />
      </Button>
    </div>
  );
}

export function NotificationBell() {
  const { unreadCount, refreshUnreadCount, setUnreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  async function loadRecent() {
    setLoading(true);
    try {
      const rows = await apiList<Notification>(
        "/notifications?limit=10&page=1"
      );
      setItems(rows);
    } catch (err) {
      toast.error(errorMessage(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      void loadRecent();
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      const updated = await markAllNotificationsRead();
      setUnreadCount(0);
      setItems((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt ?? new Date().toISOString() }))
      );
      toast.success(
        updated > 0 ? `${updated} notification(s) marked read` : "All caught up"
      );
      await refreshUnreadCount();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleItemAction() {
    await loadRecent();
    await refreshUnreadCount();
  }

  const badgeLabel =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-9 shrink-0 text-[var(--frappe-text-muted)] hover:text-[var(--frappe-text)]"
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread notifications`
              : "Notifications"
          }
        >
          <BellIcon className="size-4" />
          {badgeLabel ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--frappe-primary)] px-1 text-[10px] font-semibold text-white">
              {badgeLabel}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(100vw-2rem,380px)] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--frappe-text)]">
              Notifications
            </p>
            {unreadCount > 0 ? (
              <p className="text-xs text-[var(--frappe-text-muted)]">
                {unreadCount} unread
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={markingAll || unreadCount === 0}
            onClick={() => void handleMarkAllRead()}
          >
            {markingAll ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <CheckCheckIcon className="size-3.5" />
            )}
            Mark all read
          </Button>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain p-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-[var(--frappe-text-muted)]">
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--frappe-text-muted)]">
              No notifications yet. Alerts appear when you record sales, purchases,
              or transfers.
            </p>
          ) : (
            <div className="space-y-1">
              {items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  compact
                  onAction={() => void handleItemAction()}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--frappe-border)] bg-[var(--frappe-section-head)]/60 px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full text-xs text-[var(--frappe-primary)]"
            asChild
          >
            <Link href="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
