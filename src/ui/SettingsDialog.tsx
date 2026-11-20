import Adw from "gi://Adw?version=1"
import Gtk from "gi://Gtk?version=4.0"
import { For, createComputed, createRoot, createState } from "ags"
import {
  apps,
  checkOnStart,
  updateCheckOnStart,
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
import { discoverDeclaredPackages } from "../discovery/declared"
import { LOCALES, t, type LocalePreference } from "../core/i18n"
import { SYSTEM } from "../core/registry"
import { runCheck } from "../core/operations"
import IconField from "./components/IconField"

/** Referência tardia ao diálogo: as páginas são montadas antes dele existir. */
type DialogRef = () => Adw.PreferencesDialog

type ToastKind = "success" | "warning" | "error"

const TOAST_STYLE: Record<
  ToastKind,
  { icon: string | null; cssClass: string | null; timeout: number }
> = {
  // Sucesso fica sem ícone nem cor: é o caso comum, e destacá-lo roubaria
  // a atenção que os outros dois precisam ter.
  success: { icon: null, cssClass: null, timeout: 3 },
  warning: { icon: "dialog-warning-symbolic", cssClass: "toast-warning", timeout: 6 },
  // Erro costuma ser instrução ("escolha outro id"), e some antes de ser
  // lido no tempo padrão.
  error: { icon: "dialog-error-symbolic", cssClass: "toast-error", timeout: 8 },
}

/**
 * Feedback dentro do diálogo, não na janela principal.
 *
 * O `showToast` de `core/state` alimenta o `ToastOverlay` da janela, que
 * fica *atrás* do diálogo — uma mensagem de erro ali passa despercebida
 * exatamente quando mais importa. `Adw.PreferencesDialog` tem overlay
 * próprio.
 *
 * A cor vai no `custom_title` porque `Adw.Toast` não é um `Gtk.Widget` e
 * não aceita classe CSS; o ícone acompanha para a severidade não depender
 * só de cor (ver `style.scss`).
 */
function dialogToast(
  dialogRef: DialogRef,
  kind: ToastKind,
  message: string,
): void {
  const { icon, cssClass, timeout } = TOAST_STYLE[kind]
  const toast = new Adw.Toast({ timeout })

  if (!cssClass || !icon) {
    toast.title = message
    dialogRef().add_toast(toast)
    return
  }

  // `createRoot` porque isto roda de dentro de um handler de clique, fora
  // da pilha síncrona que o escopo da `SettingsDialog` rastreia — sem um
  // escopo próprio, o JSX abaixo reclama de "out of tracking context".
  createRoot((dispose) => {
    toast.set_custom_title(
      (
        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
          <Gtk.Image iconName={icon} cssClasses={[cssClass]} />
          <label label={message} wrap cssClasses={[cssClass]} xalign={0} />
        </box>
      ) as Gtk.Widget,
    )
    toast.connect("dismissed", () => dispose())
    dialogRef().add_toast(toast)
  })
}

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

function GeneralPage(dialogRef: DialogRef): Gtk.Widget {
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
                dialogToast(
                  dialogRef,
                  "success",
                  t.settings.homeConfigDetected(homeConfiguration.peek()),
                )
              } else if (notice.kind === "guessed") {
                // Não é falha: a detecção rodou, só não achou nada — o
                // valor atual é um palpite que vale revisar.
                dialogToast(dialogRef, "warning", t.settings.homeConfigNotFound)
              } else {
                dialogToast(
                  dialogRef,
                  "warning",
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
        dialogToast(dialogRef, "success", t.settings.languageChanged)
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
        title={t.settings.automationTitle}
        description={t.settings.automationDescription}
      >
        <Adw.SwitchRow
          title={t.settings.checkOnStartEntry}
          subtitle={t.settings.checkOnStartSubtitle}
          active={checkOnStart.peek()}
          onNotifyActive={(self: Adw.SwitchRow) => {
            if (self.active !== checkOnStart.peek()) updateCheckOnStart(self.active)
          }}
        />
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
  const dialogRef: DialogRef = () => dialog
  const idEntry = (
    <Adw.EntryRow title={t.settings.fieldId} text={initial.id} />
  ) as Adw.EntryRow
  const inputEntry = (
    <Adw.EntryRow title={t.settings.fieldInput} text={initial.input} />
  ) as Adw.EntryRow
  const labelEntry = (
    <Adw.EntryRow title={t.settings.fieldLabel} text={initial.label} />
  ) as Adw.EntryRow
  const iconEntry = IconField(initial.icon)
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
      dialogToast(dialogRef, "error", t.settings.idRequired)
      return
    }
    if (!input) {
      dialogToast(dialogRef, "error", t.settings.inputRequired)
      return
    }
    const list = apps.peek()
    // Ao editar, bater com a própria entrada não é duplicata; ao criar,
    // qualquer id igual é — e aqui `initial.id` pode vir preenchido (import
    // com palpite), então compará-lo anularia a checagem.
    const clash = list.find(
      (a) => a.id === id && (isNew || a.id !== initial.id),
    )
    if (clash) {
      // Nada é gravado: o catálogo fica como estava e a subpágina continua
      // aberta com o que foi digitado, pra só trocar o id em vez de
      // preencher tudo de novo. A mensagem nomeia quem já ocupa o id —
      // sem isso, "já existe" não diz onde procurar.
      dialogToast(dialogRef, "error", t.settings.duplicateId(id, clash.input))
      idEntry.grab_focus()
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
    dialogToast(dialogRef, "success", t.toasts.appSaved(id))
    dialog.pop_subpage()
    // Sem isso, a aba Aplicativos (fora das Configurações) continuaria
    // mostrando o resultado da última Verificação, sem refletir o app
    // recém-editado até o usuário clicar em Verificar de novo.
    void runCheck({ silent: true })
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
                  dialogToast(dialogRef, "success", t.toasts.appRemoved(initial.id))
                  dialog.pop_subpage()
                  void runCheck({ silent: true })
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

/** Um app com input próprio achado em `home.packages`, ainda sem catálogo. */
interface ImportCandidate {
  /** Input do flake que fornece o pacote. */
  input: string
  /** Atributo dentro de `packages.${SYSTEM}`, como declarado. */
  attr: string
  /** Arquivo do home-manager onde a referência apareceu. */
  sourceFile: string
}

function candidateKey(c: ImportCandidate): string {
  return `${c.input}:${c.attr}`
}

/**
 * Monta a entrada de catálogo pra um candidato — `attr` vem do que o
 * usuário de fato declarou, não de um palpite, então não há o que corrigir
 * depois.
 */
function draftFrom(c: ImportCandidate): AppDefinition {
  // Quase todo flake de app único expõe `packages.<system>.default`, então
  // o atributo sozinho colidiria entre inputs diferentes — e o `id` é o que
  // identifica a entrada no catálogo. O nome do input distingue, e só
  // quando ele não basta (vários apps no mesmo input) é que o atributo
  // entra.
  const id = c.attr === "default" ? c.input : c.attr
  return {
    id,
    label: id,
    icon: "",
    input: c.input,
    attr: `packages.${SYSTEM}.${c.attr}`,
    storeNames: [],
  }
}

function CatalogPage(dialogRef: () => Adw.PreferencesDialog): Gtk.Widget {
  // Só o que está de fato em `home.packages` (incluindo os módulos
  // importados): cadastrar um pacote que o usuário não declarou criaria uma
  // entrada que nunca casa com nada instalado. A leitura é assíncrona
  // (roda `nix-instantiate --parse`), então a lista começa vazia e se
  // preenche sozinha — `For` reage ao sinal.
  const [declared, setDeclared] = createState<ImportCandidate[]>([])
  void discoverDeclaredPackages()
    .then((found) => {
      setDeclared(
        found
          .filter((d) => d.kind === "input" && d.attr)
          .map((d) => ({ input: d.name, attr: d.attr!, sourceFile: d.sourceFile })),
      )
    })
    .catch(() => {
      // Sem flake válido ainda: a lista fica vazia em vez de quebrar o
      // diálogo inteiro.
    })

  // Some da lista assim que vira entrada do catálogo — a comparação é por
  // input *e* atributo, já que um input pode fornecer vários apps.
  const importable = createComputed([declared, apps], (found, catalog) => {
    const cataloged = new Set(catalog.map((a) => `${a.input} ${a.attr}`))
    return found.filter(
      (c) => !cataloged.has(`${c.input} packages.${SYSTEM}.${c.attr}`),
    )
  })

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

      <Adw.PreferencesGroup
        title={t.settings.uncatalogedTitle}
        description={t.settings.uncatalogedDescription}
      >
        <For each={importable} id={candidateKey}>
          {(c: ImportCandidate) => (
            <Adw.ActionRow
              title={c.attr}
              subtitle={c.input}
              cssClasses={["monospace"]}
            >
              <Gtk.Button
                $type="suffix"
                iconName="list-add-symbolic"
                valign={Gtk.Align.CENTER}
                tooltipText={t.settings.importApp}
                onClicked={() =>
                  dialogRef().push_subpage(
                    buildEditSubpage(dialogRef(), draftFrom(c), true),
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
        {GeneralPage(() => dialogRef)}
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
