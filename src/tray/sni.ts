import Gio from "gi://Gio"
import GLib from "gi://GLib"

const SNI_IFACE = `
<node>
  <interface name="org.kde.StatusNotifierItem">
    <property name="Category" type="s" access="read"/>
    <property name="Id" type="s" access="read"/>
    <property name="Title" type="s" access="read"/>
    <property name="Status" type="s" access="read"/>
    <property name="IconName" type="s" access="read"/>
    <property name="IconThemePath" type="s" access="read"/>
    <property name="AttentionIconName" type="s" access="read"/>
    <property name="OverlayIconName" type="s" access="read"/>
    <property name="ItemIsMenu" type="b" access="read"/>
    <property name="Menu" type="o" access="read"/>
    <property name="ToolTip" type="(sa(iiay)ss)" access="read"/>
    <method name="Activate">
      <arg name="x" type="i" direction="in"/>
      <arg name="y" type="i" direction="in"/>
    </method>
    <method name="SecondaryActivate">
      <arg name="x" type="i" direction="in"/>
      <arg name="y" type="i" direction="in"/>
    </method>
    <method name="Scroll">
      <arg name="delta" type="i" direction="in"/>
      <arg name="orientation" type="s" direction="in"/>
    </method>
    <signal name="NewIcon"/>
    <signal name="NewStatus"><arg name="status" type="s"/></signal>
    <signal name="NewToolTip"/>
    <signal name="NewTitle"/>
  </interface>
</node>`

const MENU_IFACE = `
<node>
  <interface name="com.canonical.dbusmenu">
    <property name="Version" type="u" access="read"/>
    <property name="TextDirection" type="s" access="read"/>
    <property name="Status" type="s" access="read"/>
    <property name="IconThemePath" type="as" access="read"/>
    <method name="GetLayout">
      <arg name="parentId" type="i" direction="in"/>
      <arg name="recursionDepth" type="i" direction="in"/>
      <arg name="propertyNames" type="as" direction="in"/>
      <arg name="revision" type="u" direction="out"/>
      <arg name="layout" type="(ia{sv}av)" direction="out"/>
    </method>
    <method name="GetGroupProperties">
      <arg name="ids" type="ai" direction="in"/>
      <arg name="propertyNames" type="as" direction="in"/>
      <arg name="properties" type="a(ia{sv})" direction="out"/>
    </method>
    <method name="GetProperty">
      <arg name="id" type="i" direction="in"/>
      <arg name="name" type="s" direction="in"/>
      <arg name="value" type="v" direction="out"/>
    </method>
    <method name="Event">
      <arg name="id" type="i" direction="in"/>
      <arg name="eventId" type="s" direction="in"/>
      <arg name="data" type="v" direction="in"/>
      <arg name="timestamp" type="u" direction="in"/>
    </method>
    <method name="AboutToShow">
      <arg name="id" type="i" direction="in"/>
      <arg name="needUpdate" type="b" direction="out"/>
    </method>
    <signal name="LayoutUpdated">
      <arg name="revision" type="u"/>
      <arg name="parent" type="i"/>
    </signal>
    <signal name="ItemsPropertiesUpdated">
      <arg name="updatedProps" type="a(ia{sv})"/>
      <arg name="removedProps" type="a(ias)"/>
    </signal>
  </interface>
</node>`

// Sinais sem argumentos: o binding exige um GLib.Variant, o gjs aceita null.
const NO_ARGS = null as unknown as GLib.Variant

const WATCHER_NAME = "org.kde.StatusNotifierWatcher"
const WATCHER_PATH = "/StatusNotifierWatcher"

export interface MenuItem {
  label: string
  onActivate?: () => void
  /** Separador: renderizado como linha, sem rótulo nem ação. */
  separator?: boolean
}

export interface TrayItemOptions {
  id: string
  title: string
  iconThemePath: string
  menu: MenuItem[]
  onActivate: () => void
  onSecondaryActivate?: () => void
}

/**
 * StatusNotifierItem próprio.
 *
 * O AstalTray é *host* — consome bandeja, não publica. Publicar exige falar o
 * protocolo direto no barramento, que é o que esta classe faz.
 */
export class TrayItem {
  private connection: Gio.DBusConnection | null = null
  private busNameId = 0
  private watcherWatchId = 0
  private itemExport: Gio.DBusExportedObject | null = null
  private menuExport: Gio.DBusExportedObject | null = null

  private iconName = ""
  private tooltipTitle = ""
  private tooltipBody = ""
  private status = "Active"
  private menuRevision = 1

  constructor(private readonly options: TrayItemOptions) {
    this.tooltipTitle = options.title
  }

  async start(): Promise<void> {
    this.connection = Gio.bus_get_sync(Gio.BusType.SESSION, null)

    this.itemExport = Gio.DBusExportedObject.wrapJSObject(
      SNI_IFACE,
      this.itemHandler(),
    )
    this.itemExport.export(this.connection, "/StatusNotifierItem")

    this.menuExport = Gio.DBusExportedObject.wrapJSObject(
      MENU_IFACE,
      this.menuHandler(),
    )
    this.menuExport.export(this.connection, "/MenuBar")

    const busName = `org.kde.StatusNotifierItem-${new Gio.Credentials().get_unix_pid()}-1`
    this.busNameId = Gio.bus_own_name_on_connection(
      this.connection,
      busName,
      Gio.BusNameOwnerFlags.NONE,
      () => this.register(busName),
      null,
    )

    // O ícone some quando o GNOME Shell reinicia ou a extensão recarrega: o
    // watcher troca de dono e o item precisa se registrar de novo.
    this.watcherWatchId = Gio.bus_watch_name_on_connection(
      this.connection,
      WATCHER_NAME,
      Gio.BusNameWatcherFlags.NONE,
      () => this.register(busName),
      null,
    )
  }

  private register(busName: string): void {
    this.connection?.call(
      WATCHER_NAME,
      WATCHER_PATH,
      WATCHER_NAME,
      "RegisterStatusNotifierItem",
      new GLib.Variant("(s)", [busName]),
      null,
      Gio.DBusCallFlags.NONE,
      -1,
      null,
      (conn, res) => {
        try {
          conn?.call_finish(res)
        } catch (error) {
          // Sem host de bandeja (ex.: extensão desativada): o app segue
          // funcionando, só não aparece ícone.
          console.debug(`StatusNotifierWatcher indisponível: ${error}`)
        }
      },
    )
  }

  setIcon(iconName: string): void {
    if (this.iconName === iconName) return
    this.iconName = iconName
    this.itemExport?.emit_signal("NewIcon", NO_ARGS)
  }

  setTooltip(title: string, body: string): void {
    if (this.tooltipTitle === title && this.tooltipBody === body) return
    this.tooltipTitle = title
    this.tooltipBody = body
    this.itemExport?.emit_signal("NewToolTip", NO_ARGS)
  }

  setStatus(status: "Active" | "Passive" | "NeedsAttention"): void {
    if (this.status === status) return
    this.status = status
    this.itemExport?.emit_signal(
      "NewStatus",
      new GLib.Variant("(s)", [status]),
    )
  }

  stop(): void {
    if (this.busNameId) Gio.bus_unown_name(this.busNameId)
    if (this.watcherWatchId) Gio.bus_unwatch_name(this.watcherWatchId)
    this.itemExport?.unexport()
    this.menuExport?.unexport()
  }

  private itemHandler() {
    const self = this
    return {
      get Category() {
        return "SystemServices"
      },
      get Id() {
        return self.options.id
      },
      get Title() {
        return self.options.title
      },
      get Status() {
        return self.status
      },
      get IconName() {
        return self.iconName
      },
      get IconThemePath() {
        return self.options.iconThemePath
      },
      get AttentionIconName() {
        return self.iconName
      },
      get OverlayIconName() {
        return ""
      },
      get ItemIsMenu() {
        return false
      },
      get Menu() {
        return "/MenuBar"
      },
      get ToolTip() {
        return new GLib.Variant("(sa(iiay)ss)", [
          self.iconName,
          [],
          self.tooltipTitle,
          self.tooltipBody,
        ])
      },
      Activate(_x: number, _y: number) {
        self.options.onActivate()
      },
      SecondaryActivate(_x: number, _y: number) {
        ;(self.options.onSecondaryActivate ?? self.options.onActivate)()
      },
      Scroll(_delta: number, _orientation: string) {},
    }
  }

  /** Itens do menu numerados a partir de 1; 0 é a raiz. */
  private menuProps(index: number): Record<string, GLib.Variant> {
    const item = this.options.menu[index]
    if (item.separator) {
      return { type: GLib.Variant.new_string("separator") }
    }
    return {
      label: GLib.Variant.new_string(item.label),
      enabled: GLib.Variant.new_boolean(true),
      visible: GLib.Variant.new_boolean(true),
    }
  }

  private menuHandler() {
    const self = this
    return {
      get Version() {
        return 3
      },
      get TextDirection() {
        return "ltr"
      },
      get Status() {
        return "normal"
      },
      get IconThemePath() {
        return [self.options.iconThemePath]
      },
      GetLayout(
        _parentId: number,
        _recursionDepth: number,
        _propertyNames: string[],
      ) {
        // Os filhos vão como GLib.Variant porque o tipo é "av"; já a tupla de
        // saída precisa ser crua — o GJS é quem a empacota na assinatura do
        // método, e um Variant pronto aqui faz o marshalling explodir.
        const children = self.options.menu.map(
          (_, index) =>
            new GLib.Variant("(ia{sv}av)", [
              index + 1,
              self.menuProps(index),
              [],
            ]),
        )
        const layout = [
          0,
          { "children-display": GLib.Variant.new_string("submenu") },
          children,
        ]
        return [self.menuRevision, layout]
      },
      GetGroupProperties(ids: number[], _propertyNames: string[]) {
        const wanted =
          ids.length > 0 ? ids : self.options.menu.map((_, i) => i + 1)
        // Com um único argumento de saída o GJS trata o retorno como o
        // próprio valor; envolver num array faria a lista virar a tupla.
        return wanted
          .filter((id) => id >= 1 && id <= self.options.menu.length)
          .map((id) => [id, self.menuProps(id - 1)])
      },
      GetProperty(id: number, name: string) {
        const props = self.menuProps(id - 1)
        // Retorno que já é GLib.Variant vira a tupla de resposta inteira — daí
        // o "(v)" explícito. Um Variant solto aqui trava a chamada do host.
        return new GLib.Variant("(v)", [
          props[name] ?? GLib.Variant.new_string(""),
        ])
      },
      Event(id: number, eventId: string, _data: unknown, _timestamp: number) {
        if (eventId !== "clicked") return
        self.options.menu[id - 1]?.onActivate?.()
      },
      AboutToShow(_id: number) {
        return false
      },
    }
  }
}
