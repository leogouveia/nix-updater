/**
 * Modelo de domínio do nix-updater.
 *
 * Faixas (tiers) — refletem a granularidade real que o Nix permite:
 *  - "app":    pacote vem de um input dedicado; atualizável individualmente.
 *  - "shared": pacote vem do nixpkgs compartilhado; só atualiza em bloco.
 */
export type Tier = "app" | "shared"

/**
 * "pending-apply": o flake.lock já tem uma versão que o perfil ativo não
 * tem — tipicamente depois de um rollback de geração, que reverte o perfil
 * sem reverter o lock. Diferente de "update-available": não precisa de
 * `nix flake update`, só rodar Preparar/Aplicar (ou reverter o lock também).
 */
export type UpdateState =
  | "up-to-date"
  | "update-available"
  | "pending-apply"
  | "unknown"
  | "error"

/** Pacote presente na closure do perfil do Home Manager. */
export interface StorePackage {
  name: string
  version: string
  path: string
}

/** Resultado da checagem para um app de faixa "app". */
export interface AppStatus {
  id: string
  label: string
  icon: string
  tier: Tier
  /** Input do flake que governa este app (ex.: "vscode-pkgs"). */
  input: string
  /** Versão em uso agora (perfil ativo, com fallback para o lock atual). */
  installed: string | null
  /** Versão que entraria se o input fosse atualizado. */
  candidate: string | null
  state: UpdateState
  /** Mensagem quando `state === "error"`. */
  error?: string
}

/**
 * Pacote achado em `home.packages` com atributo próprio no nixpkgs
 * compartilhado ("claude-code", "hunspellDicts.pt_BR") — a versão é avaliada
 * por pacote, mas a atualização em si só acontece pelo input `nixpkgs`
 * inteiro. Pacotes com input *próprio* viram apps (ver `AppStatus`), não
 * entram aqui.
 */
export interface DeclaredPackageStatus {
  attr: string
  installed: string | null
  candidate: string | null
  state: UpdateState
  sourceFile: string
}

/** Estado de um input do flake: revisão atual vs. candidata. */
export interface InputStatus {
  name: string
  currentRev: string | null
  candidateRev: string | null
  currentDate: string | null
  candidateDate: string | null
  changed: boolean
  /** Apps de faixa "app" governados por este input. */
  apps: string[]
}

export interface CheckResult {
  checkedAt: string
  flakeDir: string
  apps: AppStatus[]
  inputs: InputStatus[]
  /** Pacotes do nixpkgs compartilhado com atributo próprio em home.packages. */
  declaredPackages: DeclaredPackageStatus[]
  /** Pacotes da faixa compartilhada (nixpkgs), apenas versão instalada. */
  sharedPackages: StorePackage[]
  updatesAvailable: number
}
