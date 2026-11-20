import Adw from "gi://Adw?version=1"
import Gtk from "gi://Gtk?version=4.0"
import { For, createComputed, type Accessor } from "ags"
import { t } from "../../../core/i18n"
import { busy } from "../../../core/state"
import type { Generation, PackageChange } from "../../../update"
import { trackById } from "../../reactivity"
import { createHistoryViewModel } from "./historyViewModel"

export interface HistoryPageProps {
  onRollback: (generation: Generation) => void
}

function changeSubtitle(change: PackageChange): string {
  switch (change.kind) {
    case "changed":
      return `${change.oldVersion} → ${change.newVersion}`
    case "added":
      return t.history.added(change.newVersion ?? "?")
    default:
      return t.history.removed(change.oldVersion ?? "?")
  }
}

function GenerationRow(
  initial: Generation,
  list: Accessor<Generation[]>,
  onRollback: (generation: Generation) => void,
): Gtk.Widget {
  // O id de uma geração passada não muda, só a marca de "ativa" — por isso
  // ela precisa ser reativa para não ficar presa depois de um rollback.
  const generation = trackById(list, initial, (g) => g.id)

  return (
    <Adw.ActionRow
      title={t.history.generation(initial.id)}
      subtitle={createComputed([generation], (g) =>
        g.current
          ? `${g.date}  ·  ${g.hash}  ·  ${t.history.active}`
          : `${g.date}  ·  ${g.hash}`,
      )}
      cssClasses={["monospace"]}
    >
      <Gtk.Button
        $type="suffix"
        valign={Gtk.Align.CENTER}
        label={t.history.reactivate}
        cssClasses={["flat"]}
        sensitive={createComputed([busy], (b) => !b)}
        visible={createComputed([generation], (g) => !g.current)}
        onClicked={() => onRollback(initial)}
      />
    </Adw.ActionRow>
  ) as Gtk.Widget
}

export default function HistoryPage({
  onRollback,
}: HistoryPageProps): Gtk.Widget {
  const vm = createHistoryViewModel()

  return (
    <Adw.PreferencesPage>
      <Adw.PreferencesGroup
        title={t.history.changesTitle}
        description={vm.closureSummary}
      >
        <For each={vm.changes} id={(c: PackageChange) => c.name}>
          {(change: PackageChange) => (
            <Adw.ActionRow
              title={change.name}
              subtitle={changeSubtitle(change)}
            />
          )}
        </For>
      </Adw.PreferencesGroup>

      <Adw.PreferencesGroup
        title={t.history.generationsTitle}
        description={t.history.generationsDescription}
      >
        <For each={vm.generations} id={(g: Generation) => g.id}>
          {(generation: Generation) =>
            GenerationRow(generation, vm.generations, onRollback)
          }
        </For>
      </Adw.PreferencesGroup>

      <Adw.PreferencesGroup title={t.history.logTitle}>
        <Gtk.ScrolledWindow heightRequest={220} cssClasses={["card"]}>
          <Gtk.Label
            label={vm.logText}
            xalign={0}
            yalign={0}
            selectable
            wrap
            marginTop={8}
            marginBottom={8}
            marginStart={12}
            marginEnd={12}
            cssClasses={["monospace", "caption"]}
          />
        </Gtk.ScrolledWindow>
      </Adw.PreferencesGroup>
    </Adw.PreferencesPage>
  ) as Gtk.Widget
}
