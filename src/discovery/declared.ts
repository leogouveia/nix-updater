import { run } from "../core/proc"
import { flakeDir } from "../core/config"

export interface DeclaredPackage {
  kind: "nixpkgs" | "input"
  /** Para "nixpkgs": caminho de atributo (ex.: "hunspellDicts.pt_BR"). Para "input": nome do input. */
  name: string
  sourceFile: string
}

const SIMPLE_ATTR = /^[A-Za-z_][\w'-]*$/
const DOTTED_ATTR = /^\(([A-Za-z_][\w'-]*)\)\.([A-Za-z_][\w'-]*)$/
const INPUT_REF = /\(inputs\)\.([A-Za-z0-9_-]+)\.packages\./

/**
 * Casa o `(`/`[`/`{` em `openIndex` com seu fechamento, contando os três
 * tipos juntos. Funciona porque a saída do `nix-instantiate --parse` é
 * sempre bem-aninhada — não precisa saber qual tipo fecha o quê.
 */
function matchBalanced(text: string, openIndex: number): number {
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    const c = text[i]
    if (c === "(" || c === "[" || c === "{") depth++
    else if (c === ")" || c === "]" || c === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function classify(item: string): Omit<DeclaredPackage, "sourceFile"> | null {
  const inputMatch = INPUT_REF.exec(item)
  if (inputMatch) return { kind: "input", name: inputMatch[1] }

  if (SIMPLE_ATTR.test(item)) return { kind: "nixpkgs", name: item }

  const dotted = DOTTED_ATTR.exec(item)
  if (dotted) {
    const [, base, rest] = dotted
    // "pkgs.foo" sem `with pkgs;` vira o mesmo atributo que "foo" dentro de
    // `with pkgs; [ foo ]` — só perde esse prefixo quando a base é "pkgs";
    // qualquer outra base (ex. "hunspellDicts") é parte do atributo mesmo.
    return { kind: "nixpkgs", name: base === "pkgs" ? rest : `${base}.${rest}` }
  }

  return null
}

/**
 * `expr` é o texto já parentetizado de `home.packages`, tipicamente
 * "(with pkgs; [ (a) (b) ... ])". Itens que não reconhecemos (chamadas de
 * função, `.override { ... }`, condicionais) são ignorados — ficam na faixa
 * "shared" de sempre, sem regressão.
 */
function extractItems(expr: string, sourceFile: string): DeclaredPackage[] {
  const bracketOpen = expr.indexOf("[")
  if (bracketOpen === -1) return []
  const bracketClose = matchBalanced(expr, bracketOpen)
  if (bracketClose === -1) return []
  const inner = expr.slice(bracketOpen + 1, bracketClose)

  const items: DeclaredPackage[] = []
  let i = 0
  while (i < inner.length) {
    if (/\s/.test(inner[i])) {
      i++
      continue
    }
    if (inner[i] !== "(") {
      i++
      continue
    }
    const close = matchBalanced(inner, i)
    if (close === -1) break
    const item = inner.slice(i + 1, close)
    const parsed = classify(item)
    if (parsed) items.push({ ...parsed, sourceFile })
    i = close + 1
  }
  return items
}

async function parseFile(path: string): Promise<DeclaredPackage[]> {
  const parsed = await run(["nix-instantiate", "--parse", path])
  if (!parsed.ok) return []
  const text = parsed.stdout

  const homeIdx = text.indexOf("home = {")
  if (homeIdx === -1) return []
  const homeOpenBrace = text.indexOf("{", homeIdx)
  const homeClose = matchBalanced(text, homeOpenBrace)
  if (homeClose === -1) return []
  const homeBlock = text.slice(homeOpenBrace, homeClose + 1)

  const declared: DeclaredPackage[] = []
  // Com `with pkgs; [...]` o AST embrulha a lista num parêntese extra
  // ("packages = (with pkgs; [...])"); sem `with` nenhum, o valor é a lista
  // direto ("packages = [...]") — as duas formas precisam ser aceitas, não
  // só a primeira.
  const packagesRe = /packages = (?=[([])/g
  let m: RegExpExecArray | null
  while ((m = packagesRe.exec(homeBlock))) {
    const openParen = m.index + "packages = ".length
    const close = matchBalanced(homeBlock, openParen)
    if (close === -1) continue
    const expr = homeBlock.slice(openParen, close + 1)
    declared.push(...extractItems(expr, path))
  }
  return declared
}

/**
 * Lê `home.packages` de todos os módulos do home-manager por AST (via
 * `nix-instantiate --parse`), não por regex sobre o texto original — assim
 * comentários e formatação não quebram a extração.
 */
export async function discoverDeclaredPackages(
  dir = flakeDir.peek(),
): Promise<DeclaredPackage[]> {
  const grep = await run(["grep", "-rl", "home.packages", dir])
  if (!grep.ok) return []
  const files = grep.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  const perFile = await Promise.all(files.map(parseFile))

  const seen = new Map<string, DeclaredPackage>()
  for (const list of perFile) {
    for (const d of list) {
      const key = `${d.kind}:${d.name}`
      if (!seen.has(key)) seen.set(key, d)
    }
  }
  return [...seen.values()]
}
