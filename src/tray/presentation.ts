import GLib from "gi://GLib"
import { t } from "../core/i18n"
import type { Phase } from "../core/state"
import type { CheckResult } from "../core/types"

/**
 * Como o estado da aplicação aparece no indicador de bandeja. Fica aqui, e
 * não em `core/state.ts`, porque é apresentação — e apresentação da bandeja,
 * não da janela.
 */

/** Ícone do indicador para o estado atual. */
export function iconFor(current: Phase, check: CheckResult | null): string {
  if (current === "error") return "nix-updater-error"
  if (current !== "idle") return "nix-updater-checking-symbolic"
  if (check && check.updatesAvailable > 0) return "nix-updater-available"
  return "nix-updater-ok-symbolic"
}

export function tooltipFor(
  current: Phase,
  check: CheckResult | null,
  error: string | null,
): [string, string] {
  const title = "nix-updater"

  switch (current) {
    case "checking":
      return [title, t.tray.checkingUpdates]
    case "preparing":
      return [title, t.tray.buildingConfig]
    case "applying":
      return [title, t.tray.applying]
    case "error":
      return [title, error ?? t.tray.lastOperationFailed]
    default:
      break
  }

  if (!check) return [title, t.tray.neverChecked]

  const when =
    GLib.DateTime.new_from_iso8601(check.checkedAt, null)?.format("%H:%M") ?? ""
  if (check.updatesAvailable === 0) {
    return [title, t.tray.allUpToDate(when)]
  }

  const apps = check.apps.filter((a) => a.state === "update-available")
  const detail =
    apps.length > 0
      ? apps.map((a) => `${a.label} ${a.candidate}`).join(", ")
      : t.tray.sharedInputsDetail
  return [title, t.tray.updatesSummary(check.updatesAvailable, detail)]
}
