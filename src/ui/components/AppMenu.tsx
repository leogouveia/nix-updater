import Adw from "gi://Adw?version=1"
import Gtk from "gi://Gtk?version=4.0"
import { t } from "../../core/i18n"
import SettingsDialog from "../SettingsDialog"
import AboutDialog from "./AboutDialog"

/**
 * Menu da barra de título. Cada item fecha o popover antes de abrir o
 * diálogo: um `Adw.Dialog` apresentado com o popover ainda aberto fica atrás
 * dele.
 */
export function AppMenu(): Gtk.Widget {
  const popover = (
    <popover>
      <box
        orientation={Gtk.Orientation.VERTICAL}
        spacing={2}
        marginTop={6}
        marginBottom={6}
        marginStart={6}
        marginEnd={6}
      >
        <button
          label={t.app.settings}
          cssClasses={["flat"]}
          halign={Gtk.Align.FILL}
          onClicked={(self: Gtk.Button) => openDialog(self, SettingsDialog())}
        />
        <button
          label={t.app.about}
          cssClasses={["flat"]}
          halign={Gtk.Align.FILL}
          onClicked={(self: Gtk.Button) => openDialog(self, AboutDialog())}
        />
      </box>
    </popover>
  ) as Gtk.Popover

  function openDialog(button: Gtk.Button, dialog: Adw.Dialog): void {
    const root = button.get_root()
    if (!(root instanceof Gtk.Window)) {
      console.error("AppMenu: janela principal não encontrada")
      return
    }

    popover.popdown()
    dialog.present(root)
  }

  return (
    <menubutton iconName="view-more-symbolic" tooltipText={t.app.menu} popover={popover} />
  ) as Gtk.Widget
}
