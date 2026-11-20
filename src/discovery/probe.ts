import { run } from "../core/proc"
import type { InputSource, LockNodes } from "./flake"

/**
 * Pergunta ao servidor remoto qual é a revisão atual de cada input, sem
 * baixar nada.
 *
 * É o contrário de resolver o input pelo Nix: aqui só se descobre *se* algo
 * mudou e para qual revisão. Saber qual versão de pacote isso traria ainda
 * exige avaliação, e portanto download — mas só dos inputs que de fato
 * mudaram.
 */

export type ProbeStatus =
  /** A revisão remota difere da travada. */
  | "update"
  /** Já está na revisão remota. */
  | "unchanged"
  /** Sem revisão, ou tipo de fonte que não dá para sondar barato. */
  | "pinned"
  /** A consulta falhou; nunca confundir com "mudou". */
  | "unreachable"

export interface ProbeResult {
  status: ProbeStatus
  remoteRev: string | null
  /** Data do commit remoto, quando a fonte a fornece. */
  remoteLastModified: number | null
  reason: string | null
}

export type ProbeResults = Record<string, ProbeResult>

const MAX_PARALLEL = 8
const TIMEOUT_MS = 20_000
const SHA1 = /^[0-9a-f]{40}$/i

/** Forjas cujo endereço git dá para montar a partir de owner/repo. */
function remoteUrlFor(source: InputSource): string | null {
  const { type, owner, repo, url } = source
  switch (type) {
    case "github":
      return owner && repo ? `https://github.com/${owner}/${repo}.git` : null
    case "gitlab":
      return owner && repo ? `https://gitlab.com/${owner}/${repo}.git` : null
    case "sourcehut":
      return owner && repo ? `https://git.sr.ht/${owner}/${repo}` : null
    case "git":
      // "git+https://…" é como o lock registra; o git não entende o prefixo.
      return url ? url.replace(/^git\+/, "") : null
    default:
      // tarball, path, indirect, … não têm revisão git para comparar.
      return null
  }
}

/** Refs a pedir ao remoto: a pedida pelo usuário, ou o ramo padrão. */
function refsFor(ref: string | null): string[] {
  return ref ? [`refs/heads/${ref}`, `refs/tags/${ref}`, ref] : ["HEAD"]
}

async function probeViaGitHubApi(
  source: InputSource,
): Promise<{ rev: string; lastModified: number | null } | null> {
  const { owner, repo, ref } = source
  if (!owner || !repo) return null

  // Uma chamada devolve sha e data. per_page=1 evita a lista de arquivos que
  // a consulta de um commit específico traria.
  const query = ref ? `?per_page=1&sha=${encodeURIComponent(ref)}` : "?per_page=1"
  const result = await run(
    [
      "curl",
      "--fail",
      "--silent",
      "--location",
      "--connect-timeout",
      "5",
      "--max-time",
      "15",
      "-H",
      "Accept: application/vnd.github+json",
      `https://api.github.com/repos/${owner}/${repo}/commits${query}`,
    ],
    { timeoutMs: TIMEOUT_MS },
  )
  if (!result.ok) return null

  try {
    const commits = JSON.parse(result.stdout)
    const rev = commits?.[0]?.sha
    if (typeof rev !== "string" || !SHA1.test(rev)) return null
    const date = commits?.[0]?.commit?.committer?.date
    const seconds =
      typeof date === "string" ? Math.floor(Date.parse(date) / 1000) : NaN
    return { rev, lastModified: Number.isFinite(seconds) ? seconds : null }
  } catch {
    return null
  }
}

async function probeViaLsRemote(
  remoteUrl: string,
  ref: string | null,
): Promise<{ rev: string } | { failure: string }> {
  const result = await run(
    [
      "git",
      "-c",
      "protocol.version=2",
      "ls-remote",
      "--quiet",
      remoteUrl,
      ...refsFor(ref),
    ],
    { timeoutMs: TIMEOUT_MS },
  )

  if (result.ok) {
    const rev = result.stdout.split("\n")[0]?.split(/\s+/)[0] ?? ""
    if (SHA1.test(rev)) return { rev }
    return { failure: "o ramo ou tag pedido não existe no remoto" }
  }

  const stderr = result.stderr
  if (/Could not resolve host|Could not resolve hostname/.test(stderr)) {
    return { failure: "falha de DNS" }
  }
  if (/tempo esgotado/.test(stderr)) {
    return { failure: `o remoto não respondeu em ${TIMEOUT_MS / 1000}s` }
  }
  return { failure: `git ls-remote falhou (status ${result.status})` }
}

async function probeOne(
  rev: string | null,
  source: InputSource | null,
): Promise<ProbeResult> {
  const miss = (reason: string): ProbeResult => ({
    status: "pinned",
    remoteRev: null,
    remoteLastModified: null,
    reason,
  })

  if (!source) return miss("input sem origem no flake.lock")
  if (!rev) return miss(`${source.type} sem revisão travada`)

  const remoteUrl = remoteUrlFor(source)
  if (!remoteUrl) return miss(`tipo "${source.type}" não é sondável`)

  // A API do GitHub responde em uma requisição e traz a data, mas é limitada
  // a 60 chamadas/hora sem autenticação; o ls-remote não tem limite e cobre
  // repositório privado e as demais forjas.
  let remoteRev: string | null = null
  let remoteLastModified: number | null = null
  let failure: string | null = null

  if (source.type === "github") {
    const api = await probeViaGitHubApi(source)
    if (api) {
      remoteRev = api.rev
      remoteLastModified = api.lastModified
    }
  }

  if (!remoteRev) {
    const git = await probeViaLsRemote(remoteUrl, source.ref)
    if ("rev" in git) remoteRev = git.rev
    else failure = git.failure
  }

  if (!remoteRev) {
    return {
      status: "unreachable",
      remoteRev: null,
      remoteLastModified: null,
      reason: failure,
    }
  }

  return {
    status: remoteRev === rev ? "unchanged" : "update",
    remoteRev,
    remoteLastModified,
    reason: null,
  }
}

/** Roda as tarefas com um teto de simultaneidade. */
async function withLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length)
  let next = 0

  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const index = next++
      results[index] = await tasks[index]()
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker),
  )
  return results
}

export async function probeInputs(nodes: LockNodes): Promise<ProbeResults> {
  const names = Object.keys(nodes)
  const settled = await withLimit(
    names.map((name) => () => probeOne(nodes[name].rev, nodes[name].source)),
    MAX_PARALLEL,
  )

  const results: ProbeResults = {}
  names.forEach((name, index) => {
    results[name] = settled[index]
  })
  return results
}
