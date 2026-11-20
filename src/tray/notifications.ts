import Gio from "gi://Gio"
import app from "ags/gtk4/app"
import { t } from "../core/i18n"

/** Evita repetir a notificação a cada verificação: só na transição. */
let lastNotified = 0

/**
 * Esquece a última contagem notificada, para que a próxima verificação
 * notifique mesmo que o número coincida. Chamado depois de aplicar, quando
 * "2 atualizações" antes e depois significam coisas diferentes.
 */
export function resetUpdateNotification(): void {
  lastNotified = 0
}

export function notifyUpdates(count: number, summary: string): void {
  if (count === 0 || count === lastNotified) return
  lastNotified = count

  const notification = new Gio.Notification()
  notification.set_title(t.notifications.title(count))
  notification.set_body(summary)
  notification.set_icon(Gio.ThemedIcon.new("nix-updater-available"))
  notification.add_button(t.notifications.view, "app.show")
  app.send_notification("nix-updater-updates", notification)
}
