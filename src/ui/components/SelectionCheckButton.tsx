import Gtk from "gi://Gtk?version=4.0"
import { createComputed, type Accessor } from "ags"
import { selection, toggleSelection } from "../../core/state"

export interface SelectionCheckButtonProps {
  /** Nome do input do flake — é a chave da seleção, não o id do app. */
  input: string
  /** Quando falso, o item não tem nada a atualizar e não pode ser marcado. */
  enabled: Accessor<boolean>
}

/**
 * Caixa de seleção ligada à `selection` global. Aplicativos e Inputs são
 * duas visões da mesma lista de inputs selecionados — marcar numa aba
 * reflete na outra.
 */
export default function SelectionCheckButton({
  input,
  enabled,
}: SelectionCheckButtonProps): Gtk.Widget {
  return (
    <Gtk.CheckButton
      $type="prefix"
      valign={Gtk.Align.CENTER}
      sensitive={enabled}
      active={createComputed([selection], (s) => s.includes(input))}
      // `onNotifyActive` dispara também quando o próprio binding muda o
      // estado: sem comparar antes, a seleção se desfaria sozinha.
      onNotifyActive={(self: Gtk.CheckButton) => {
        if (self.active !== selection.get().includes(input)) {
          toggleSelection(input)
        }
      }}
    />
  ) as Gtk.Widget
}
