import GLib from "gi://GLib"

/**
 * Travado de propósito: a aplicação não tenta generalizar para outras
 * arquiteturas, só para outras máquinas/usuários (ver `src/core/config.ts`).
 */
export const SYSTEM = "x86_64-linux"

export const INSTANCE_NAME = "nix-updater"

/**
 * O AGS deriva o applicationId de "io.Astal." + instanceName. O ícone do
 * aplicativo é instalado com este mesmo nome (ver `default.nix`), que é como
 * o shell casa a janela com o ícone — e como o AboutDialog o encontra.
 */
export const APP_ID = `io.Astal.${INSTANCE_NAME}`

export const VERSION = "0.1.0"

export const HOME_PROFILE =
  `${GLib.get_user_state_dir()}/nix/profiles/home-manager`

export const STATE_DIR = `${GLib.get_user_state_dir()}/nix-updater`
