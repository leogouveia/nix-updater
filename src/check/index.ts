import { apps as appCatalog, flakeDir, type AppDefinition } from "../core/config"
import type {
  AppStatus,
  CheckResult,
  DeclaredPackageStatus,
  InputStatus,
  StorePackage,
  UpdateState,
} from "../core/types"
import { listInstalled } from "../discovery/installed"
import { discoverDeclaredPackages, type DeclaredPackage } from "../discovery/declared"
import {
  evalVersion,
  evalVersionAtRef,
  evalVersions,
  flakeRefAt,
  formatDate,
  readLock,
  shortRev,
  type InputOverride,
  type LockNodes,
} from "../discovery/flake"
import { probeInputs, type ProbeResults } from "../discovery/probe"

function findInstalled(
  app: AppDefinition,
  installed: StorePackage[],
): StorePackage | undefined {
  return installed.find((p) => app.storeNames.includes(p.name))
}

function stateOf(
  installed: string | null,
  candidate: string | null,
): UpdateState {
  if (!installed || !candidate) return "unknown"
  return installed === candidate ? "up-to-date" : "update-available"
}

/**
 * Versão que o app teria se o input fosse para a revisão sondada.
 *
 * Avalia o flake do próprio input naquela revisão — não precisa do flake do
 * usuário, nem de cópia temporária, nem de escrever no lock. Quando o input
 * não mudou (ou não é sondável), não há o que avaliar.
 */
async function candidateVersionFor(
  current: LockNodes,
  probes: ProbeResults,
  inputName: string,
  attr: string,
  fallback: string | null,
): Promise<string | null> {
  const probe = probes[inputName]
  if (!probe || probe.status !== "update") return fallback

  const ref = flakeRefAt(current[inputName]?.source ?? null, probe.remoteRev)
  if (!ref) return fallback

  return (await evalVersionAtRef(ref, attr)) ?? fallback
}

async function appStatus(
  app: AppDefinition,
  installed: StorePackage[],
  current: LockNodes,
  probes: ProbeResults,
): Promise<AppStatus> {
  // Versão em uso: a closure do perfil é a verdade. Um pacote que não entra
  // no ambiente combinado não aparece na closure, e aí vale o lock atual.
  const fromProfile = findInstalled(app, installed)
  const lockVersion = await evalVersion(flakeDir.peek(), app.input, app.attr)
  const installedVersion = fromProfile?.version || lockVersion

  const candidateVersion = await candidateVersionFor(
    current,
    probes,
    app.input,
    app.attr,
    lockVersion,
  )

  // O perfil ativo pode divergir do flake.lock sem que nenhum input tenha
  // mudado — por exemplo depois de um rollback de geração, que reverte só o
  // perfil e deixa o lock como estava. Isso não é "atualização disponível"
  // (o lock não vai mudar sozinho); é o perfil atrasado em relação ao que já
  // está travado, então merece um estado próprio em vez de "em dia".
  const state: UpdateState =
    fromProfile && lockVersion && fromProfile.version !== lockVersion
      ? "pending-apply"
      : stateOf(installedVersion, candidateVersion)

  return {
    id: app.id,
    label: app.label,
    icon: app.icon,
    tier: "app",
    input: app.input,
    installed: installedVersion,
    candidate: candidateVersion,
    state,
  }
}

/**
 * Versões dos pacotes sem input próprio achados em `home.packages` (ver
 * `src/discovery/declared.ts`), avaliadas numa chamada em lote. Pacotes com
 * input próprio (`kind: "input"`) não entram aqui — a aba Aplicativos só
 * mostra o catálogo cadastrado manualmente em Configurações; um input
 * referenciado em `home.packages` mas não catalogado não ganha tracking de
 * versão próprio, só aparece em "Outros pacotes" como qualquer instalado
 * sem atributo reconhecido.
 *
 * `sharedChanged` diz se vale reavaliar: qualquer input *sem app dono* que
 * tenha mudado pode mover esses pacotes. É deliberadamente conservador — não
 * assume que o input se chama "nixpkgs", e errar para mais só custa uma
 * avaliação a toa, enquanto errar para menos mostraria versão velha.
 */
async function declaredPackageStatuses(
  declared: DeclaredPackage[],
  overrides: InputOverride[],
): Promise<DeclaredPackageStatus[]> {
  const nixpkgsOnly = declared.filter((d) => d.kind === "nixpkgs")
  const sourceOf = new Map(nixpkgsOnly.map((d) => [d.name, d.sourceFile]))
  const attrs = [...new Set(nixpkgsOnly.map((d) => d.name))]
  const hasOverrides = overrides.length > 0

  const [installedVersions, candidateVersions] = await Promise.all([
    evalVersions(flakeDir.peek(), attrs),
    hasOverrides
      ? evalVersions(flakeDir.peek(), attrs, { overrides })
      : Promise.resolve<Record<string, string | null>>({}),
  ])

  return attrs.map((attr) => {
    const installed = installedVersions[attr] ?? null
    const candidate = hasOverrides ? candidateVersions[attr] ?? null : installed
    return {
      attr,
      installed,
      candidate,
      state: stateOf(installed, candidate),
      sourceFile: sourceOf.get(attr) ?? "",
    }
  })
}

function inputStatuses(
  current: LockNodes,
  probes: ProbeResults,
  appByInput: Map<string, string>,
): InputStatus[] {
  return Object.keys(current)
    .sort()
    .map((name) => {
      const node = current[name]
      const probe = probes[name]
      // Só "update" move a revisão candidata. "unreachable" e "pinned"
      // deixam tudo como está: não saber não é o mesmo que estar em dia,
      // mas é melhor que inventar uma atualização que pode não existir.
      const changed = probe?.status === "update"
      return {
        name,
        currentRev: shortRev(node.rev),
        candidateRev: shortRev(changed ? probe.remoteRev : node.rev),
        currentDate: formatDate(node.lastModified),
        candidateDate: formatDate(
          changed ? (probe.remoteLastModified ?? node.lastModified) : node.lastModified,
        ),
        changed,
        apps: appByInput.get(name) ? [appByInput.get(name)!] : [],
      }
    })
}

/**
 * Checagem somente-leitura: nada no diretório do flake (`flakeDir`, ver
 * `src/core/config.ts`) é alterado — nem o `flake.lock`, nem por meio de
 * cópia temporária.
 *
 * Descobrir *o que* mudou é só uma consulta por input ao servidor remoto
 * (ver `src/discovery/probe.ts`), sem download. Só os inputs que de fato
 * mudaram são avaliados para saber qual versão trariam, e essa avaliação
 * acontece sobre o flake do próprio input, ou via `--override-input`.
 */
export async function check(): Promise<CheckResult> {
  const [installed, declared] = await Promise.all([
    listInstalled(),
    discoverDeclaredPackages(),
  ])

  const current = readLock()
  const probes = await probeInputs(current)
  const catalog = appCatalog.peek()

  const apps = await Promise.all(
    catalog.map((app) => appStatus(app, installed, current, probes)),
  )

  const appByInput = new Map(apps.map((a) => [a.input, a.id]))
  const inputs = inputStatuses(current, probes, appByInput)

  // Inputs sem app dono: são os que governam os pacotes declarados e os
  // "outros pacotes", e qualquer um deles que mude pode mover as versões.
  const changedShared = inputs.filter((i) => i.changed && i.apps.length === 0)
  const overrides = changedShared.flatMap((i) => {
    const ref = flakeRefAt(current[i.name]?.source ?? null, probes[i.name]?.remoteRev ?? null)
    return ref ? [{ input: i.name, flakeRef: ref }] : []
  })

  const declaredPackages = await declaredPackageStatuses(declared, overrides)

  const claimed = new Set([
    ...catalog.flatMap((a) => a.storeNames),
    ...declaredPackages.map((d) => d.attr),
  ])
  const sharedPackages = installed.filter((p) => !claimed.has(p.name))

  const appUpdates = apps.filter((a) => a.state === "update-available").length

  return {
    checkedAt: new Date().toISOString(),
    flakeDir: flakeDir.peek(),
    apps,
    inputs,
    declaredPackages,
    sharedPackages,
    updatesAvailable: appUpdates + changedShared.length,
  }
}
