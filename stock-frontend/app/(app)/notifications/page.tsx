"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DataCardTable } from "@/components/shared/data-card-table";
import { PageLoading } from "@/components/shared/page-loading";
import { useNotifications } from "@/components/notifications/notifications-provider";
import {
  FrappeFilterBar,
  FrappeButtonPrimary,
  FrappeListToolbar,
} from "@/components/frappe";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ListSearchField } from "@/components/shared/list-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildNotificationsListPath } from "@/lib/list-query";
import {
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";
import {
  NOTIFICATION_MODULES,
  notificationDetailPath,
} from "@/lib/notification-routes";
import { errorMessage, formatDate, formatRelativeDate } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { CheckCheckIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

type ReadFilter = "" | "true" | "false";

export default function NotificationsPage() {
  const { refreshUnreadCount, setUnreadCount } = useNotifications();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const isReadParam =
    readFilter === "true" ? true : readFilter === "false" ? false : undefined;

  const { rows, meta, setPage, setLimit, loading, reload } =
    usePaginatedList<Notification>(
      (page, limit) =>
        buildNotificationsListPath(
          {
            from: from || undefined,
            to: to || undefined,
            search: debouncedSearch || undefined,
            isRead: isReadParam,
            module: moduleFilter || undefined,
          },
          page,
          limit
        ),
      [from, to, debouncedSearch, readFilter, moduleFilter]
    );

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      const updated = await markAllNotificationsRead();
      setUnreadCount(0);
      await refreshUnreadCount();
      reload();
      toast.success(
        updated > 0 ? `${updated} notification(s) marked read` : "All caught up"
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      await refreshUnreadCount();
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleDismiss(id: string) {
    try {
      await dismissNotification(id);
      await refreshUnreadCount();
      reload();
      toast.success("Notification dismissed");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <AppShell
      title="Notifications"
      subtitle="Alerts from sales, purchases, stock transfers, and low-stock (if you have inventory access)"
      breadcrumbs={[
        { label: "Home", href: "/dashboard" },
        { label: "Notifications" },
      ]}
      actions={
        <FrappeButtonPrimary
          type="button"
          disabled={markingAll}
          onClick={() => void handleMarkAllRead()}
        >
          <CheckCheckIcon className="size-3.5" />
          {markingAll ? "Updating…" : "Mark all read"}
        </FrappeButtonPrimary>
      }
    >
      <FrappeFilterBar>
        <ListSearchField
          value={search}
          onChange={setSearch}
          placeholder="Search title or message…"
        />
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />
        <Select
          value={readFilter || "__all__"}
          onValueChange={(v) =>
            setReadFilter(v === "__all__" ? "" : (v as ReadFilter))
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            <SelectItem value="false">Unread</SelectItem>
            <SelectItem value="true">Read</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={moduleFilter || "__all__"}
          onValueChange={(v) =>
            setModuleFilter(v === "__all__" ? "" : v)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All modules</SelectItem>
            {NOTIFICATION_MODULES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FrappeFilterBar>

      <FrappeListToolbar>
        <span className="text-[var(--frappe-text-muted)]">
          {meta.total} notification{meta.total === 1 ? "" : "s"}
        </span>
      </FrappeListToolbar>

      {loading ? (
        <PageLoading />
      ) : (
        <DataCardTable
          rows={rows}
          emptyTitle="No notifications"
          emptyDescription="New alerts appear when you record sales, purchases, or stock transfers. Low-stock warnings are sent to users with inventory access."
          pagination={{
            meta,
            onPageChange: setPage,
            onLimitChange: setLimit,
            disabled: loading,
          }}
          columns={[
            {
              key: "status",
              header: "",
              className: "w-8",
              cell: (n) =>
                !n.isRead ? (
                  <span
                    className="inline-block size-2 rounded-full bg-[var(--frappe-primary)]"
                    title="Unread"
                  />
                ) : null,
            },
            {
              key: "title",
              header: "Notification",
              cell: (n) => (
                <Link
                  href={notificationDetailPath(n.id)}
                  className="block max-w-md text-left hover:text-[var(--frappe-primary)]"
                >
                  <p className="font-medium text-[var(--frappe-text)]">
                    {n.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--frappe-text-muted)]">
                    {n.message}
                  </p>
                </Link>
              ),
            },
            {
              key: "module",
              header: "Module",
              cell: (n) => (
                <Badge variant="outline" className="text-xs capitalize">
                  {n.module.replace(/_/g, " ")}
                </Badge>
              ),
            },
            {
              key: "type",
              header: "Type",
              cell: (n) => (
                <Badge variant="secondary" className="text-xs font-normal">
                  {n.type.replace(/_/g, " ")}
                </Badge>
              ),
            },
            {
              key: "when",
              header: "When",
              cell: (n) => (
                <span
                  className="text-sm text-[var(--frappe-text-muted)]"
                  title={formatDate(n.createdAt)}
                >
                  {formatRelativeDate(n.createdAt)}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "w-28 text-right",
              cell: (n) => (
                <div className="flex justify-end gap-1">
                  {!n.isRead ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => void handleMarkRead(n.id)}
                    >
                      Read
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-[var(--frappe-text-muted)] hover:text-destructive"
                    onClick={() => void handleDismiss(n.id)}
                    aria-label="Dismiss"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}
    </AppShell>
  );
}
