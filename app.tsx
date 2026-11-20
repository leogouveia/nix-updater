import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import system from "system"
import Gtk from "gi://Gtk?version=4.0"
import style from "./style.scss"
import Window from "./src/ui/Window"
import SettingsDialog from "./src/ui/SettingsDialog"
import { TrayItem } from "./src/tray/sni"
import { iconFor, tooltipFor } from "./src/tray/presentation"
import { APP_ID, INSTANCE_NAME } from "./src/core/registry"
import { loadConfig, localePreference, homeConfigNotice } from "./src/core/config"
import { initI18n, t } from "./src/core/i18n"
import {
  runApply,
  runCheck,
  runPrepare,
  runPrepareAll,
  runRollback,
} from "./src/core/operations"
import * as state from "./src/core/state"

const ICONS = `${SRC}/icons`

/**
 * O flake (ver flake.nix) só constrói pra x86_64-linux — isso aqui é só uma
 * trava extra caso o binário seja copiado pra outra máquina/arquitetura em
 * vez de construído lá. Síncrono de propósito: roda antes de qualquer coisa
 * do Gtk/Adw inicializar.
 */
function assertSupportedPlatform(): void {
  let arch = "desconhecido"
  try {
    const [ok, stdout] = GLib.spawn_command_line_sync("uname -m")
    if (ok && stdout) arch = new TextDecoder().decode(stdout).trim()
  } catch {
    // arch continua "desconhecido" — cai no mesmo erro abaixo.
  }

  if (arch !== "x86_64") {
    // Antes de `initI18n`: cai no catálogo padrão (inglês) de propósito,
    // já que a config nem chegou a ser lida.
    printerr(t.errors.unsupportedPlatform(arch))
    system.exit(1)
  }
}

assertSupportedPlatform()

let window: Gtk.Window | null = null
let tray: TrayItem | null = null

function toggleWindow(): void {
  if (!window) return
  window.visible = !window.visible
  if (window.visible) window.present()
}

function syncTray(): void {
  if (!tray) return
  const phase = state.phase.get()
  const result = state.result.get()

  tray.setIcon(iconFor(phase, result))
  const [title, body] = tooltipFor(phase, result, state.lastError.get())
  tray.setTooltip(title, body)
  tray.setStatus(
    result && result.updatesAvailable > 0 && phase === "idle"
      ? "NeedsAttention"
      : "Active",
  )
}

app.start({
  instanceName: INSTANCE_NAME,
  css: style,
  icons: ICONS,

  async main() {
    // Ícone da janela para compositores que não casam pelo .desktop
    // (Wayland já casa pelo app_id, X11 e alguns docks precisam disto).
    Gtk.Window.set_default_icon_name(APP_ID)

    const show = new Gio.SimpleAction({ name: "show" })
    show.connect("activate", () => {
      if (window) {
        window.visible = true
        window.present()
      }
    })
    app.add_action(show)

    // Só demora na primeira execução (ou se a config foi apagada): depois
    // de confirmado uma vez, o que vem do disco é lido sem rodar `nix eval`.
    await loadConfig()
    // Antes de montar qualquer janela: `t` é resolvido uma vez por processo,
    // então trocar o idioma nas Configurações só vale na próxima execução.
    initI18n(localePreference.peek())
    state.restore()

    window = Window({
      onCheck: () => void runCheck(),
      onPrepare: () => void runPrepare(),
      onPrepareAll: () => void runPrepareAll(),
      onApply: () => void runApply(),
      onRollback: (generation) => void runRollback(generation),
    }) as Gtk.Window

    // Duas ou mais `homeConfigurations` encontradas: a primeira foi usada
    // como palpite, mas sem aviso o usuário não saberia que precisa revisar.
    const notice = homeConfigNotice.peek()
    if (notice?.kind === "ambiguous") {
      state.showToast("error", t.toasts.homeConfigAmbiguous(notice.candidates.join(", ")))
    }

    tray = new TrayItem({
      id: "nix-updater",
      title: t.app.windowTitle,
      iconThemePath: ICONS,
      onActivate: toggleWindow,
      menu: [
        { label: t.tray.open, onActivate: () => show.activate(null) },
        { label: t.actions.check, onActivate: () => void runCheck() },
        { label: "", separator: true },
        { label: t.tray.quit, onActivate: () => app.quit() },
      ],
    })

    void tray.start().then(syncTray)

    // O indicador acompanha o estado em vez de ser atualizado por cada
    // operação: `lastError` entra na lista porque duas falhas seguidas não
    // mudam a fase, mas mudam o que a dica de ferramenta deve dizer.
    state.phase.subscribe(syncTray)
    state.result.subscribe(syncTray)
    state.lastError.subscribe(syncTray)
  },

  requestHandler(argv, res) {
    const [command] = argv

    switch (command) {
      case "check":
        void runCheck().then(() =>
          res(t.ipc.updateCount(state.result.get()?.updatesAvailable ?? 0)),
        )
        return
      case "toggle":
        toggleWindow()
        return res(t.ipc.ok)
      case "settings":
        if (window) SettingsDialog(argv[1]).present(window)
        return res(t.ipc.ok)
      case "status":
        return res(
          JSON.stringify(
            {
              phase: state.phase.get(),
              result: state.result.get(),
              error: state.lastError.get(),
            },
            null,
            2,
          ),
        )
      case "select": {
        // "select" sem argumentos limpa a seleção.
        const inputs = argv.slice(1)
        state.setSelection(inputs)
        return res(inputs.join(", ") || t.ipc.nothingSelected)
      }
      case "prepare":
        void runPrepare().then(() => {
          const built = state.prepared.get()
          res(
            built
              ? JSON.stringify(built, null, 2)
              : (state.lastError.get() ?? t.ipc.failed),
          )
        })
        return
      case "apply":
        void runApply().then(() => res(state.lastError.get() ?? t.ipc.applied))
        return
      case "quit":
        res(t.ipc.quitting)
        return app.quit()
      default:
        return res(t.ipc.help)
    }
  },
})
