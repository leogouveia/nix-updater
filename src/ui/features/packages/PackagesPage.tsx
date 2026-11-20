import Adw from "gi://Adw?version=1"
import Gtk from "gi://Gtk?version=4.0"
import { For, createComputed, type Accessor } from "ags"
import { t } from "../../../core/i18n"
import type { DeclaredPackageStatus, StorePackage } from "../../../core/types"
import StatusBadge from "../../components/StatusBadge"
import { trackById } from "../../reactivity"
import { createPackagesViewModel } from "./packagesViewModel"

function DeclaredPackageRow(
  initial: DeclaredPackageStatus,
  list: Accessor<DeclaredPackageStatus[]>,
): Gtk.Widget {
  const pkg = trackById(list, initial, (p) => p.attr)

  return (
    <Adw.ActionRow
      title={initial.attr}
      subtitle={createComputed([pkg], (p) =>
        p.state === "update-available"
          ? `${p.installed} → ${p.candidate}`
          : (p.installed ?? t.status.unknownVersion),
      )}
    >
      {StatusBadge(createComputed([pkg], (p) => p.state))}
    </Adw.ActionRow>
  ) as Gtk.Widget
}

/**
 * Declarados + Outros numa aba só: nenhum dos dois tem seleção própria —
 * ambos só se movem quando o input "sem dono" (nixpkgs, em geral) é
 * atualizado inteiro. Separar em abas sugeria um controle que não existe.
 */
export default function PackagesPage(): Gtk.Widget {
  const vm = createPackagesViewModel()

  return (
    <Adw.PreferencesPage>
      <Adw.PreferencesGroup
        title={t.packages.declaredTitle}
        description={t.packages.declaredDescription}
      >
        <For
          each={vm.declaredPackages}
          id={(p: DeclaredPackageStatus) => p.attr}
        >
          {(pkg: DeclaredPackageStatus) =>
            DeclaredPackageRow(pkg, vm.declaredPackages)
          }
        </For>
      </Adw.PreferencesGroup>

      {/* Grupo próprio: dentro do grupo da lista, o campo cairia depois das
          linhas e sumiria no fim da rolagem. */}
      <Adw.PreferencesGroup
        title={t.packages.sharedTitle}
        description={vm.sharedSummary}
      >
        <Gtk.SearchEntry
          placeholderText={t.packages.filterPlaceholder}
          onSearchChanged={(self: Gtk.SearchEntry) => vm.setQuery(self.text)}
        />
      </Adw.PreferencesGroup>

      <Adw.PreferencesGroup>
        <For each={vm.visibleSharedPackages} id={(p: StorePackage) => p.path}>
          {(pkg: StorePackage) => (
            <Adw.ActionRow title={pkg.name}>
              <Gtk.Label
                $type="suffix"
                valign={Gtk.Align.CENTER}
                cssClasses={["dim-label", "numeric"]}
                label={pkg.version || "—"}
              />
            </Adw.ActionRow>
          )}
        </For>
      </Adw.PreferencesGroup>
    </Adw.PreferencesPage>
  ) as Gtk.Widget
}
