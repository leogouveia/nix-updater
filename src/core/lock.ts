import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { t } from "./i18n"

const LOCK_PATH = `${GLib.get_user_runtime_dir()}/nix-updater.lock`

export class BusyError extends Error {
  constructor() {
    super(t.errors.operationInProgress)
  }
}

/**
 * Exclusão mútua entre operações que escrevem no flake.
 *
 * Impede que um "preparar" e um "aplicar" disputem o mesmo `flake.lock` — e,
 * por tabela, que duas instâncias do app façam isso entre si.
 */
export class OperationLock {
  private constructor(private readonly file: Gio.File) {}

  static acquire(): OperationLock {
    const file = Gio.File.new_for_path(LOCK_PATH)
    try {
      const stream = file.create(Gio.FileCreateFlags.NONE, null)
      stream.write_all(`${new Date().toISOString()}\n`, null)
      stream.close(null)
    } catch (error) {
      if (error instanceof GLib.Error && error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
        throw new BusyError()
      }
      throw error
    }
    return new OperationLock(file)
  }

  release(): void {
    try {
      this.file.delete(null)
    } catch {
      // Já removido: nada a fazer.
    }
  }

  /** Remove um lock órfão deixado por um processo que morreu. */
  static clearStale(): void {
    const file = Gio.File.new_for_path(LOCK_PATH)
    try {
      file.delete(null)
    } catch {
      // Não existia.
    }
  }
}
