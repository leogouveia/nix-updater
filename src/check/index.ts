import { SYSTEM } from "../core/registry"
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
  CandidateFlake,
  evalVersion,
  evalVersions,
  formatDate,
  readLock,
  shortRev,
  type LockNodes,
} from "../discovery/flake"

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

async function appStatus(
  app: AppDefinition,
  installed: StorePackage[],
  current: LockNodes,
  candidateLock: LockNodes,
  candidateDir: string,
): Promise<AppStatus> {
  // Versão em uso: a closure do perfil é a verdade. VSCodium não entra no
  // ambiente combinado, então cai no fallback de avaliar o lock atual.
  const fromProfile = findInstalled(app, installed)
  const lockVersion = await evalVersion(flakeDir.peek(), app.input, app.attr)
  const installedVersion = fromProfile?.version || lockVersion

  const inputChanged =
    current[app.input]?.rev !== candidateLock[app.input]?.rev

  // Se o input não mudou, não há o que avaliar: a candidata é a do lock atual.
  const candidateVersion = inputChanged
    ? await evalVersion(candidateDir, app.input, app.attr)
    : lockVersion

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
 * Um app descoberto em `home.packages` via `inputs.<nome>.packages...default`
 * que ainda não está no catálogo `APPS` — mesma ideia dos apps hardcoded,
 * só que achada no texto em vez de escrita à mão em `registry.ts`. Assim,
 * editar o `home-manager` e adicionar um input novo já basta pra ele
 * aparecer em "Aplicativos", sem precisar tocar neste projeto.
 */
async function discoveredAppStatus(
  inputName: string,
  current: LockNodes,
  candidateLock: LockNodes,
  candidateDir: string,
): Promise<AppStatus> {
  const attr = `packages.${SYSTEM}.default`
  const inputChanged = current[inputName]?.rev !== candidateLock[inputName]?.rev
  const installed = await evalVersion(flakeDir.peek(), inputName, attr)
  const candidate = inputChanged
    ? await evalVersion(candidateDir, inputName, attr)
    : installed

  return {
    id: inputName,
    label: inputName,
    icon: "package-x-generic-symbolic",
    tier: "app",
    input: inputName,
    installed,
    candidate,
    state: stateOf(installed, candidate),
  }
}

/**
 * Versões dos pacotes sem input próprio achados em `home.packages` (ver
 * `src/discovery/declared.ts`), avaliadas numa chamada em lote. Pacotes com
 * input próprio (`kind: "input"`) não entram aqui — viram apps, não "pacotes
 * declarados": ver `discoveredAppStatus`.
 *
 * `sharedChanged` diz se vale reavaliar: qualquer input *sem app dono* que
 * tenha mudado pode mover esses pacotes. É deliberadamente conservador — não
 * assume que o input se chama "nixpkgs", e errar para mais só custa uma
 * avaliação a toa, enquanto errar para menos mostraria versão velha.
 */
async function declaredPackageStatuses(
  declared: DeclaredPackage[],
  sharedChanged: boolean,
  candidateDir: string,
): Promise<DeclaredPackageStatus[]> {
  const nixpkgsOnly = declared.filter((d) => d.kind === "nixpkgs")
  const sourceOf = new Map(nixpkgsOnly.map((d) => [d.name, d.sourceFile]))
  const attrs = [...new Set(nixpkgsOnly.map((d) => d.name))]

  const [installedVersions, candidateVersions] = await Promise.all([
    evalVersions(flakeDir.peek(), attrs),
    sharedChanged
      ? evalVersions(candidateDir, attrs)
      : Promise.resolve<Record<string, string | null>>({}),
  ])

  return attrs.map((attr) => {
    const installed = installedVersions[attr] ?? null
    const candidate = sharedChanged ? candidateVersions[attr] ?? null : installed
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
  candidate: LockNodes,
  appByInput: Map<string, string>,
): InputStatus[] {
  return Object.keys(current)
    .sort()
    .map((name) => {
      const a = current[name]
      const b = candidate[name] ?? a
      const appId = appByInput.get(name)
      return {
        name,
        currentRev: shortRev(a.rev),
        candidateRev: shortRev(b.rev),
        currentDate: formatDate(a.lastModified),
        candidateDate: formatDate(b.lastModified),
        changed: a.rev !== b.rev,
        apps: appId ? [appId] : [],
      }
    })
}

/**
 * Checagem somente-leitura: nada no diretório do flake (`flakeDir`, ver
 * `src/core/config.ts`) é alterado.
 *
 * Caro apenas na primeira execução do dia (baixa os tarballs dos inputs
 * candidatos); o resto é avaliação com cache do Nix.
 */
export async function check(): Promise<CheckResult> {
  const [installed, candidate, declared] = await Promise.all([
    listInstalled(),
    CandidateFlake.prepare(),
    discoverDeclaredPackages(),
  ])

  try {
    const current = readLock()
    const candidateLock = candidate.lock()
    const catalog = appCatalog.peek()
    const catalogInputs = new Set(catalog.map((a) => a.input))

    const catalogApps = await Promise.all(
      catalog.map((app) =>
        appStatus(app, installed, current, candidateLock, candidate.dir),
      ),
    )
    const discoveredInputNames = [
      ...new Set(
        declared
          .filter((d) => d.kind === "input" && !catalogInputs.has(d.name))
          .map((d) => d.name),
      ),
    ]
    const discoveredApps = await Promise.all(
      discoveredInputNames.map((name) =>
        discoveredAppStatus(name, current, candidateLock, candidate.dir),
      ),
    )
    const apps = [...catalogApps, ...discoveredApps]

    const appByInput = new Map(apps.map((a) => [a.input, a.id]))
    const inputs = inputStatuses(current, candidateLock, appByInput)

    // Inputs sem app dono: são os que governam os pacotes declarados e os
    // "outros pacotes", e qualquer um deles que mude pode mover as versões.
    const changedShared = inputs.filter((i) => i.changed && i.apps.length === 0)

    const declaredPackages = await declaredPackageStatuses(
      declared,
      changedShared.length > 0,
      candidate.dir,
    )

    const claimed = new Set([
      ...catalog.flatMap((a) => a.storeNames),
      ...discoveredApps.map((a) => a.id),
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
  } finally {
    candidate.dispose()
  }
}
