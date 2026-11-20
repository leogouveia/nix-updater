import Adw from "gi://Adw?version=1"
import { t } from "../../core/i18n"
import { APP_ID, SYSTEM, VERSION } from "../../core/registry"

export default function AboutDialog(): Adw.AboutDialog {
  return new Adw.AboutDialog({
    applicationName: t.app.name,
    // Mesmo nome do arquivo instalado em hicolor/scalable/apps (default.nix):
    // é o ícone colorido do app, não os symbolic da bandeja.
    applicationIcon: APP_ID,
    developerName: "Leonardo Gouveia",
    version: VERSION,
    comments: t.about.comments(SYSTEM),
  })
}
