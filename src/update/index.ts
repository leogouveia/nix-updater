import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { readFile, run, runOk, runStream, type StreamHandle } from "../core/proc"
import { HOME_PROFILE, STATE_DIR } from "../core/registry"
import { flakeDir, homeConfiguration } from "../core/config"
import { t } from "../core/i18n"
import { OperationLock } from "../core/lock"
import { readLock } from "../discovery/flake"

export interface PackageChange {
  kind: "added" | "removed" | "changed"
  name: string
  oldVersion: string | null
  newVersion: string | null
}

export interface PrepareResult {
  resultPath: string
  changes: PackageChange[]
  closureSummary: string | null
  /** Inputs que mudaram sem terem sido selecionados (efeito transitivo). */
  unselectedChanges: string[]
}

export class StaleConfigError extends Error {
  constructor() {
    super(t.errors.staleLock)
  }
}

const RESULT_PATH = `${GLib.get_user_runtime_dir()}/nix-updater/result`

function timestamp(): string {
  return GLib.DateTime.new_now_local().format("%Y%m%d-%H%M%S")!
}

function backupLock(): string {
  const dir = `${STATE_DIR}/backups/${timestamp()}`
  GLib.mkdir_with_parents(dir, 0o755)
  Gio.File.new_for_path(`${flakeDir.peek()}/flake.lock`).copy(
    Gio.File.new_for_path(`${dir}/flake.lock`),
    Gio.FileCopyFlags.OVERWRITE,
    null,
    null,
  )
  return dir
}

function restoreLock(backupDir: string): void {
  Gio.File.new_for_path(`${backupDir}/flake.lock`).copy(
    Gio.File.new_for_path(`${flakeDir.peek()}/flake.lock`),
    Gio.FileCopyFlags.OVERWRITE,
    null,
    null,
  )
}

const NVD_ITEM = /^\[([A-Z])[.+-]\]\s+#\d+\s+(\S+)\s+(.*)$/

export function parseNvdDiff(output: string): {
  changes: PackageChange[]
  closureSummary: string | null
} {
  const changes: PackageChange[] = []
  let closureSummary: string | null = null

  for (const line of output.split("\n")) {
    if (line.startsWith("Closure size:")) {
      closureSummary = line.trim()
      continue
    }

    const m = NVD_ITEM.exec(line)
    if (!m) continue

    const [, flag, name, versions] = m
    const arrow = versions.split(" -> ")
    if (flag === "A") {
      changes.push({
        kind: "added",
        name,
        oldVersion: null,
        newVersion: versions.trim(),
      })
    } else if (flag === "R") {
      changes.push({
        kind: "removed",
        name,
        oldVersion: versions.trim(),
        newVersion: null,
      })
    } else {
      changes.push({
        kind: "changed",
        name,
        oldVersion: arrow[0]?.trim() ?? null,
        newVersion: (arrow[1] ?? arrow[0])?.trim() ?? null,
      })
    }
  }

  return { changes, closureSummary }
}

export interface PrepareOptions {
  /** Inputs selecionados; vazio significa "todos". */
  inputs: string[]
  /** Conteúdo do flake.lock visto na verificação, para detectar edição manual. */
  expectedLock?: string
  onLog: (line: string) => void
}

/**
 * Atualiza os inputs selecionados no flake real, valida e constrói — sem
 * ativar nada. Qualquer falha restaura o `flake.lock` do backup.
 */
export async function prepare(
  options: PrepareOptions,
): Promise<{ result: PrepareResult; cancel: StreamHandle }> {
  const { inputs, expectedLock, onLog } = options
  const dir = flakeDir.peek()
  const homeConfig = homeConfiguration.peek()

  if (expectedLock !== undefined) {
    const current = readFile(`${dir}/flake.lock`)
    if (current !== expectedLock) throw new StaleConfigError()
  }

  const lock = OperationLock.acquire()
  const before = readLock()
  const backup = backupLock()
  let handle: StreamHandle = { cancel: () => {} }

  try {
    onLog(`$ nix flake update ${inputs.join(" ") || t.log.allInputs}`)
    await runOk(["nix", "flake", "update", ...inputs, "--flake", dir])

    const after = readLock()
    const unselectedChanges = Object.keys(after).filter(
      (name) =>
        after[name]?.rev !== before[name]?.rev &&
        inputs.length > 0 &&
        !inputs.includes(name),
    )

    // Avaliação primeiro: é barata e pega erro de sintaxe/opção sem baixar nada.
    onLog(t.log.validating)
    await runOk([
      "nix",
      "eval",
      "--no-warn-dirty",
      "--raw",
      `${dir}#homeConfigurations.${homeConfig}.activationPackage.drvPath`,
    ])

    GLib.mkdir_with_parents(`${GLib.get_user_runtime_dir()}/nix-updater`, 0o755)

    // `nix build` em vez de `home-manager build`: este último não aceita
    // --out-link e deixa o "result" no diretório atual.
    onLog("$ nix build (activationPackage)")
    const build = runStream(
      [
        "nix",
        "build",
        "--no-warn-dirty",
        `${dir}#homeConfigurations.${homeConfig}.activationPackage`,
        "--out-link",
        RESULT_PATH,
      ],
      onLog,
    )
    handle = build.handle
    const buildResult = await build.done
    if (!buildResult.ok) {
      throw new Error(t.errors.buildFailed(buildResult.status))
    }

    const diff = await run([
      "nvd",
      "--color",
      "never",
      "diff",
      `${HOME_PROFILE}/home-path`,
      `${RESULT_PATH}/home-path`,
    ])
    const { changes, closureSummary } = parseNvdDiff(diff.stdout)

    return {
      result: { resultPath: RESULT_PATH, changes, closureSummary, unselectedChanges },
      cancel: handle,
    }
  } catch (error) {
    onLog(t.log.failed(error instanceof Error ? error.message : String(error)))
    onLog(t.log.restoringLock(backup))
    restoreLock(backup)
    throw error
  } finally {
    lock.release()
  }
}

/**
 * Ativa a configuração já construída pelo `prepare`.
 *
 * Roda o `activate` do resultado em vez de `home-manager switch` para garantir
 * que o que entra é exatamente o que foi mostrado no diff — e não um rebuild
 * que poderia pegar outro estado do flake.
 */
export async function apply(onLog: (line: string) => void): Promise<void> {
  const lock = OperationLock.acquire()
  try {
    onLog(`$ ${RESULT_PATH}/activate`)
    const { done } = runStream([`${RESULT_PATH}/activate`], onLog)
    const result = await done
    if (!result.ok) throw new Error(t.errors.activationFailed(result.status))
  } finally {
    lock.release()
  }
}

export interface Generation {
  id: number
  date: string
  path: string
  /** Hash do store, curto — gerações com o mesmo hash têm conteúdo idêntico. */
  hash: string
  current: boolean
}

const STORE_HASH = /^\/nix\/store\/([a-z0-9]+)-/

export async function generations(): Promise<Generation[]> {
  const out = await run(["home-manager", "generations"])
  if (!out.ok) return []

  const parsed: Generation[] = []
  for (const line of out.stdout.split("\n")) {
    // "2026-11-19 12:00 : id 31 -> /nix/store/… (current)"
    const m = /^(.+?) : id (\d+) -> (\S+)( \(current\))?$/.exec(line.trim())
    if (!m) continue
    const path = m[3]
    parsed.push({
      date: m[1],
      id: Number(m[2]),
      path,
      hash: (STORE_HASH.exec(path)?.[1] ?? "").slice(0, 8),
      current: m[4] !== undefined,
    })
  }
  return parsed
}

/**
 * Rollback do *perfil*: reativa uma geração anterior. Não mexe no flake.lock —
 * reverter o lock é operação separada, por backup.
 */
export async function rollbackProfile(
  generation: Generation,
  onLog: (line: string) => void,
): Promise<void> {
  onLog(`$ ${generation.path}/activate`)
  const { done } = runStream([`${generation.path}/activate`], onLog)
  const result = await done
  if (!result.ok) throw new Error(t.errors.rollbackFailed(result.status))
}

export function listBackups(): string[] {
  const dir = Gio.File.new_for_path(`${STATE_DIR}/backups`)
  if (!dir.query_exists(null)) return []

  const names: string[] = []
  const enumerator = dir.enumerate_children(
    "standard::name",
    Gio.FileQueryInfoFlags.NONE,
    null,
  )
  let info: Gio.FileInfo | null
  while ((info = enumerator.next_file(null)) !== null) {
    names.push(info.get_name())
  }
  return names.sort().reverse()
}

/** Reverte apenas o `flake.lock` para um backup — sem tocar no perfil. */
export function revertLock(backupName: string): void {
  restoreLock(`${STATE_DIR}/backups/${backupName}`)
}
