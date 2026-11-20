import { check } from "../check"
import { apply, prepare, rollbackProfile, type Generation } from "../update"
import { notifyUpdates, resetUpdateNotification } from "../tray/notifications"
import { flakeDir } from "./config"
import { t } from "./i18n"
import { readFile } from "./proc"
import * as state from "./state"

/**
 * As operações da aplicação: cada uma conduz uma transição de fase, chama o
 * módulo de integração correspondente (`check`/`update`) e publica o
 * resultado em `core/state`.
 *
 * Mora aqui, e não na UI, porque tem dois consumidores — a janela e o
 * handler de IPC em `app.tsx`. A bandeja não é tocada diretamente: ela se
 * atualiza assinando `phase`/`result`/`lastError`.
 */

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function fail(message: string, describe: (message: string) => string): void {
  state.setLastError(message)
  state.setPhase("error")
  state.showToast("error", describe(message))
}

export interface CheckOptions {
  /** Não mostra o toast de sucesso — usado na reverificação pós-aplicar. */
  silent?: boolean
}

export async function runCheck(options: CheckOptions = {}): Promise<void> {
  const current = state.phase.get()
  if (current !== "idle" && current !== "error") return

  state.setPhase("checking")
  state.setLastError(null)

  try {
    const result = await check()
    state.setResult(result)
    state.setLockSnapshot(readFile(`${flakeDir.peek()}/flake.lock`))
    state.persist()
    state.setPhase("idle")

    if (result.updatesAvailable === 0) resetUpdateNotification()

    const apps = result.apps
      .filter((a) => a.state === "update-available")
      .map((a) => `${a.label} ${a.candidate}`)
    const inputs = result.inputs
      .filter((i) => i.changed && i.apps.length === 0)
      .map((i) => i.name)
    notifyUpdates(
      result.updatesAvailable,
      [...apps, ...inputs].join(", ") || t.notifications.flakeInputs,
    )

    if (!options.silent) {
      state.showToast(
        "success",
        result.updatesAvailable === 0
          ? t.toasts.checkDoneUpToDate
          : t.toasts.checkDoneUpdates(result.updatesAvailable),
      )
    }
  } catch (error) {
    fail(messageOf(error), t.toasts.checkFailed)
  }
}

async function runPrepareFor(inputs: string[]): Promise<void> {
  if (state.phase.get() === "preparing") return

  state.setPhase("preparing")
  state.setLastError(null)
  state.setPrepared(null)
  state.setApplied(false)
  state.clearLog()

  try {
    const { result } = await prepare({
      inputs,
      expectedLock: state.lockSnapshot.get() ?? undefined,
      onLog: state.appendLog,
    })
    state.setPrepared(result)
    state.setPhase("idle")

    if (result.unselectedChanges.length > 0) {
      state.appendLog(
        t.log.unselectedChanges(result.unselectedChanges.join(", ")),
      )
    }
    state.showToast(
      "success",
      result.changes.length > 0
        ? t.toasts.preparedChanges(result.changes.length)
        : t.toasts.preparedNoChanges,
    )
  } catch (error) {
    fail(messageOf(error), t.toasts.prepareFailed)
  }
}

/** Granular (Aplicativos/Inputs): só os inputs marcados na seleção. */
export function runPrepare(): Promise<void> {
  return runPrepareFor(state.selection.get())
}

/**
 * Geral (Pacotes): ignora a seleção granular de propósito — essa aba não
 * oferece controle fino, então pega todo input sem app dono de uma vez.
 */
export function runPrepareAll(): Promise<void> {
  const sharedInputs = (state.result.get()?.inputs ?? [])
    .filter((i) => i.apps.length === 0)
    .map((i) => i.name)
  return runPrepareFor(sharedInputs)
}

export async function runApply(): Promise<void> {
  if (!state.prepared.get()) return

  state.setPhase("applying")

  try {
    await apply(state.appendLog)
    // O diff continua visível no Histórico — só a seleção e o botão Aplicar
    // zeram, para não convidar a reaplicar o mesmo build.
    state.setApplied(true)
    state.setSelection([])
    state.setPhase("idle")
    resetUpdateNotification()
    state.showToast("success", t.toasts.applySucceeded)
    await runCheck({ silent: true })
  } catch (error) {
    fail(messageOf(error), t.toasts.applyFailed)
  }
}

export async function runRollback(generation: Generation): Promise<void> {
  state.setPhase("applying")

  try {
    await rollbackProfile(generation, state.appendLog)
    state.setPhase("idle")
    state.showToast("success", t.toasts.generationReactivated(generation.id))
    await runCheck({ silent: true })
  } catch (error) {
    fail(messageOf(error), (message) =>
      t.toasts.rollbackFailed(generation.id, message),
    )
  }
}
