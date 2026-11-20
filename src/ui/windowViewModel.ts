import Adw from "gi://Adw?version=1"
import { createBinding, createComputed, type Accessor } from "ags"
import { t } from "../core/i18n"
import {
  applied,
  lastError,
  phase,
  prepared,
  result,
  selection,
  type Phase,
} from "../core/state"

export interface WindowViewModel {
  /** Nulo enquanto o stack ainda não tem página visível (montagem). */
  visiblePage: Accessor<string | null>
  showGranularFooter: Accessor<boolean>
  showGeneralFooter: Accessor<boolean>
  showFooter: Accessor<boolean>
  /** Texto do rodapé granular (Aplicativos/Inputs). */
  granularStatus: Accessor<string>
  hasSelection: Accessor<boolean>
  /** Texto do rodapé geral (Pacotes). */
  generalStatus: Accessor<string>
  hasSharedUpdates: Accessor<boolean>
}

/**
 * Texto que depende só da fase da operação, comum aos dois rodapés.
 * Devolve `null` quando nada está em andamento e o rodapé deve mostrar a
 * informação específica dele.
 */
function phaseStatus(
  current: Phase,
  built: unknown,
  wasApplied: boolean,
  error: string | null,
): string | null {
  switch (current) {
    case "error":
      return error ?? t.status.failed
    case "checking":
      return t.status.checking
    case "preparing":
      return t.status.building
    case "applying":
      return t.status.applying
    default:
      break
  }

  if (built && wasApplied) return t.status.applied
  if (built) return t.status.readyToApply
  return null
}

export function createWindowViewModel(stack: Adw.ViewStack): WindowViewModel {
  const visiblePage = createBinding(stack, "visibleChildName")

  const granularStatus = createComputed(
    [phase, selection, prepared, applied, lastError],
    (current, selected, built, wasApplied, error) =>
      phaseStatus(current, built, wasApplied, error) ??
      (selected.length === 0
        ? t.status.nothingSelected
        : t.status.selectedCount(selected.length)),
  )

  // Inputs "sem dono": nenhum app, do catálogo ou descoberto, os governa —
  // são exatamente o que a aba Pacotes lista (declarados + outros).
  const pendingSharedCount = createComputed(
    [result],
    (r) => r?.inputs.filter((i) => i.apps.length === 0 && i.changed).length ?? 0,
  )

  const generalStatus = createComputed(
    [phase, prepared, applied, pendingSharedCount, lastError],
    (current, built, wasApplied, pending, error) =>
      phaseStatus(current, built, wasApplied, error) ??
      (pending > 0
        ? t.status.sharedPending(pending)
        : t.status.everythingUpToDate),
  )

  return {
    visiblePage,
    showGranularFooter: createComputed(
      [visiblePage],
      (p) => p === "apps" || p === "inputs",
    ),
    showGeneralFooter: createComputed([visiblePage], (p) => p === "packages"),
    showFooter: createComputed([visiblePage], (p) => p !== "history"),
    granularStatus,
    hasSelection: createComputed([selection], (s) => s.length > 0),
    generalStatus,
    hasSharedUpdates: createComputed([pendingSharedCount], (n) => n > 0),
  }
}
