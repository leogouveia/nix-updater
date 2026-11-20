import type { Messages } from "./en"

export const pt: Messages = {
  app: {
    name: "Nix Updater",
    windowTitle: "Atualizações",
    menu: "Menu",
    settings: "Configurações",
    about: "Sobre o Nix Updater",
  },

  tabs: {
    apps: "Aplicativos",
    packages: "Pacotes",
    inputs: "Inputs",
    history: "Histórico",
  },

  actions: {
    check: "Verificar atualizações",
    prepare: "Preparar",
    apply: "Aplicar",
    prepareGranularTooltip:
      "Atualiza os inputs selecionados e constrói, sem ativar",
    prepareAllTooltip:
      "Atualiza todos os inputs sem app dedicado e constrói, sem ativar",
  },

  status: {
    updateAvailable: "atualização",
    pendingApply: "lock não aplicado",
    upToDate: "em dia",
    unknown: "desconhecido",
    error: "erro",
    unknownVersion: "versão desconhecida",

    checking: "Verificando…",
    building: "Construindo…",
    applying: "Aplicando…",
    failed: "Falhou",
    applied: "Aplicado",
    readyToApply: "Pronto para aplicar",
    nothingSelected: "Nada selecionado",
    selectedCount: (count) =>
      count === 1 ? "1 selecionado" : `${count} selecionados`,
    everythingUpToDate: "Tudo em dia",
    sharedPending: (count) =>
      count === 1
        ? "1 input compartilhado com atualização"
        : `${count} inputs compartilhados com atualização`,
  },

  apps: {
    title: "Aplicativos",
    description:
      "Cada um vem de um input próprio do flake, então pode ser atualizado sozinho.",
    lockAhead: (installed, candidate) =>
      `${installed} (lock já tem ${candidate})`,
  },

  inputs: {
    title: "Inputs do flake",
    description:
      "Revisão travada no flake.lock e a revisão candidata. Mudança de input não significa, necessariamente, versão nova de algum app.",
  },

  packages: {
    declaredTitle: "Pacotes declarados",
    declaredDescription:
      "Atributo próprio em home.packages, mas sem input dedicado — a versão é identificada por pacote, a atualização em si vem pelo input 'nixpkgs' inteiro (botão Preparar/Aplicar desta aba).",
    sharedTitle: "Outros pacotes",
    sharedDescription: (count) =>
      `${count} pacotes seguem o nixpkgs compartilhado — atualizam todos juntos, pelo input "nixpkgs".`,
    filterPlaceholder: "Filtrar pacotes",
  },

  history: {
    changesTitle: "Pacotes afetados",
    nothingBuilt: "Nada construído ainda.",
    added: (version) => `novo: ${version}`,
    removed: (version) => `removido: ${version}`,
    generationsTitle: "Gerações do Home Manager",
    generationsDescription:
      "Rollback reativa uma geração anterior. Reverter o flake.lock é operação separada, por backup.",
    generation: (id) => `Geração ${id}`,
    active: "ativa",
    reactivate: "Reativar",
    logTitle: "Log",
    noLog: "Sem log ainda.",
  },

  tray: {
    open: "Abrir",
    quit: "Sair",
    checkingUpdates: "Verificando atualizações…",
    buildingConfig: "Construindo nova configuração…",
    applying: "Aplicando…",
    lastOperationFailed: "Falha na última operação",
    neverChecked: "Nenhuma verificação ainda",
    allUpToDate: (time) => `Tudo atualizado — verificado às ${time}`,
    updatesSummary: (count, detail) =>
      count === 1
        ? `1 atualização: ${detail}`
        : `${count} atualizações: ${detail}`,
    sharedInputsDetail: "inputs do nixpkgs compartilhado",
  },

  notifications: {
    title: (count) =>
      count === 1
        ? "1 atualização disponível"
        : `${count} atualizações disponíveis`,
    view: "Ver",
    flakeInputs: "inputs do flake",
  },

  toasts: {
    checkDoneUpToDate: "Verificação concluída: tudo atualizado",
    checkDoneUpdates: (count) =>
      count === 1
        ? "Verificação concluída: 1 atualização disponível"
        : `Verificação concluída: ${count} atualizações disponíveis`,
    checkFailed: (message) => `Falha ao verificar: ${message}`,
    preparedChanges: (count) =>
      count === 1
        ? "Preparado: 1 pacote afetado"
        : `Preparado: ${count} pacotes afetados`,
    preparedNoChanges: "Preparado: nada mudaria",
    prepareFailed: (message) => `Falha ao preparar: ${message}`,
    applySucceeded: "Atualização aplicada com sucesso",
    applyFailed: (message) => `Falha ao aplicar: ${message}`,
    generationReactivated: (id) => `Geração ${id} reativada`,
    rollbackFailed: (id, message) =>
      `Falha ao reativar geração ${id}: ${message}`,
    appSaved: (id) => `App "${id}" salvo`,
    appRemoved: (id) => `App "${id}" removido`,
  },

  settings: {
    title: "Configurações",

    generalTab: "Geral",
    flakeLocationTitle: "Local do flake",
    flakeLocationDescription:
      "Pasta onde ficam o flake.nix e o flake.lock do seu home-manager.",
    flakeDirEntry: "Diretório do flake do home-manager",
    chooseFolder: "Escolher pasta",
    folderDialogTitle: "Escolher pasta do flake",
    homeConfigTitle: "Configuração do home-manager",
    homeConfigDescription:
      'Precisa bater exatamente com a chave usada no seu flake.nix: o que você digitar aqui vai virar "homeConfigurations.NOME" no nix eval do Preparar. Errar isso faz o Preparar falhar.',
    homeConfigEntry: "Nome da configuração",

    languageTitle: "Idioma",
    languageDescription: "Passa a valer depois de reiniciar o aplicativo.",
    languageEntry: "Idioma da interface",
    languageSystem: "Idioma do sistema",
    languageChanged: "Idioma alterado — reinicie o aplicativo para aplicar",

    catalogTab: "Catálogo",
    catalogTitle: "Catálogo de aplicativos",
    catalogDescription:
      'Apps com input próprio no flake, atualizáveis individualmente na aba Aplicativos. Apps que seguem o padrão "inputs.NOME.packages.${pkgs.system}.default" dentro de home.packages já aparecem sozinhos ali — só cadastre aqui o que não seguir esse padrão.',
    addApp: "Adicionar aplicativo",
    edit: "Editar",
    newApp: "Novo aplicativo",
    save: "Salvar",
    removeApp: "Remover aplicativo",
    removeHeading: "Remover aplicativo?",
    removeBody: (label) =>
      `"${label}" vai sair do catálogo. Isso não desfaz sozinho.`,
    unnamed: "(sem nome)",
    cancel: "Cancelar",
    remove: "Remover",

    fieldId: "id — único, sem espaços (obrigatório)",
    fieldInput: "Input do flake que fornece o pacote (obrigatório)",
    fieldLabel: "Nome exibido (opcional — usa o id se ficar em branco)",
    fieldIcon:
      "Ícone do tema GTK (opcional — usa um genérico se ficar em branco)",
    fieldAttr: "Atributo dentro do input (opcional)",
    fieldStoreNames: "Nomes na store, separados por vírgula (opcional)",
    idRequired: "O campo id é obrigatório",
    inputRequired: 'O campo "input do flake" é obrigatório',
    duplicateId: (id) => `Já existe um app com id "${id}"`,

    aboutTab: "Sobre",
    aboutTitle: "Sobre e como usar",
    aboutText: `nix-updater é um indicador de bandeja e janela pra atualizar o Home \
Manager de forma seletiva, sem depender de "nixos-rebuild switch" cego.

Faixas de pacotes
• Aplicativos — tem input próprio no flake, atualiza sozinho.
• Pacotes declarados — atributo próprio em home.packages, mas segue o \
nixpkgs compartilhado.
• Outros pacotes — instalado, mas sem atributo identificável.

Preparar/Aplicar são dois fluxos independentes:
• Granular (abas Aplicativos e Inputs) — usa os checkboxes marcados.
• Geral (aba Pacotes) — ignora a seleção granular, sempre pega todo input \
sem app dono (nixpkgs, home-manager, nix-flatpak...).

Histórico só reativa gerações antigas do home-manager — não participa do \
fluxo de Preparar/Aplicar.

Backups do flake.lock ficam em $XDG_STATE_HOME/nix-updater/backups/, um por \
Preparar. Qualquer falha no Preparar restaura o lock sozinho; rollback de \
perfil (Reativar) e reversão do lock são operações separadas.

Plataforma: esta aplicação só roda em x86_64-linux — não há suporte \
planejado para outras arquiteturas.`,
  },

  about: {
    comments: (system) =>
      "Atualizações seletivas do Home Manager: verifica, constrói e ativa " +
      `apenas os inputs escolhidos, em vez de tudo de uma vez.\n\nPlataforma: ${system}.`,
  },

  errors: {
    unsupportedPlatform: (arch) =>
      `nix-updater: só roda em x86_64-linux (arquitetura detectada: ${arch}).`,
    operationInProgress: "já existe uma operação de atualização em andamento",
    staleLock:
      "o flake.lock mudou desde a última verificação — verifique de novo antes de aplicar",
    commandFailed: (command, status, stderr) =>
      `${command} falhou (status ${status}): ${stderr}`,
    cannotRead: (path) => `não foi possível ler ${path}`,
    buildFailed: (status) => `build falhou (status ${status})`,
    activationFailed: (status) => `ativação falhou (status ${status})`,
    rollbackFailed: (status) => `rollback falhou (status ${status})`,
  },

  log: {
    failed: (message) => `! falhou: ${message}`,
    restoringLock: (backup) => `! restaurando flake.lock de ${backup}`,
    unselectedChanges: (inputs) =>
      `! inputs alterados sem seleção (efeito transitivo): ${inputs}`,
    allInputs: "(todos)",
    validating: "$ nix eval (validação)",
  },

  cli: {
    appsHeader: "Aplicativos (atualizáveis individualmente)",
    declaredHeader: "Pacotes declarados (home.packages, atributo próprio)",
    inputsHeader: "Inputs do flake",
    sharedCount: (count) =>
      `Outros pacotes (nixpkgs compartilhado): ${count}`,
    updatesAvailable: (count) => `Atualizações disponíveis: ${count}`,
    lockAlreadyHas: (candidate) => `(lock já tem ${candidate})`,
  },

  ipc: {
    ok: "ok",
    updateCount: (count) =>
      count === 1 ? "1 atualização" : `${count} atualizações`,
    nothingSelected: "(nada selecionado)",
    failed: "falhou",
    applied: "aplicado",
    quitting: "saindo",
    help: "comandos: check | select [inputs…] | prepare | apply | toggle | settings | status | quit",
  },
}
