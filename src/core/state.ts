import GLib from "gi://GLib"
import { createComputed, createState } from "ags"
import { readFile, fileExists } from "./proc"
import { STATE_DIR } from "./registry"
import type { CheckResult } from "./types"
import type { PrepareResult } from "../update"

export type Phase = "idle" | "checking" | "preparing" | "applying" | "error"

const STATE_FILE = `${STATE_DIR}/state.json`

export const [phase, setPhase] = createState<Phase>("idle")
/** Há operação em andamento: trava os botões que disparariam outra. */
export const busy = createComputed(
  [phase],
  (p) => p !== "idle" && p !== "error",
)
export const [result, setResult] = createState<CheckResult | null>(null)
export const [prepared, setPrepared] = createState<PrepareResult | null>(null)
/** Diff já ativado: mantém o resultado visível, mas trava o botão Aplicar. */
export const [applied, setApplied] = createState(false)
export const [selection, setSelection] = createState<string[]>([])
export const [log, setLog] = createState<string[]>([])
export const [lastError, setLastError] = createState<string | null>(null)

export interface ToastState {
  kind: "success" | "error"
  message: string
}
/**
 * Cada `showToast` é um evento, não um valor persistente: a UI escuta via
 * `subscribe` e manda pro `Adw.ToastOverlay`, que cuida do próprio timeout.
 */
export const [toast, setToast] = createState<ToastState | null>(null)

/** Feedback de uma ação (check/prepare/apply/rollback). */
export function showToast(kind: ToastState["kind"], message: string): void {
  setToast({ kind, message })
}

/** Conteúdo do flake.lock no momento da verificação (detecta edição manual). */
export const [lockSnapshot, setLockSnapshot] = createState<string | null>(null)

export function appendLog(line: string): void {
  setLog((lines) => {
    const next = [...lines, line]
    // O log é para diagnóstico, não para arquivo: mantém o fim.
    return next.length > 2000 ? next.slice(-2000) : next
  })
}

export function clearLog(): void {
  setLog([])
}

export function toggleSelection(input: string): void {
  setSelection((current) =>
    current.includes(input)
      ? current.filter((i) => i !== input)
      : [...current, input],
  )
}

export function persist(): void {
  const current = result.get()
  if (!current) return
  GLib.mkdir_with_parents(STATE_DIR, 0o755)
  GLib.file_set_contents(STATE_FILE, JSON.stringify(current))
}

/** Restaura a última verificação para o ícone já nascer informado. */
export function restore(): void {
  if (!fileExists(STATE_FILE)) return
  try {
    setResult(JSON.parse(readFile(STATE_FILE)) as CheckResult)
  } catch {
    // Estado corrompido: ignora e verifica de novo.
  }
}
