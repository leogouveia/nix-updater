import Adw from "gi://Adw?version=1"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import { t } from "../../core/i18n"

const FALLBACK_ICON = "package-x-generic-symbolic"
const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 60

function iconTheme(): Gtk.IconTheme {
  return Gtk.IconTheme.get_for_display(Gdk.Display.get_default()!)
}

/** Todos os ícones do tema atual — uma única chamada, reaproveitada entre buscas. */
let iconNameCache: string[] | null = null
function allIconNames(): string[] {
  if (!iconNameCache) iconNameCache = iconTheme().get_icon_names()
  return iconNameCache
}

function previewNameFor(value: string): string {
  const trimmed = value.trim()
  return trimmed.length > 0 && iconTheme().has_icon(trimmed) ? trimmed : FALLBACK_ICON
}

function removeAllChildren(box: Gtk.Box): void {
  let child = box.get_first_child()
  while (child) {
    const next = child.get_next_sibling()
    box.remove(child)
    child = next
  }
}

/**
 * Popover com busca por substring nos nomes de ícone do tema atual — a
 * lista completa costuma ter milhares de entradas, por isso só renderiza
 * resultado a partir de `MIN_QUERY_LENGTH` caracteres, e no máximo
 * `MAX_RESULTS` por vez.
 */
function openIconPicker(anchor: Gtk.Widget, onPick: (name: string) => void): void {
  const results = (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={2} />
  ) as Gtk.Box

  function render(query: string): void {
    removeAllChildren(results)
    const needle = query.trim().toLowerCase()
    if (needle.length < MIN_QUERY_LENGTH) return

    const matches = allIconNames()
      .filter((name) => name.toLowerCase().includes(needle))
      .slice(0, MAX_RESULTS)

    for (const name of matches) {
      const row = (
        <button cssClasses={["flat"]} halign={Gtk.Align.FILL}>
          <box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
            <Gtk.Image iconName={name} pixelSize={20} />
            <label
              label={name}
              xalign={0}
              hexpand
              ellipsize={Pango.EllipsizeMode.END}
            />
          </box>
        </button>
      ) as Gtk.Button
      row.connect("clicked", () => {
        onPick(name)
        popover.popdown()
      })
      results.append(row)
    }
  }

  const search = (
    <Gtk.SearchEntry placeholderText={t.settings.searchIcons} />
  ) as Gtk.SearchEntry
  search.connect("search-changed", () => render(search.text))

  const popover = (
    <popover>
      <box
        orientation={Gtk.Orientation.VERTICAL}
        spacing={6}
        marginTop={8}
        marginBottom={8}
        marginStart={8}
        marginEnd={8}
        widthRequest={260}
      >
        {search}
        <Gtk.ScrolledWindow maxContentHeight={320} propagateNaturalHeight>
          {results}
        </Gtk.ScrolledWindow>
      </box>
    </popover>
  ) as Gtk.Popover

  popover.set_parent(anchor)
  popover.popup()
  search.grab_focus()
}

/**
 * Campo de ícone do catálogo: prévia ao vivo (cai pro genérico quando o
 * nome digitado não existe no tema atual) + busca por substring pra quem
 * não sabe o nome de antemão.
 */
export default function IconField(initial: string): Adw.EntryRow {
  const preview = (
    <Gtk.Image $type="prefix" iconName={previewNameFor(initial)} pixelSize={24} />
  ) as Gtk.Image

  const row = (
    <Adw.EntryRow title={t.settings.fieldIcon} text={initial}>
      {preview}
      <Gtk.Button
        $type="suffix"
        iconName="system-search-symbolic"
        valign={Gtk.Align.CENTER}
        tooltipText={t.settings.browseIcons}
        onClicked={(self: Gtk.Button) =>
          openIconPicker(self, (name) => {
            row.text = name
          })
        }
      />
    </Adw.EntryRow>
  ) as Adw.EntryRow

  row.connect("changed", () => preview.set_from_icon_name(previewNameFor(row.text)))

  return row
}
