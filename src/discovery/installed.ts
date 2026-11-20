import { run } from "../core/proc"
import { HOME_PROFILE } from "../core/registry"
import type { StorePackage } from "../core/types"

const STORE_PATH = /^\/nix\/store\/[a-z0-9]{32}-(.+)$/
// Nome e versão se separam no primeiro "-" seguido de dígito.
const NAME_VERSION = /^(.*?)-(\d[^-]*(?:-[^-]*\d[^-]*)*)$/

export function splitNameVersion(derivationName: string): {
  name: string
  version: string
} {
  const m = NAME_VERSION.exec(derivationName)
  if (!m) return { name: derivationName, version: "" }
  return { name: m[1], version: m[2] }
}

/**
 * Pacotes de primeiro nível da closure do perfil do Home Manager.
 *
 * Usa `nix-store -q --references` sobre `home-path`: é a única fonte barata de
 * "versão instalada" — `nvd list` não funciona neste perfil.
 */
export async function listInstalled(
  profile = `${HOME_PROFILE}/home-path`,
): Promise<StorePackage[]> {
  const result = await run(["nix-store", "-q", "--references", profile])
  if (!result.ok) return []

  const packages: StorePackage[] = []
  for (const line of result.stdout.split("\n")) {
    const path = line.trim()
    if (!path) continue
    const m = STORE_PATH.exec(path)
    if (!m) continue
    const { name, version } = splitNameVersion(m[1])
    packages.push({ name, version, path })
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name))
}
