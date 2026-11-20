/**
 * CLI somente-leitura do nix-updater.
 *
 *   nix develop -c ags run apps/nix-updater/cli.ts -- --json
 *
 * Existe para que toda a lógica de descoberta e checagem seja testável sem
 * depender de sessão gráfica, barramento ou indicador.
 */
import GLib from "gi://GLib"
import system from "system"
import { check } from "./src/check"
import { loadConfig, localePreference } from "./src/core/config"
import { initI18n, t } from "./src/core/i18n"
import type { CheckResult } from "./src/core/types"

function render(result: CheckResult): string {
  const lines: string[] = []

  lines.push(t.cli.appsHeader)
  for (const app of result.apps) {
    const mark =
      app.state === "update-available"
        ? "↑"
        : app.state === "pending-apply"
          ? "!"
          : app.state === "up-to-date"
            ? "="
            : "?"
    const versions =
      app.state === "update-available"
        ? `${app.installed} → ${app.candidate}`
        : app.state === "pending-apply"
          ? `${app.installed} ${t.cli.lockAlreadyHas(app.candidate ?? "?")}`
          : `${app.installed ?? "?"}`
    lines.push(`  ${mark} ${app.label.padEnd(20)} ${versions}  [${app.input}]`)
  }

  lines.push("")
  lines.push(t.cli.declaredHeader)
  for (const pkg of result.declaredPackages) {
    const mark =
      pkg.state === "update-available"
        ? "↑"
        : pkg.state === "up-to-date"
          ? "="
          : "?"
    const versions =
      pkg.state === "update-available"
        ? `${pkg.installed} → ${pkg.candidate}`
        : `${pkg.installed ?? "?"}`
    lines.push(`  ${mark} ${pkg.attr.padEnd(30)} ${versions}`)
  }

  lines.push("")
  lines.push(t.cli.inputsHeader)
  for (const input of result.inputs) {
    const mark = input.changed ? "↑" : "="
    const revs = input.changed
      ? `${input.currentRev} → ${input.candidateRev}  (${input.currentDate} → ${input.candidateDate})`
      : `${input.currentRev}  (${input.currentDate})`
    lines.push(`  ${mark} ${input.name.padEnd(20)} ${revs}`)
  }

  lines.push("")
  lines.push(
    t.cli.sharedCount(result.sharedPackages.length),
  )
  lines.push(t.cli.updatesAvailable(result.updatesAvailable))

  return lines.join("\n")
}

loadConfig()
initI18n(localePreference.peek())

const args = system.programArgs
const asJson = args.includes("--json")

const loop = GLib.MainLoop.new(null, false)
let exitCode = 0

check()
  .then((result) => {
    print(asJson ? JSON.stringify(result, null, 2) : render(result))
  })
  .catch((error) => {
    printerr(`nix-updater: ${error instanceof Error ? error.message : error}`)
    exitCode = 1
  })
  .finally(() => loop.quit())

loop.run()
system.exit(exitCode)
