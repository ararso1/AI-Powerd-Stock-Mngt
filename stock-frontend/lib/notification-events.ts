export const NOTIFICATIONS_REFRESH_EVENT = "notifications:refresh";

/** Call after actions that may create backend notifications (sale, purchase, transfer). */
export function requestNotificationsRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}
