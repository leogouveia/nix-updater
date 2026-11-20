import Gtk from "gi://Gtk?version=4.0"
import { t } from "../../core/i18n"

/**
 * Botão "?" pro cabeçalho de um `Adw.PreferencesGroup` — complementa a
 * `description` curta de cada grupo com uma explicação mais longa, só
 * visível quando pedida.
 */
export default function HelpButton(text: string): Gtk.Widget {
  const popover = (
    <popover>
      <box
        orientation={Gtk.Orientation.VERTICAL}
        marginTop={10}
        marginBottom={10}
        marginStart={10}
        marginEnd={10}
      >
        <label label={text} wrap maxWidthChars={42} xalign={0} />
      </box>
    </popover>
  ) as Gtk.Popover

  return (
    <menubutton
      iconName="dialog-question-symbolic"
      tooltipText={t.app.help}
      cssClasses={["flat", "circular"]}
      valign={Gtk.Align.CENTER}
      popover={popover}
    />
  ) as Gtk.Widget
}
