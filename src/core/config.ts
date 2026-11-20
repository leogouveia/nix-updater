import GLib from "gi://GLib"
import { createState } from "ags"
import type { LocalePreference } from "./i18n"
import { readFile, fileExists } from "./proc"

/**
 * Catálogo dos apps com atualização individual.
 *
 * Diferente da versão anterior (constante em `registry.ts`), isso agora é
 * editável pelo usuário no diálogo de Configurações — por isso mora aqui,
 * junto com o resto do que é configuração em vez de fato fixo do projeto.
 */
export interface AppDefinition {
  id: string
  label: string
  /** Nome de ícone do tema (com fallback na UI). */
  icon: string
  /** Input do flake que governa a versão. */
  input: string
  /** Caminho dentro do input, ex.: "legacyPackages.x86_64-linux.vscode". */
  attr: string
  /** Nomes de derivação possíveis na closure do perfil do home-manager. */
  storeNames: string[]
}

const CONFIG_DIR = `${GLib.get_user_config_dir()}/nix-updater`
const CONFIG_FILE = `${CONFIG_DIR}/config.json`

/** Valor de hoje, hardcoded — vira só o default de quem ainda não configurou. */
const DEFAULT_FLAKE_DIR = `${GLib.get_home_dir()}/nix-config`
/** Idem: era hardcoded em `src/update/index.ts`. */
const DEFAULT_HOME_CONFIGURATION = "leogouveia"
/** Catálogo pessoal de hoje — preserva o comportamento atual até ser editado. */
const DEFAULT_APPS: AppDefinition[] = [
  {
    id: "vscode",
    label: "Visual Studio Code",
    icon: "vscode",
    input: "vscode-pkgs",
    attr: "legacyPackages.x86_64-linux.vscode",
    storeNames: ["vscode"],
  },
  {
    id: "vscodium",
    label: "VSCodium",
    icon: "vscodium",
    input: "vscodium-pkgs",
    attr: "legacyPackages.x86_64-linux.vscodium",
    storeNames: ["vscodium"],
  },
  {
    id: "zed-editor",
    label: "Zed",
    icon: "dev.zed.Zed",
    input: "zed-pkgs",
    attr: "legacyPackages.x86_64-linux.zed-editor",
    storeNames: ["zed-editor", "zed-editor-wrapped"],
  },
  {
    id: "zen-browser",
    label: "Zen Browser",
    icon: "zen-browser",
    input: "zen-browser",
    attr: "packages.x86_64-linux.default",
    storeNames: ["zen-beta", "zen-browser", "zen"],
  },
]

export const [flakeDir, setFlakeDir] = createState<string>(DEFAULT_FLAKE_DIR)
export const [homeConfiguration, setHomeConfiguration] = createState<string>(
  DEFAULT_HOME_CONFIGURATION,
)
export const [apps, setApps] = createState<AppDefinition[]>(DEFAULT_APPS)
/** Idioma da interface; "system" segue o locale do ambiente. */
export const [localePreference, setLocalePreference] =
  createState<LocalePreference>("system")

interface ConfigFile {
  flakeDir?: string
  homeConfiguration?: string
  apps?: AppDefinition[]
  locale?: LocalePreference
}

export function persistConfig(): void {
  GLib.mkdir_with_parents(CONFIG_DIR, 0o755)
  const payload: Required<ConfigFile> = {
    flakeDir: flakeDir.get(),
    homeConfiguration: homeConfiguration.get(),
    apps: apps.get(),
    locale: localePreference.get(),
  }
  GLib.file_set_contents(CONFIG_FILE, JSON.stringify(payload, null, 2))
}

/** Chamado uma vez no início de cada entrypoint (app.tsx e cli.ts). */
export function loadConfig(): void {
  if (!fileExists(CONFIG_FILE)) return
  try {
    const parsed = JSON.parse(readFile(CONFIG_FILE)) as ConfigFile
    if (parsed.flakeDir) setFlakeDir(parsed.flakeDir)
    if (parsed.homeConfiguration) setHomeConfiguration(parsed.homeConfiguration)
    if (parsed.apps) setApps(parsed.apps)
    if (parsed.locale) setLocalePreference(parsed.locale)
  } catch {
    // config.json corrompido: segue com os defaults em vez de quebrar o app.
  }
}

export function updateFlakeDir(value: string): void {
  setFlakeDir(value)
  persistConfig()
}

export function updateHomeConfiguration(value: string): void {
  setHomeConfiguration(value)
  persistConfig()
}

export function updateApps(value: AppDefinition[]): void {
  setApps(value)
  persistConfig()
}

/** Só vale na próxima execução: `t` é resolvido uma vez, na inicialização. */
export function updateLocalePreference(value: LocalePreference): void {
  setLocalePreference(value)
  persistConfig()
}
