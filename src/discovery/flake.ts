import GLib from "gi://GLib"
import { run, readFile } from "../core/proc"
import {
  flakeDir as flakeDirState,
  homeConfiguration,
} from "../core/config"

const SAFE_ATTR_PATH = /^[A-Za-z_][\w'-]*(\.[A-Za-z_][\w'-]*)*$/

/**
 * De onde o input vem, como declarado no flake (campo `original` do lock).
 * É o que permite perguntar a revisão atual ao servidor remoto sem baixar o
 * input — ao contrário de `locked`, que só diz onde ele está travado.
 */
export interface InputSource {
  /** "github", "gitlab", "sourcehut", "git", "tarball", "path", … */
  type: string
  owner: string | null
  repo: string | null
  url: string | null
  /** Branch ou tag pedida; nulo significa o ramo padrão do repositório. */
  ref: string | null
}

export interface LockNode {
  rev: string | null
  lastModified: number | null
  source: InputSource | null
}

export type LockNodes = Record<string, LockNode>

interface RawLock {
  root?: string
  nodes?: Record<
    string,
    {
      inputs?: Record<string, unknown>
      locked?: Record<string, unknown>
      original?: Record<string, unknown>
    }
  >
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

/**
 * Resolve a referência que um nó usa para apontar outro.
 *
 * Pode ser a chave do nó ("nixpkgs_2") ou, quando o input é um `follows`, um
 * caminho de nomes a seguir a partir da raiz (["home-manager", "nixpkgs"]) —
 * e cada passo desse caminho pode, por sua vez, ser outro `follows`.
 */
function resolveRef(lock: RawLock, ref: unknown): string | null {
  if (typeof ref === "string") return ref
  if (!Array.isArray(ref)) return null

  let current = lock.root ?? "root"
  for (const step of ref) {
    const next = lock.nodes?.[current]?.inputs?.[String(step)]
    const resolved = resolveRef(lock, next)
    if (resolved === null) return null
    current = resolved
  }
  return current
}

function sourceOf(original: Record<string, unknown> | undefined): InputSource | null {
  const type = str(original?.type)
  if (!type) return null
  return {
    type,
    owner: str(original?.owner),
    repo: str(original?.repo),
    url: str(original?.url),
    ref: str(original?.ref),
  }
}

/**
 * Inputs declarados no flake, resolvidos a partir do nó raiz do lock.
 *
 * Só o nível raiz, de propósito: `nix flake update <nome>` só aceita nomes
 * desse nível. Mostrar inputs transitivos listaria coisas sobre as quais a
 * aplicação não tem como agir.
 */
export function readLock(dir = flakeDirState.peek()): LockNodes {
  const lock = JSON.parse(readFile(`${dir}/flake.lock`)) as RawLock
  const rootInputs = lock.nodes?.[lock.root ?? "root"]?.inputs ?? {}
  const nodes: LockNodes = {}

  for (const [name, ref] of Object.entries(rootInputs)) {
    const nodeKey = resolveRef(lock, ref)
    const node = nodeKey === null ? undefined : lock.nodes?.[nodeKey]
    nodes[name] = {
      rev: str(node?.locked?.rev),
      lastModified:
        typeof node?.locked?.lastModified === "number"
          ? node.locked.lastModified
          : null,
      source: sourceOf(node?.original),
    }
  }
  return nodes
}

export function shortRev(rev: string | null): string | null {
  return rev ? rev.slice(0, 12) : null
}

export function formatDate(lastModified: number | null): string | null {
  if (!lastModified) return null
  return (
    GLib.DateTime.new_from_unix_local(lastModified).format("%Y-%m-%d") ?? null
  )
}

/**
 * Avalia `<flake>.inputs.<input>.<attr>.version`.
 *
 * `input` e `attr` são constantes de `src/core/registry.ts`; é isso que torna a
 * interpolação na expressão Nix segura.
 */
export async function evalVersion(
  flakeDir: string,
  input: string,
  attr: string,
): Promise<string | null> {
  const expr = `(builtins.getFlake "${flakeDir}").inputs."${input}".${attr}.version`
  const result = await run([
    "nix",
    "eval",
    "--impure",
    "--raw",
    "--no-warn-dirty",
    "--expr",
    expr,
  ])
  if (!result.ok) return null
  const version = result.stdout.trim()
  return version.length > 0 ? version : null
}

/** Um input a ser avaliado noutra revisão, via `--override-input`. */
export interface InputOverride {
  input: string
  flakeRef: string
}

const SAFE_REV = /^[0-9a-f]{7,40}$/i

/**
 * Referência de flake para a origem numa revisão específica — o que permite
 * avaliar o input *como ele seria* depois da atualização, sem mexer no
 * `flake.lock` nem copiar o flake para lugar nenhum.
 */
export function flakeRefAt(
  source: InputSource | null,
  rev: string | null,
): string | null {
  if (!source || !rev || !SAFE_REV.test(rev)) return null
  const { type, owner, repo, url } = source
  switch (type) {
    case "github":
    case "gitlab":
    case "sourcehut":
      return owner && repo ? `${type}:${owner}/${repo}/${rev}` : null
    case "git":
      // Aqui o prefixo "git+" é mantido: é o que o Nix espera numa
      // referência de flake (ao contrário do endereço passado ao git).
      return url ? `${url.split("?")[0]}?rev=${rev}` : null
    default:
      return null
  }
}

/** Avalia `<flakeRef>#<attr>.version` — o input sozinho, numa revisão dada. */
export async function evalVersionAtRef(
  flakeRef: string,
  attr: string,
): Promise<string | null> {
  if (!SAFE_ATTR_PATH.test(attr)) return null
  const result = await run(
    ["nix", "eval", "--raw", "--no-warn-dirty", `${flakeRef}#${attr}.version`],
    { timeoutMs: 120_000 },
  )
  if (!result.ok) return null
  const version = result.stdout.trim()
  return version.length > 0 ? version : null
}

/**
 * Como `evalVersion`, mas para vários pacotes numa chamada só — evita um
 * `nix eval` por pacote declarado em `home.packages`.
 *
 * O conjunto de pacotes vem de `homeConfigurations.<nome>.pkgs`, e não de um
 * input chamado "nixpkgs": é literalmente o `pkgs` que o `with pkgs; [ … ]`
 * do usuário enxerga, qualquer que seja o nome do input que o forneça, e já
 * com os overlays dele aplicados.
 *
 * `attrPaths` já vem validado por quem os descobre
 * (`src/discovery/declared.ts`); `SAFE_ATTR_PATH` é uma segunda trava antes
 * da interpolação na expressão Nix.
 */
export async function evalVersions(
  flakeDir: string,
  attrPaths: string[],
  options: { overrides?: InputOverride[]; homeConfig?: string } = {},
): Promise<Record<string, string | null>> {
  const homeConfig = options.homeConfig ?? homeConfiguration.peek()
  const safe = attrPaths.filter((p) => SAFE_ATTR_PATH.test(p))
  if (safe.length === 0) return {}
  if (!SAFE_ATTR_PATH.test(homeConfig)) return {}

  const entries = safe
    .map((p) => `"${p}" = (builtins.tryEval (pkgs.${p}.version or null)).value or null;`)
    .join(" ")

  // `--apply` em vez de `--expr`: só a forma com referência de flake aceita
  // `--override-input`, que é como se avalia o `pkgs` que a atualização
  // traria sem escrever no flake.lock.
  const overrideArgs = (options.overrides ?? []).flatMap((o) => [
    "--override-input",
    o.input,
    o.flakeRef,
  ])

  const result = await run(
    [
      "nix",
      "eval",
      "--json",
      "--no-warn-dirty",
      "--no-write-lock-file",
      `${flakeDir}#homeConfigurations.${homeConfig}.pkgs`,
      "--apply",
      `pkgs: { ${entries} }`,
      ...overrideArgs,
    ],
    { timeoutMs: 180_000 },
  )
  if (!result.ok) return {}
  try {
    return JSON.parse(result.stdout)
  } catch {
    return {}
  }
}
