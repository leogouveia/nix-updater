import { createComputed, type Accessor } from "ags"

/**
 * Acompanha um item de lista pelo seu id, dentro de um `<For>`.
 *
 * O `For` do gnim reaproveita a linha quando o id não muda: a função que
 * monta o filho roda uma vez só, e tudo que não for `Accessor` fica preso no
 * valor de quando a linha nasceu. Sem isso, uma verificação nova atualiza a
 * lista mas as linhas existentes continuam mostrando o estado antigo.
 */
export function trackById<T>(
  list: Accessor<T[]>,
  initial: T,
  id: (item: T) => string | number,
): Accessor<T> {
  const key = id(initial)
  return createComputed(
    [list],
    (items) => items.find((item) => id(item) === key) ?? initial,
  )
}
