import Gtk from "gi://Gtk?version=4.0"
import { createComputed, type Accessor } from "ags"
import { t } from "../../core/i18n"
import { applied, busy, prepared } from "../../core/state"

export interface ActionFooterProps {
  visible: Accessor<boolean>
  statusText: Accessor<string>
  prepareTooltip: string
  prepareEnabled: Accessor<boolean>
  onPrepare: () => void
  onApply: () => void
}

/**
 * Rodapé de Preparar/Aplicar. Há dois na janela — o granular (Aplicativos e
 * Inputs, que usa a seleção) e o geral (Pacotes, que ignora a seleção) —
 * diferindo só no texto de estado e em quando o Preparar fica disponível.
 *
 * O Aplicar é idêntico nos dois: ativa o que o último Preparar construiu,
 * tenha vindo de qual rodapé for.
 */
export default function ActionFooter({
  visible,
  statusText,
  prepareTooltip,
  prepareEnabled,
  onPrepare,
  onApply,
}: ActionFooterProps): Gtk.Widget {
  return (
    <Gtk.Box spacing={12} hexpand visible={visible}>
      <Gtk.Label
        label={statusText}
        cssClasses={["dim-label"]}
        hexpand
        xalign={0}
      />
      <Gtk.Button
        label={t.actions.prepare}
        tooltipText={prepareTooltip}
        sensitive={createComputed(
          [busy, prepareEnabled],
          (isBusy, enabled) => !isBusy && enabled,
        )}
        onClicked={onPrepare}
      />
      <Gtk.Button
        label={t.actions.apply}
        cssClasses={["suggested-action"]}
        sensitive={createComputed(
          [busy, prepared, applied],
          (isBusy, built, wasApplied) => !isBusy && built !== null && !wasApplied,
        )}
        onClicked={onApply}
      />
    </Gtk.Box>
  ) as Gtk.Widget
}
