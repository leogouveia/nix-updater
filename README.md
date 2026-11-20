# nix-updater

Indicador de bandeja + janela para atualizar o Home Manager de forma seletiva.
AGS v3 (Astal GTK4 + gnim), TypeScript/TSX, processo único.

## Configuração

Só roda em **x86_64-linux** — não é objetivo deste projeto suportar outras
arquiteturas. Três coisas são específicas de cada máquina/usuário e vivem em
`src/core/config.ts`, persistidas em
`$XDG_CONFIG_HOME/nix-updater/config.json`:

- **Local do flake** — pasta com o `flake.nix`/`flake.lock` do home-manager.
- **Configuração do home-manager** — a chave em `homeConfigurations.<isso>`
  no `flake.nix` do usuário.
- **Catálogo de apps** — pacotes com input próprio no flake (ver tabela
  abaixo); editável, não precisa recompilar o projeto pra adicionar um.

Editável pelo botão de engrenagem na barra de título (abre
`src/ui/SettingsDialog.tsx`), ou via IPC: `ags request -i nix-updater
settings`. Sem configuração nenhuma, cai nos defaults de hoje (os valores
que já eram hardcoded antes desta tela existir).

## O que dá para atualizar sozinho — e por quê

No Nix a versão de um pacote vem do pin do `nixpkgs`, então "atualizar só o
Firefox" só existe se aquele app tiver uma **fonte própria**, ou se o pacote
tiver atributo próprio em `home.packages` (daí dá pra saber a versão
candidata dele mesmo sem input dedicado). Daí as três faixas que a UI expõe:

| Faixa | O que é | Onde | Controle |
|---|---|---|---|
| **Aplicativos** | pacote com input próprio no flake | catálogo em `registry.ts` (`vscode-pkgs`, `vscodium-pkgs`, `zed-pkgs`, `zen-browser`) **+** qualquer `inputs.<nome>.packages...default` achado em `home.packages` que ainda não esteja no catálogo | checkbox por app — granular |
| **Pacotes declarados** | atributo próprio em `home.packages`, mas sem input dedicado — quase sempre vem do `nixpkgs` compartilhado | descoberto automaticamente nos módulos do home-manager — ver abaixo | sem checkbox — só move junto com o input que governa (ver aba Pacotes) |
| **Outros pacotes** | o que sobra: instalado, mas sem atributo identificável no texto | — | sem checkbox — idem |

A aba "Aplicativos" **não é mais uma lista fixa**: além do catálogo
curado (com ícone e nome bonito), qualquer input novo que você referenciar
como `inputs.<nome>.packages.${pkgs.system}.default` dentro de um
`home.packages` já aparece ali sozinho na próxima verificação, com
checkbox e tudo — não precisa editar este projeto.

Um `nixpkgs` extra **não** move tudo: move só os pacotes consumidos dele. Como
`zed-pkgs` só fornece o `zed-editor`, atualizar aquele input atualiza só o Zed.
O custo é duplicação de closure quando os inputs divergem de revisão.

### Como a descoberta em `home.packages` funciona

`src/discovery/declared.ts` lê `home.packages` de cada módulo do home-manager
pela AST do `nix-instantiate --parse` (não por regex sobre o texto original —
assim comentários e formatação não quebram a extração). Dois padrões são
reconhecidos:

- identificador simples ou dotado dentro de `with pkgs; [ ... ]`
  (`claude-code`, `hunspellDicts.pt_BR`) → vira item de "Pacotes declarados":
  avalia `nixpkgs.legacyPackages.${system}.<atributo>.version` numa chamada em
  lote (`evalVersions`), uma por `flake.nix` (atual e candidato).
- `inputs.<nome>.packages.${pkgs.system}.default` → vira item de
  "Aplicativos" (ver acima). Se `<nome>` já estiver no catálogo `APPS` (caso
  do `zen-browser`), é ignorado aqui para não duplicar.

Itens que não batem com esses dois formatos (chamadas de função,
`.override { ... }`, condicionais) ficam de fora e continuam caindo em
"Outros pacotes" — sem regressão, só sem versão individual.

### Preparar/Aplicar: dois fluxos, não um

Os botões Preparar/Aplicar não são globais nem por-aba — são **dois
controles independentes** que operam no mesmo build por baixo:

- **Granular** (abas Aplicativos e Inputs): usa a seleção marcada nos
  checkboxes — mesma lista nas duas abas, só duas portas de entrada
  diferentes. `nix flake update` roda só nos inputs marcados.
- **Geral** (aba Pacotes): ignora a seleção granular de propósito. Pega
  sempre *todo* input sem app dono (`nixpkgs`, `home-manager`,
  `nix-flatpak`, ...) — porque "Pacotes declarados"/"Outros pacotes" não têm
  controle fino: a granularidade real do Nix para no nível de input, não de
  pacote, pra quem não tem input próprio.

O Aplicar é o mesmo nos dois casos — ativa o que quer que tenha sido
construído pelo último Preparar, venha ele de qual aba for. A aba Histórico
não tem footer: ela só reativa gerações antigas, não participa desse fluxo.

A versão candidata aparece **antes** de qualquer build porque é avaliada no
input atualizado dentro de uma cópia temporária do flake (`nix eval`), nunca no
`flake.lock` real.

## As três operações

| Operação | Escreve em disco? | O que faz |
|---|---|---|
| **Verificar** | não | copia `flake.nix`/`flake.lock` para `/tmp`, roda `nix flake update` lá, compara revisões e avalia versões |
| **Preparar** | sim (`flake.lock`) | faz backup, atualiza só os inputs selecionados, valida com `nix eval`, constrói com `nix build` e mostra o diff do `nvd` |
| **Aplicar** | sim (perfil) | roda o `activate` do resultado já construído — exatamente o que foi mostrado no diff |

Qualquer falha no **Preparar** restaura o `flake.lock` do backup
(`$XDG_STATE_HOME/nix-updater/backups/<timestamp>/`). Rollback do perfil
(reativar geração) e reversão do lock são operações separadas, como devem ser.

## Uso

```bash
nix run .                          # app completo (janela + indicador)
nix build . && ./result/bin/nix-updater
```

Não há serviço nem timer: o `nix-config` ficou só com arquivos declarativos.
Para rodar junto da sessão, use um `.desktop` em `~/.config/autostart` ou um
módulo home-manager que consuma este flake como input.

## Desenvolvimento

```bash
nix develop                                  # ags, gjs, GTK4, libadwaita
ags run -g 4 .                               # app completo
ags run -g 4 cli.ts                          # só a verificação, em texto
ags run -g 4 cli.ts -- --json
ags types -d .                               # regenera os tipos em @girs
```

Com o app rodando, tudo é acessível por IPC — útil para testar sem clicar e
para agendar a verificação por um timer systemd, se você quiser:

```bash
ags request -i nix-updater check
ags request -i nix-updater select zen-browser vscode-pkgs
ags request -i nix-updater prepare
ags request -i nix-updater apply
ags request -i nix-updater status      # JSON do estado atual
ags request -i nix-updater toggle
```

## Decisões que não são óbvias

- **O indicador é um StatusNotifierItem escrito à mão** (`src/tray/sni.ts`).
  O `AstalTray` é *host*: consome bandeja, não publica. O item re-registra no
  watcher quando ele troca de dono — sem isso o ícone some ao reiniciar o
  GNOME Shell ou recarregar a extensão.
- **Nada de `Astal.Window`**: ela depende de `gtk4-layer-shell`, que não existe
  no Mutter. A janela é `Adw.ApplicationWindow`, o que a deixa idêntica no
  GNOME e num compositor wlroots.
- **Retorno de método D-Bus no GJS tem três casos** (`src/tray/sni.ts`): com vários
  argumentos de saída, devolva um array; com um só, devolva o valor cru; e um
  `GLib.Variant` devolvido vira a tupla de resposta inteira — por isso o
  `GetProperty` monta `"(v)"` explicitamente. Errar isso não é inofensivo: um
  `GetGroupProperties` inválido derrubou a extensão appindicator do GNOME
  inteira, que só voltou com novo login.
- **Comandos sempre por array de argumentos** (`src/core/proc.ts`), nunca por
  concatenação de shell.
- **Ícones symbolic usam só preenchimento, sem `stroke`**: o GTK recolore
  símbolos sobrescrevendo `fill`; traços ficariam pretos no painel escuro.
- **`nvd list` não funciona no perfil do Home Manager.** A lista de pacotes
  instalados vem de `nix-store -q --references .../home-path`.
- **Um lockfile em `$XDG_RUNTIME_DIR`** impede preparar e aplicar ao mesmo
  tempo, inclusive entre instâncias.

## Limitações conhecidas

- O `ags types` não gera tipos de libadwaita (lista fixa do ts-for-gir), então
  `tsc --noEmit` reclama do `import Adw from "gi://Adw?version=1"`. O runtime
  não é afetado; o resto do código passa no type-check.
- A extensão **appindicator** do GNOME precisa de `gjs` no PATH do shell — e do
  `gjs` do *sistema*, não o do flake (revisões diferentes de glib fazem o do
  flake abortar com os typelibs da sessão). Sem isso a extensão fica `INACTIVE`
  e nenhum ícone de bandeja aparece.
- A seção Flatpak ainda não existe: `nix-flatpak` já atualiza sozinho
  (`update.auto`), então ela entra depois, só leitura.
