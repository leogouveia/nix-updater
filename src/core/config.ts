import GLib from "gi://GLib"
import { createState } from "ags"
import type { LocalePreference } from "./i18n"
import { readFile, fileExists, run } from "./proc"

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

/** Só vale se a auto-detecção (ver abaixo) não achar nada. */
const DEFAULT_FLAKE_DIR = `${GLib.get_home_dir()}/nix-config`
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
/**
 * Sem detecção nenhuma ainda bem-sucedida, o nome do usuário do sistema é o
 * único palpite genérico que faz sentido — ao contrário de um nome fixo no
 * código, que só serviria numa única máquina.
 */
export const [homeConfiguration, setHomeConfiguration] = createState<string>(
  GLib.get_user_name(),
)
export const [apps, setApps] = createState<AppDefinition[]>(DEFAULT_APPS)
/** Idioma da interface; "system" segue o locale do ambiente. */
export const [localePreference, setLocalePreference] =
  createState<LocalePreference>("system")

/**
 * Avisa quando `homeConfiguration` foi preenchido por palpite, não por
 * detecção certeira — a UI usa isso para pedir revisão em vez de confiar em
 * silêncio num valor que pode estar errado.
 */
export interface HomeConfigNotice {
  /** Nenhuma `homeConfigurations` encontrada: o palpite é o usuário do sistema. */
  kind: "guessed" | "ambiguous"
  /** Todas as opções encontradas, só preenchido quando "ambiguous". */
  candidates: string[]
}
export const [homeConfigNotice, setHomeConfigNotice] =
  createState<HomeConfigNotice | null>(null)

interface ConfigFile {
  flakeDir?: string
  homeConfiguration?: string
  apps?: AppDefinition[]
  locale?: LocalePreference
}

function readConfigFile(): ConfigFile | null {
  if (!fileExists(CONFIG_FILE)) return null
  try {
    return JSON.parse(readFile(CONFIG_FILE)) as ConfigFile
  } catch {
    return null
  }
}

/**
 * Grava só os campos passados, fundidos com o que já está no disco — ao
 * contrário de um `persistConfig()` único, isso permite confirmar um campo
 * (ex.: `flakeDir` detectado) sem gravar outro ainda não confirmado (ex.:
 * `homeConfiguration` só um palpite).
 */
function writeConfigPatch(patch: Partial<ConfigFile>): void {
  GLib.mkdir_with_parents(CONFIG_DIR, 0o755)
  const merged: ConfigFile = { ...(readConfigFile() ?? {}), ...patch }
  GLib.file_set_contents(CONFIG_FILE, JSON.stringify(merged, null, 2))
}

/** Pastas onde um flake de home-manager costuma morar, em ordem de preferência. */
const CANDIDATE_FLAKE_DIRS = [
  "nix-config",
  ".config/home-manager",
  "nixos-config",
  "dotfiles",
]

/** Primeiro candidato padrão com um `flake.nix` — `null` se nenhum existir. */
function findDefaultFlakeDir(): string | null {
  const home = GLib.get_home_dir()
  for (const candidate of CANDIDATE_FLAKE_DIRS) {
    const dir = `${home}/${candidate}`
    if (fileExists(`${dir}/flake.nix`)) return dir
  }
  return null
}

/**
 * Nomes em `homeConfigurations` do flake em `dir` — permite achar a chave
 * certa sem o usuário precisar abrir o `flake.nix` pra copiá-la na mão.
 */
async function detectHomeConfigurationNames(dir: string): Promise<string[]> {
  const result = await run(
    [
      "nix",
      "eval",
      "--json",
      "--no-warn-dirty",
      `${dir}#homeConfigurations`,
      "--apply",
      "builtins.attrNames",
    ],
    { timeoutMs: 60_000 },
  )
  if (!result.ok) return []
  try {
    const names: unknown = JSON.parse(result.stdout)
    return Array.isArray(names)
      ? names.filter((n): n is string => typeof n === "string")
      : []
  } catch {
    return []
  }
}

/**
 * Roda a detecção e já aplica o resultado em `homeConfiguration` — a
 * diferença entre os três casos é só se o valor aplicado conta como
 * confirmado (devolve `null`) ou como palpite (devolve o aviso).
 */
async function applyHomeConfigDetection(
  dir: string,
): Promise<HomeConfigNotice | null> {
  const candidates = await detectHomeConfigurationNames(dir)

  if (candidates.length === 1) {
    setHomeConfiguration(candidates[0])
    return null
  }
  if (candidates.length === 0) {
    setHomeConfiguration(GLib.get_user_name())
    return { kind: "guessed", candidates: [] }
  }
  setHomeConfiguration(candidates[0])
  return { kind: "ambiguous", candidates }
}

/**
 * Re-roda a detecção do `homeConfiguration` contra o `flakeDir` atual — é o
 * que o botão "Detectar automaticamente" das Configurações chama sob
 * demanda, em vez de só na primeira execução.
 */
export async function redetectHomeConfiguration(): Promise<HomeConfigNotice | null> {
  const notice = await applyHomeConfigDetection(flakeDir.peek())
  setHomeConfigNotice(notice)
  if (notice === null) writeConfigPatch({ homeConfiguration: homeConfiguration.peek() })
  return notice
}

/**
 * Chamado uma vez no início de cada entrypoint (app.tsx e cli.ts).
 *
 * Cada campo só é gravado em disco quando pode ser considerado confirmado:
 * veio do `config.json` já existente, ou a detecção automática achou
 * exatamente uma opção. Um palpite (usuário do sistema, ou a primeira de
 * várias opções) fica só na memória, pra ser tentado de novo na próxima
 * execução em vez de travar um valor que pode estar errado.
 */
export async function loadConfig(): Promise<void> {
  const saved = readConfigFile()

  if (saved?.apps) setApps(saved.apps)
  if (saved?.locale) setLocalePreference(saved.locale)

  let detectedFlakeDir: string | null = null
  if (saved?.flakeDir) {
    setFlakeDir(saved.flakeDir)
  } else {
    detectedFlakeDir = findDefaultFlakeDir()
    if (detectedFlakeDir) setFlakeDir(detectedFlakeDir)
  }

  let homeConfigConfirmed = Boolean(saved?.homeConfiguration)
  if (saved?.homeConfiguration) {
    setHomeConfiguration(saved.homeConfiguration)
  } else {
    const notice = await applyHomeConfigDetection(flakeDir.peek())
    setHomeConfigNotice(notice)
    homeConfigConfirmed = notice === null
  }

  const flakeDirConfirmed = Boolean(saved?.flakeDir) || Boolean(detectedFlakeDir)
  if (flakeDirConfirmed || homeConfigConfirmed) {
    writeConfigPatch({
      ...(flakeDirConfirmed ? { flakeDir: flakeDir.peek() } : {}),
      ...(homeConfigConfirmed ? { homeConfiguration: homeConfiguration.peek() } : {}),
    })
  }
}

export function updateFlakeDir(value: string): void {
  setFlakeDir(value)
  writeConfigPatch({ flakeDir: value })
}

export function updateHomeConfiguration(value: string): void {
  setHomeConfiguration(value)
  setHomeConfigNotice(null)
  writeConfigPatch({ homeConfiguration: value })
}

export function updateApps(value: AppDefinition[]): void {
  setApps(value)
  writeConfigPatch({ apps: value })
}

/** Só vale na próxima execução: `t` é resolvido uma vez, na inicialização. */
export function updateLocalePreference(value: LocalePreference): void {
  setLocalePreference(value)
  writeConfigPatch({ locale: value })
}
