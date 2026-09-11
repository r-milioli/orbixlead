/** Evento disparado quando notificações mudam (lida / todas). */
export const NOTIFICATIONS_CHANGED_EVENT = "orbix:notifications-changed";

export function emitNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}
