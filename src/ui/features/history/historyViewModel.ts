import { createComputed, createState, onCleanup, onMount, type Accessor } from "ags"
import { t } from "../../../core/i18n"
import { log, prepared, result } from "../../../core/state"
import { generations, type Generation, type PackageChange } from "../../../update"

const MAX_VISIBLE_GENERATIONS = 10

export interface HistoryViewModel {
  generations: Accessor<Generation[]>
  changes: Accessor<PackageChange[]>
  closureSummary: Accessor<string>
  logText: Accessor<string>
}

/**
 * Deve ser chamado durante a montagem do componente: usa `onMount`/
 * `onCleanup` para registrar e descartar a assinatura de `result`.
 */
export function createHistoryViewModel(): HistoryViewModel {
  const [gens, setGens] = createState<Generation[]>([])

  function refreshGenerations(): void {
    void generations().then((list) =>
      setGens(list.slice(0, MAX_VISIBLE_GENERATIONS)),
    )
  }

  onMount(() => {
    refreshGenerations()
    // A lista de gerações não deriva de `result`, mas muda junto: toda
    // operação que altera o perfil termina reverificando. Sem isto, a lista
    // (e a marca de "ativa") só mudaria remontando a página.
    onCleanup(result.subscribe(refreshGenerations))
  })

  return {
    generations: gens,
    changes: createComputed([prepared], (p) => p?.changes ?? []),
    closureSummary: createComputed(
      [prepared],
      (p) => p?.closureSummary ?? t.history.nothingBuilt,
    ),
    logText: createComputed([log], (lines) =>
      lines.length > 0 ? lines.join("\n") : t.history.noLog,
    ),
  }
}
