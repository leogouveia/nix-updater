import Adw from "gi://Adw?version=1"
import Gtk from "gi://Gtk?version=4.0"
import { For, createComputed } from "ags"
import { t } from "../../../core/i18n"
import { result } from "../../../core/state"
import type { AppStatus } from "../../../core/types"
import SelectionCheckButton from "../../components/SelectionCheckButton"
import StatusBadge from "../../components/StatusBadge"
import { trackById } from "../../reactivity"

function versionLabel(status: AppStatus): string {
  switch (status.state) {
    case "update-available":
      return `${status.installed} → ${status.candidate}`
    case "pending-apply":
      return t.apps.lockAhead(
        status.installed ?? "?",
        status.candidate ?? "?",
      )
    default:
      return status.installed ?? t.status.unknownVersion
  }
}

function AppRow(initial: AppStatus): Gtk.Widget {
  const apps = createComputed([result], (r) => r?.apps ?? [])
  const status = trackById(apps, initial, (a) => a.id)

  return (
    <Adw.ActionRow
      title={initial.label}
      subtitle={createComputed(
        [status],
        (s) => `${versionLabel(s)}  ·  ${s.input}`,
      )}
    >
      <SelectionCheckButton
        input={initial.input}
        enabled={createComputed(
          [status],
          (s) => s.state === "update-available" || s.state === "pending-apply",
        )}
      />
      <Gtk.Image
        $type="prefix"
        iconName={initial.icon || "package-x-generic-symbolic"}
        pixelSize={32}
      />
      {StatusBadge(createComputed([status], (s) => s.state))}
    </Adw.ActionRow>
  ) as Gtk.Widget
}

export default function AppsPage(): Gtk.Widget {
  const apps = createComputed([result], (r) => r?.apps ?? [])

  return (
    <Adw.PreferencesPage>
      <Adw.PreferencesGroup
        title={t.apps.title}
        description={t.apps.description}
      >
        <For each={apps} id={(a: AppStatus) => a.id}>
          {(app: AppStatus) => AppRow(app)}
        </For>
      </Adw.PreferencesGroup>
    </Adw.PreferencesPage>
  ) as Gtk.Widget
}
