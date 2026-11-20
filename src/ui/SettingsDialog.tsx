import Adw from "gi://Adw?version=1"
import Gtk from "gi://Gtk?version=4.0"
import { For, createRoot } from "ags"
import {
  apps,
  flakeDir,
  homeConfiguration,
  localePreference,
  redetectHomeConfiguration,
  updateApps,
  updateFlakeDir,
  updateHomeConfiguration,
  updateLocalePreference,
  type AppDefinition,
} from "../core/config"
import { LOCALES, t, type LocalePreference } from "../core/i18n"
import { SYSTEM } from "../core/registry"
import { showToast } from "../core/state"

function pickFolder(button: Gtk.Button, onPicked: (path: string) => void): void {
  const dialog = new Gtk.FileDialog({ title: t.settings.folderDialogTitle })
  const root = button.get_root() as Gtk.Window | null
  dialog.select_folder(root, null, (_self, res) => {
    try {
      const folder = dialog.select_folder_finish(res)
      const path = folder?.get_path()
      if (path) onPicked(path)
    } catch {
      // usuário cancelou — nada a fazer.
    }
  })
}

/** "system" primeiro, depois os idiomas na ordem de `LOCALES`. */
const LOCALE_CHOICES: LocalePreference[] = ["system", ...LOCALES]

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
}

function GeneralPage(): Gtk.Widget {
  const flakeDirEntry = (
    <Adw.EntryRow
      title={t.settings.flakeDirEntry}
      text={flakeDir.peek()}
      showApplyButton
      onApply={(self: Adw.EntryRow) => updateFlakeDir(self.text)}
    >
      <Gtk.Button
        $type="suffix"
        iconName="folder-open-symbolic"
        valign={Gtk.Align.CENTER}
        tooltipText={t.settings.chooseFolder}
        onClicked={(self: Gtk.Button) =>
          pickFolder(self, (path) => {
            flakeDirEntry.text = path
            updateFlakeDir(path)
          })
        }
      />
    </Adw.EntryRow>
  ) as Adw.EntryRow

  const homeConfigEntry = (
    <Adw.EntryRow
      title={t.settings.homeConfigEntry}
      text={homeConfiguration.peek()}
      showApplyButton
      onApply={(self: Adw.EntryRow) => updateHomeConfiguration(self.text)}
    >
      <Gtk.Button
        $type="suffix"
        iconName="view-refresh-symbolic"
        valign={Gtk.Align.CENTER}
        tooltipText={t.settings.detectHomeConfig}
        onClicked={(self: Gtk.Button) => {
          self.sensitive = false
          void redetectHomeConfiguration()
            .then((notice) => {
              homeConfigEntry.text = homeConfiguration.peek()
              if (notice === null) {
                showToast(
                  "success",
                  t.settings.homeConfigDetected(homeConfiguration.peek()),
                )
              } else if (notice.kind === "guessed") {
                showToast("error", t.settings.homeConfigNotFound)
              } else {
                showToast(
                  "error",
                  t.settings.homeConfigAmbiguous(notice.candidates.join(", ")),
                )
              }
            })
            .finally(() => {
              self.sensitive = true
            })
        }}
      />
    </Adw.EntryRow>
  ) as Adw.EntryRow

  const localeRow = (
    <Adw.ComboRow
      title={t.settings.languageEntry}
      model={Gtk.StringList.new(
        LOCALE_CHOICES.map((choice) =>
          choice === "system"
            ? t.settings.languageSystem
            : LOCALE_NAMES[choice],
        ),
      )}
      selected={Math.max(0, LOCALE_CHOICES.indexOf(localePreference.peek()))}
      onNotifySelected={(self: Adw.ComboRow) => {
        const chosen = LOCALE_CHOICES[self.selected]
        if (!chosen || chosen === localePreference.peek()) return
        updateLocalePreference(chosen)
        showToast("success", t.settings.languageChanged)
      }}
    />
  ) as Adw.ComboRow

  return (
    <Adw.PreferencesPage
      title={t.settings.generalTab}
      iconName="preferences-system-symbolic"
    >
      <Adw.PreferencesGroup
        title={t.settings.flakeLocationTitle}
        description={t.settings.flakeLocationDescription}
      >
        {flakeDirEntry}
      </Adw.PreferencesGroup>

      <Adw.PreferencesGroup
        title={t.settings.homeConfigTitle}
        description={t.settings.homeConfigDescription}
      >
        {homeConfigEntry}
      </Adw.PreferencesGroup>

      <Adw.PreferencesGroup
        title={t.settings.languageTitle}
        description={t.settings.languageDescription}
      >
        {localeRow}
      </Adw.PreferencesGroup>
    </Adw.PreferencesPage>
  ) as Gtk.Widget
}

const SPLIT_COMMA = /\s*,\s*/
const EMPTY_APP: AppDefinition = {
  id: "",
  label: "",
  icon: "",
  input: "",
  attr: `packages.${SYSTEM}.default`,
  storeNames: [],
}

/**
 * Confirmação antes de apagar — remover um app do catálogo não é
 * reversível pela própria UI (teria que digitar tudo de novo).
 */
function confirmRemoval(
  parent: Adw.Dialog,
  label: string,
  onConfirm: () => void,
): void {
  const alert = new Adw.AlertDialog({
    heading: t.settings.removeHeading,
    body: t.settings.removeBody(label || t.settings.unnamed),
  })
  alert.add_response("cancel", t.settings.cancel)
  alert.add_response("remove", t.settings.remove)
  alert.set_response_appearance("remove", Adw.ResponseAppearance.DESTRUCTIVE)
  alert.set_default_response("cancel")
  alert.set_close_response("cancel")
  alert.connect("response", (_self: Adw.AlertDialog, response: string) => {
    if (response === "remove") onConfirm()
  })
  alert.present(parent)
}

/**
 * Subpágina de edição/criação — empurrada via `push_subpage` do próprio
 * `Adw.PreferencesDialog` (ele já gerencia a navegação e o botão de voltar,
 * não precisa de um `Adw.NavigationView` próprio).
 *
 * Só `id` e `input` são realmente indispensáveis: sem eles não dá nem pra
 * saber qual pacote é, nem de onde a versão vem. O resto tem default
 * razoável e pode ficar em branco.
 */
function buildEditSubpage(
  dialog: Adw.PreferencesDialog,
  initial: AppDefinition,
  isNew: boolean,
): Adw.NavigationPage {
  const idEntry = (
    <Adw.EntryRow title={t.settings.fieldId} text={initial.id} />
  ) as Adw.EntryRow
  const inputEntry = (
    <Adw.EntryRow title={t.settings.fieldInput} text={initial.input} />
  ) as Adw.EntryRow
  const labelEntry = (
    <Adw.EntryRow title={t.settings.fieldLabel} text={initial.label} />
  ) as Adw.EntryRow
  const iconEntry = (
    <Adw.EntryRow title={t.settings.fieldIcon} text={initial.icon} />
  ) as Adw.EntryRow
  const attrEntry = (
    <Adw.EntryRow title={t.settings.fieldAttr} text={initial.attr} />
  ) as Adw.EntryRow
  const storeNamesEntry = (
    <Adw.EntryRow
      title={t.settings.fieldStoreNames}
      text={initial.storeNames.join(", ")}
    />
  ) as Adw.EntryRow

  function save(): void {
    const id = idEntry.text.trim()
    const input = inputEntry.text.trim()
    if (!id) {
      showToast("error", t.settings.idRequired)
      return
    }
    if (!input) {
      showToast("error", t.settings.inputRequired)
      return
    }
    const list = apps.peek()
    const duplicate = list.some((a) => a.id === id && a.id !== initial.id)
    if (duplicate) {
      showToast("error", t.settings.duplicateId(id))
      return
    }

    const updated: AppDefinition = {
      id,
      label: labelEntry.text.trim() || id,
      icon: iconEntry.text.trim(),
      input,
      attr: attrEntry.text.trim() || `packages.${SYSTEM}.default`,
      storeNames: storeNamesEntry.text
        .split(SPLIT_COMMA)
        .map((name: string) => name.trim())
        .filter(Boolean),
    }

    updateApps(
      isNew
        ? [...list, updated]
        : list.map((a) => (a.id === initial.id ? updated : a)),
    )
    showToast("success", t.toasts.appSaved(id))
    dialog.pop_subpage()
  }

  const toolbar = (
    <Adw.ToolbarView>
      <Adw.HeaderBar $type="top" showTitle={false} />
      <Adw.PreferencesPage>
        <Adw.PreferencesGroup>
          {idEntry}
          {inputEntry}
          {labelEntry}
          {iconEntry}
          {attrEntry}
          {storeNamesEntry}
        </Adw.PreferencesGroup>

        <Adw.PreferencesGroup>
          <Gtk.Button
            label={t.settings.save}
            cssClasses={["suggested-action", "pill"]}
            halign={Gtk.Align.CENTER}
            onClicked={save}
          />
          {!isNew && (
            <Gtk.Button
              label={t.settings.removeApp}
              cssClasses={["destructive-action", "flat"]}
              halign={Gtk.Align.CENTER}
              marginTop={8}
              onClicked={() =>
                confirmRemoval(dialog, initial.label || initial.id, () => {
                  updateApps(apps.peek().filter((a) => a.id !== initial.id))
                  showToast("success", t.toasts.appRemoved(initial.id))
                  dialog.pop_subpage()
                })
              }
            />
          )}
        </Adw.PreferencesGroup>
      </Adw.PreferencesPage>
    </Adw.ToolbarView>
  ) as Adw.ToolbarView

  return (
    <Adw.NavigationPage
      title={isNew ? t.settings.newApp : initial.label || initial.id}
      child={toolbar}
    />
  ) as Adw.NavigationPage
}

function CatalogPage(dialogRef: () => Adw.PreferencesDialog): Gtk.Widget {
  return (
    <Adw.PreferencesPage
      title={t.settings.catalogTab}
      iconName="view-grid-symbolic"
    >
      <Adw.PreferencesGroup
        title={t.settings.catalogTitle}
        description={t.settings.catalogDescription}
      >
        <Adw.ActionRow title={t.settings.addApp}>
          <Gtk.Button
            $type="suffix"
            iconName="list-add-symbolic"
            valign={Gtk.Align.CENTER}
            tooltipText={t.settings.addApp}
            onClicked={() =>
              dialogRef().push_subpage(
                buildEditSubpage(dialogRef(), EMPTY_APP, true),
              )
            }
          />
        </Adw.ActionRow>
      </Adw.PreferencesGroup>

      <Adw.PreferencesGroup>
        <For each={apps} id={(a: AppDefinition) => a.id}>
          {(app: AppDefinition) => (
            <Adw.ActionRow title={app.label || app.id} subtitle={app.id}>
              <Gtk.Button
                $type="suffix"
                iconName="document-edit-symbolic"
                valign={Gtk.Align.CENTER}
                tooltipText={t.settings.edit}
                onClicked={() =>
                  dialogRef().push_subpage(
                    buildEditSubpage(dialogRef(), app, false),
                  )
                }
              />
            </Adw.ActionRow>
          )}
        </For>
      </Adw.PreferencesGroup>
    </Adw.PreferencesPage>
  ) as Gtk.Widget
}

function AboutPage(): Gtk.Widget {
  return (
    <Adw.PreferencesPage
      title={t.settings.aboutTab}
      iconName="help-about-symbolic"
    >
      <Adw.PreferencesGroup title={t.settings.aboutTitle}>
        <Gtk.Label
          label={t.settings.aboutText}
          xalign={0}
          yalign={0}
          wrap
          selectable
          marginTop={8}
          marginBottom={8}
          marginStart={4}
          marginEnd={4}
        />
      </Adw.PreferencesGroup>
    </Adw.PreferencesPage>
  ) as Gtk.Widget
}

/**
 * Diferente de `Window()`, este diálogo é construído fora da árvore montada
 * no `main()` — sem um `Scope` próprio, `For`/`onCleanup` (usados no
 * catálogo) quebram com "out of tracking context". `createRoot` dá um
 * `Scope` só dele, descartado quando o diálogo fecha.
 */
/**
 * `openSubpage` é só pra abrir o diálogo já numa subpágina (deep-link via
 * IPC pra testar `push_subpage` sem precisar clicar) — "new" pra criação,
 * ou o `id` de um app existente pra editar direto.
 */
export default function SettingsDialog(openSubpage?: string): Adw.PreferencesDialog {
  return createRoot((dispose) => {
    // CatalogPage precisa de uma referência ao diálogo pra empurrar
    // subpáginas, mas o diálogo só existe depois de montar as páginas —
    // closures resolvem isso lendo a variável só no clique, bem depois de
    // `dialogRef` já ter sido atribuída abaixo.
    let dialogRef: Adw.PreferencesDialog

    const dialog = (
      <Adw.PreferencesDialog title={t.settings.title}>
        {GeneralPage()}
        {CatalogPage(() => dialogRef)}
        {AboutPage()}
      </Adw.PreferencesDialog>
    ) as Adw.PreferencesDialog

    dialogRef = dialog
    dialog.connect("closed", () => dispose())

    if (openSubpage === "new") {
      dialog.push_subpage(buildEditSubpage(dialog, EMPTY_APP, true))
    } else if (openSubpage) {
      const found = apps.peek().find((a) => a.id === openSubpage)
      if (found) dialog.push_subpage(buildEditSubpage(dialog, found, false))
    }

    return dialog
  })
}
