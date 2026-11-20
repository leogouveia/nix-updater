import Adw from "gi://Adw?version=1"
import Gtk from "gi://Gtk?version=4.0"
import app from "ags/gtk4/app"
import { createComputed } from "ags"
import { t } from "../core/i18n"
import { busy, toast } from "../core/state"
import type { Generation } from "../update"
import ActionFooter from "./components/ActionFooter"
import AppsPage from "./features/apps/AppsPage"
import HistoryPage from "./features/history/HistoryPage"
import InputsPage from "./features/inputs/InputsPage"
import PackagesPage from "./features/packages/PackagesPage"
import { createWindowViewModel } from "./windowViewModel"
import { AppMenu } from "./components/AppMenu"

export interface WindowActions {
  onCheck: () => void
  /** Preparar granular: usa a seleção de Aplicativos/Inputs. */
  onPrepare: () => void
  /** Preparar geral: ignora a seleção, sempre pega todo input "sem dono". */
  onPrepareAll: () => void
  onApply: () => void
  onRollback: (generation: Generation) => void
}

function buildStack(actions: WindowActions): Adw.ViewStack {
  const stack = (<Adw.ViewStack />) as Adw.ViewStack

  stack.add_titled_with_icon(
    AppsPage(),
    "apps",
    t.tabs.apps,
    "view-grid-symbolic",
  )
  stack.add_titled_with_icon(
    InputsPage(),
    "inputs",
    t.tabs.inputs,
    "system-software-install-symbolic",
  )
  stack.add_titled_with_icon(
    PackagesPage(),
    "packages",
    t.tabs.packages,
    "package-x-generic-symbolic",
  )
  stack.add_titled_with_icon(
    HistoryPage({ onRollback: actions.onRollback }),
    "history",
    t.tabs.history,
    "document-open-recent-symbolic",
  )

  return stack
}

/**
 * Empilha cada `showToast` no overlay. É um evento, não um valor
 * persistente: o `Adw.Toast` cuida do próprio tempo de exibição a partir
 * daqui.
 */
function connectToasts(overlay: Adw.ToastOverlay): void {
  toast.subscribe(() => {
    const current = toast.peek()
    if (!current) return
    overlay.add_toast(
      new Adw.Toast({
        title: `${current.kind === "success" ? "✓" : "✗"} ${current.message}`,
        timeout: current.kind === "error" ? 6 : 4,
      }),
    )
  })
}

export default function Window(actions: WindowActions): Gtk.Widget {
  const stack = buildStack(actions)
  const vm = createWindowViewModel(stack)

  const toolbarView = (
    <Adw.ToolbarView>
      <Adw.HeaderBar $type="top">
        <Adw.ViewSwitcher
          $type="title"
          stack={stack}
          policy={Adw.ViewSwitcherPolicy.WIDE}
        />
        <Gtk.Button
          $type="start"
          iconName="view-refresh-symbolic"
          tooltipText={t.actions.check}
          sensitive={createComputed([busy], (b) => !b)}
          onClicked={actions.onCheck}
        />
        <AppMenu
            $type="end"
        />
      </Adw.HeaderBar>

      {stack}

      <Gtk.Box
        $type="bottom"
        spacing={12}
        marginTop={10}
        marginBottom={10}
        marginStart={12}
        marginEnd={12}
        visible={vm.showFooter}
      >
        <ActionFooter
          visible={vm.showGranularFooter}
          statusText={vm.granularStatus}
          prepareTooltip={t.actions.prepareGranularTooltip}
          prepareEnabled={vm.hasSelection}
          onPrepare={actions.onPrepare}
          onApply={actions.onApply}
        />
        <ActionFooter
          visible={vm.showGeneralFooter}
          statusText={vm.generalStatus}
          prepareTooltip={t.actions.prepareAllTooltip}
          prepareEnabled={vm.hasSharedUpdates}
          onPrepare={actions.onPrepareAll}
          onApply={actions.onApply}
        />
      </Gtk.Box>
    </Adw.ToolbarView>
  ) as Adw.ToolbarView

  const toastOverlay = (
    <Adw.ToastOverlay child={toolbarView} />
  ) as Adw.ToastOverlay
  connectToasts(toastOverlay)

  return (
    <Adw.ApplicationWindow
      application={app}
      title={t.app.windowTitle}
      defaultWidth={760}
      defaultHeight={620}
      // Fechar esconde: o processo continua vivo e o indicador, publicado.
      onCloseRequest={(self: Adw.ApplicationWindow) => {
        self.visible = false
        return true
      }}
    >
      {toastOverlay}
    </Adw.ApplicationWindow>
  ) as Gtk.Widget
}
