import Gtk from "gi://Gtk?version=4.0"
import { createComputed, type Accessor } from "ags"
import { t } from "../../core/i18n"
import type { UpdateState } from "../../core/types"

// Função, e não constante de módulo: `t` só tem o idioma certo depois de
// `initI18n`, que roda bem depois deste módulo ser importado.
function labelFor(state: UpdateState): string {
  switch (state) {
    case "update-available":
      return t.status.updateAvailable
    case "pending-apply":
      return t.status.pendingApply
    case "up-to-date":
      return t.status.upToDate
    case "error":
      return t.status.error
    default:
      return t.status.unknown
  }
}

const CSS_CLASSES: Record<UpdateState, string[]> = {
  "update-available": ["accent", "caption-heading"],
  "pending-apply": ["warning", "caption-heading"],
  "up-to-date": ["dim-label", "caption"],
  unknown: ["dim-label", "caption"],
  error: ["error", "caption-heading"],
}

/** Etiqueta de estado no sufixo de uma linha (apps e pacotes declarados). */
export default function StatusBadge(state: Accessor<UpdateState>): Gtk.Widget {
  return (
    <Gtk.Label
      $type="suffix"
      valign={Gtk.Align.CENTER}
      cssClasses={createComputed([state], (s) => CSS_CLASSES[s])}
      label={createComputed([state], labelFor)}
    />
  ) as Gtk.Widget
}
