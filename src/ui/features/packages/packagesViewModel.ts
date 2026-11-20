import { createComputed, createState, type Accessor } from "ags"
import { t } from "../../../core/i18n"
import { result } from "../../../core/state"
import type { DeclaredPackageStatus, StorePackage } from "../../../core/types"

/** A lista inteira trava a rolagem sem ganho: 200 já cobre a busca. */
const MAX_VISIBLE_SHARED = 200

export interface PackagesViewModel {
  declaredPackages: Accessor<DeclaredPackageStatus[]>
  /** Pacotes compartilhados já filtrados pela busca e limitados ao visível. */
  visibleSharedPackages: Accessor<StorePackage[]>
  sharedSummary: Accessor<string>
  setQuery: (value: string) => void
}

export function createPackagesViewModel(): PackagesViewModel {
  const [query, setQuery] = createState("")

  const declaredPackages = createComputed(
    [result],
    (r) => r?.declaredPackages ?? [],
  )

  const visibleSharedPackages = createComputed([result, query], (r, q) => {
    const list = r?.sharedPackages ?? []
    const term = q.trim().toLowerCase()
    const filtered = term
      ? list.filter((p) => p.name.toLowerCase().includes(term))
      : list
    return filtered.slice(0, MAX_VISIBLE_SHARED)
  })

  const sharedSummary = createComputed([result], (r) =>
    t.packages.sharedDescription(r?.sharedPackages.length ?? 0),
  )

  return { declaredPackages, visibleSharedPackages, sharedSummary, setQuery }
}
