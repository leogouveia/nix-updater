import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { t } from "./i18n"

export interface RunResult {
  ok: boolean
  status: number
  stdout: string
  stderr: string
}

export class CommandError extends Error {
  constructor(
    readonly argv: string[],
    readonly result: RunResult,
  ) {
    super(t.errors.commandFailed(argv[0], result.status, result.stderr.trim()))
  }
}

export interface RunOptions {
  cwd?: string
  /** Mata o processo depois deste tempo; o resultado vem com `ok: false`. */
  timeoutMs?: number
}

/**
 * Executa um comando a partir de um array de argumentos — nunca por
 * concatenação de string, para que nenhum metadado externo possa virar shell.
 */
export function run(
  argv: string[],
  options?: string | RunOptions,
): Promise<RunResult> {
  // `cwd` era posicional; aceitar a string (ou nada) evita mexer nas
  // chamadas antigas, que passam `cwd` possivelmente indefinido.
  const resolved: RunOptions =
    typeof options === "string" ? { cwd: options } : (options ?? {})
  const { cwd, timeoutMs } = resolved

  return new Promise((resolve, reject) => {
    const launcher = new Gio.SubprocessLauncher({
      flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    })
    if (cwd) launcher.set_cwd(cwd)

    let proc: Gio.Subprocess
    try {
      proc = launcher.spawnv(argv)
    } catch (err) {
      reject(err)
      return
    }

    let timedOut = false
    let timeoutId: number | null = null
    if (timeoutMs !== undefined && timeoutMs > 0) {
      timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutMs, () => {
        timedOut = true
        timeoutId = null
        proc.force_exit()
        return GLib.SOURCE_REMOVE
      })
    }

    proc.communicate_utf8_async(null, null, (_, res) => {
      if (timeoutId !== null) GLib.source_remove(timeoutId)
      try {
        const [, stdout, stderr] = proc.communicate_utf8_finish(res)
        // `get_exit_status` só vale para quem terminou normalmente; num
        // processo morto por sinal (o nosso force_exit) ele dispara um
        // CRITICAL do GLib.
        const status = proc.get_if_exited() ? proc.get_exit_status() : -1
        resolve({
          ok: status === 0 && !timedOut,
          status,
          stdout: stdout ?? "",
          stderr: timedOut ? `tempo esgotado após ${timeoutMs}ms` : (stderr ?? ""),
        })
      } catch (err) {
        reject(err)
      }
    })
  })
}

/** Como `run`, mas rejeita quando o comando falha. */
export async function runOk(argv: string[], cwd?: string): Promise<string> {
  const result = await run(argv, cwd)
  if (!result.ok) throw new CommandError(argv, result)
  return result.stdout
}

export async function runJson<T>(argv: string[], cwd?: string): Promise<T> {
  return JSON.parse(await runOk(argv, cwd)) as T
}

export function readFile(path: string): string {
  const [ok, bytes] = GLib.file_get_contents(path)
  if (!ok) throw new Error(t.errors.cannotRead(path))
  return new TextDecoder().decode(bytes)
}

export function fileExists(path: string): boolean {
  return GLib.file_test(path, GLib.FileTest.EXISTS)
}

export interface StreamHandle {
  /** Interrompe o processo; o `runStream` correspondente rejeita. */
  cancel(): void
}

/**
 * Executa um comando longo (build, switch) entregando a saída linha a linha,
 * para que a UI mostre progresso em vez de congelar até o fim.
 */
export function runStream(
  argv: string[],
  onLine: (line: string) => void,
  cwd?: string,
): { done: Promise<RunResult>; handle: StreamHandle } {
  const launcher = new Gio.SubprocessLauncher({
    flags:
      Gio.SubprocessFlags.STDOUT_PIPE |
      Gio.SubprocessFlags.STDERR_MERGE,
  })
  if (cwd) launcher.set_cwd(cwd)

  const proc = launcher.spawnv(argv)
  const stdout = new Gio.DataInputStream({
    base_stream: proc.get_stdout_pipe()!,
    close_base_stream: true,
  })

  const lines: string[] = []

  const readNext = (resolve: (r: RunResult) => void): void => {
    stdout.read_line_async(GLib.PRIORITY_DEFAULT, null, (stream, res) => {
      let line: Uint8Array | null = null
      try {
        ;[line] = stream!.read_line_finish(res)
      } catch {
        line = null
      }

      if (line === null) {
        proc.wait_async(null, () => {
          const status = proc.get_exit_status()
          resolve({
            ok: status === 0,
            status,
            stdout: lines.join("\n"),
            stderr: "",
          })
        })
        return
      }

      const text = new TextDecoder().decode(line)
      lines.push(text)
      onLine(text)
      readNext(resolve)
    })
  }

  const done = new Promise<RunResult>((resolve) => readNext(resolve))
  return { done, handle: { cancel: () => proc.force_exit() } }
}
