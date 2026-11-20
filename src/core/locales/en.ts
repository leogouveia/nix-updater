/**
 * Catálogo de origem: o tipo `Messages` é inferido daqui, então os demais
 * idiomas são obrigados pelo compilador a ter exatamente as mesmas chaves e
 * as mesmas assinaturas de função. Chave faltando = erro de build.
 *
 * Plurais são funções com `count` porque en/pt/es compartilham a mesma regra
 * (singular só para 1) — não vale o peso de ngettext para isso.
 */
export const en = {
  app: {
    name: "Nix Updater",
    windowTitle: "Updates",
    menu: "Menu",
    settings: "Settings",
    about: "About Nix Updater",
    help: "Help",
  },

  tabs: {
    apps: "Apps",
    packages: "Packages",
    inputs: "Inputs",
    history: "History",
  },

  actions: {
    check: "Check for updates",
    prepare: "Prepare",
    apply: "Apply",
    prepareGranularTooltip:
      "Updates the selected inputs and builds, without activating",
    prepareAllTooltip:
      "Updates every input without a dedicated app and builds, without activating",
  },

  status: {
    updateAvailable: "update",
    pendingApply: "lock not applied",
    upToDate: "up to date",
    unknown: "unknown",
    error: "error",
    unknownVersion: "unknown version",

    checking: "Checking…",
    building: "Building…",
    applying: "Applying…",
    failed: "Failed",
    applied: "Applied",
    readyToApply: "Ready to apply",
    nothingSelected: "Nothing selected",
    selectedCount: (count: number) => `${count} selected`,
    everythingUpToDate: "Everything up to date",
    sharedPending: (count: number) =>
      count === 1
        ? "1 shared input with updates"
        : `${count} shared inputs with updates`,
  },

  apps: {
    title: "Apps",
    description:
      "Each one comes from its own flake input, so it can be updated on its own.",
    helpText:
      "An app's version only changes when its input actually bumps that " +
      "specific package — not every time the input's revision moves. The " +
      "same revision bump can leave one app's version unchanged while " +
      "moving another's: a new commit doesn't guarantee a new package " +
      "version. Check the Inputs tab to see which revisions actually " +
      'changed, independently of whether any app here says "update".',
    lockAhead: (installed: string, candidate: string) =>
      `${installed} (lock already has ${candidate})`,
  },

  inputs: {
    title: "Flake inputs",
    description:
      "Revision locked in flake.lock and the candidate revision. A changed input does not necessarily mean a new version of any app.",
    helpText:
      "A changed revision means new commits landed in that input — it " +
      "does not mean every package coming from it got a new version. For " +
      "example, vscode-pkgs and zed-pkgs can both move to the same new " +
      "revision, yet only Zed's version actually changes if that's the " +
      "only package whose build was bumped in between. Check the Apps " +
      "and Packages tabs for which versions really moved before deciding " +
      "what to update.",
  },

  packages: {
    declaredTitle: "Declared packages",
    declaredDescription:
      "Own attribute in home.packages, but no dedicated input — the version is identified per package, while the update itself comes from the whole 'nixpkgs' input (Prepare/Apply button on this tab).",
    sharedTitle: "Other packages",
    sharedDescription: (count: number) =>
      `${count} packages follow the shared nixpkgs — they all update together, through the "nixpkgs" input.`,
    filterPlaceholder: "Filter packages",
  },

  history: {
    changesTitle: "Affected packages",
    nothingBuilt: "Nothing built yet.",
    added: (version: string) => `new: ${version}`,
    removed: (version: string) => `removed: ${version}`,
    generationsTitle: "Home Manager generations",
    generationsDescription:
      "Rollback reactivates a previous generation. Reverting flake.lock is a separate operation, from a backup.",
    generation: (id: number) => `Generation ${id}`,
    active: "active",
    reactivate: "Reactivate",
    logTitle: "Log",
    noLog: "No log yet.",
  },

  tray: {
    open: "Open",
    quit: "Quit",
    checkingUpdates: "Checking for updates…",
    buildingConfig: "Building new configuration…",
    applying: "Applying…",
    lastOperationFailed: "Last operation failed",
    neverChecked: "No check yet",
    allUpToDate: (time: string) => `Everything up to date — checked at ${time}`,
    updatesSummary: (count: number, detail: string) =>
      count === 1
        ? `1 update: ${detail}`
        : `${count} updates: ${detail}`,
    sharedInputsDetail: "shared nixpkgs inputs",
  },

  notifications: {
    title: (count: number) =>
      count === 1 ? "1 update available" : `${count} updates available`,
    view: "View",
    flakeInputs: "flake inputs",
  },

  toasts: {
    checkDoneUpToDate: "Check complete: everything up to date",
    checkDoneUpdates: (count: number) =>
      count === 1
        ? "Check complete: 1 update available"
        : `Check complete: ${count} updates available`,
    checkFailed: (message: string) => `Check failed: ${message}`,
    preparedChanges: (count: number) =>
      count === 1
        ? "Prepared: 1 affected package"
        : `Prepared: ${count} affected packages`,
    preparedNoChanges: "Prepared: nothing would change",
    prepareFailed: (message: string) => `Prepare failed: ${message}`,
    applySucceeded: "Update applied successfully",
    applyFailed: (message: string) => `Apply failed: ${message}`,
    generationReactivated: (id: number) => `Generation ${id} reactivated`,
    rollbackFailed: (id: number, message: string) =>
      `Failed to reactivate generation ${id}: ${message}`,
    appSaved: (id: string) => `App "${id}" saved`,
    appRemoved: (id: string) => `App "${id}" removed`,
    homeConfigDetected: (name: string) => `Detected configuration: "${name}"`,
    homeConfigNotFound: (
      "No homeConfigurations found in the flake — using the system user as a guess"
    ),
    homeConfigAmbiguous: (names: string) =>
      `Several configurations found (${names}) — pick the right one below`,
  },

  settings: {
    title: "Settings",

    generalTab: "General",
    flakeLocationTitle: "Flake location",
    flakeLocationDescription:
      "Folder holding your home-manager flake.nix and flake.lock.",
    flakeDirEntry: "home-manager flake directory",
    chooseFolder: "Choose folder",
    folderDialogTitle: "Choose the flake folder",
    homeConfigTitle: "Home Manager configuration",
    homeConfigDescription:
      'Must match exactly the key used in your flake.nix: what you type here becomes "homeConfigurations.NAME" in the nix eval run by Prepare. Getting it wrong makes Prepare fail.',
    homeConfigEntry: "Configuration name",
    detectHomeConfig: "Detect automatically",

    languageTitle: "Language",
    languageDescription:
      "Takes effect after restarting the app.",
    languageEntry: "Interface language",
    languageSystem: "System language",
    languageChanged: "Language changed — restart the app to apply",

    catalogTab: "Catalog",
    catalogTitle: "App catalog",
    catalogDescription:
      'Apps with their own flake input, individually updatable on the Apps tab. Apps following the "inputs.NAME.packages.${pkgs.system}.default" pattern inside home.packages already show up there on their own — only register here what does not follow that pattern.',
    addApp: "Add app",
    edit: "Edit",
    newApp: "New app",
    save: "Save",
    removeApp: "Remove app",
    removeHeading: "Remove app?",
    removeBody: (label: string) =>
      `"${label}" will be dropped from the catalog. This does not undo on its own.`,
    unnamed: "(unnamed)",
    cancel: "Cancel",
    remove: "Remove",

    fieldId: "id — unique, no spaces (required)",
    fieldInput: "Flake input providing the package (required)",
    fieldLabel: "Display name (optional — uses the id if left blank)",
    fieldIcon: "GTK theme icon (optional — uses a generic one if left blank)",
    fieldAttr: "Attribute inside the input (optional)",
    fieldStoreNames: "Store names, comma separated (optional)",
    idRequired: "The id field is required",
    inputRequired: 'The "flake input" field is required',
    duplicateId: (id: string) => `An app with id "${id}" already exists`,

    aboutTab: "About",
    aboutTitle: "About and how to use",
    aboutText: `nix-updater is a tray indicator and window to update Home Manager \
selectively, instead of a blind "nixos-rebuild switch".

Package tiers
• Apps — has its own flake input, updates on its own.
• Declared packages — own attribute in home.packages, but follows the \
shared nixpkgs.
• Other packages — installed, but with no identifiable attribute.

Prepare/Apply are two independent flows:
• Granular (Apps and Inputs tabs) — uses the checked boxes.
• General (Packages tab) — ignores the granular selection, always takes \
every input without an owning app (nixpkgs, home-manager, nix-flatpak...).

History only reactivates old home-manager generations — it takes no part in \
the Prepare/Apply flow.

flake.lock backups live in $XDG_STATE_HOME/nix-updater/backups/, one per \
Prepare. Any Prepare failure restores the lock on its own; profile rollback \
(Reactivate) and lock reversal are separate operations.

Platform: this application only runs on x86_64-linux — there is no planned \
support for other architectures.`,
  },

  about: {
    comments: (system: string) =>
      "Selective Home Manager updates: checks, builds and activates only the " +
      `chosen inputs, instead of everything at once.\n\nPlatform: ${system}.`,
  },

  errors: {
    unsupportedPlatform: (arch: string) =>
      `nix-updater: only runs on x86_64-linux (detected architecture: ${arch}).`,
    operationInProgress: "an update operation is already in progress",
    staleLock:
      "flake.lock changed since the last check — check again before applying",
    commandFailed: (command: string, status: number, stderr: string) =>
      `${command} failed (status ${status}): ${stderr}`,
    cannotRead: (path: string) => `could not read ${path}`,
    buildFailed: (status: number) => `build failed (status ${status})`,
    activationFailed: (status: number) => `activation failed (status ${status})`,
    rollbackFailed: (status: number) => `rollback failed (status ${status})`,
  },

  log: {
    failed: (message: string) => `! failed: ${message}`,
    restoringLock: (backup: string) => `! restoring flake.lock from ${backup}`,
    unselectedChanges: (inputs: string) =>
      `! inputs changed without being selected (transitive effect): ${inputs}`,
    allInputs: "(all)",
    validating: "$ nix eval (validation)",
  },

  cli: {
    appsHeader: "Apps (individually updatable)",
    declaredHeader: "Declared packages (home.packages, own attribute)",
    inputsHeader: "Flake inputs",
    sharedCount: (count: number) => `Other packages (shared nixpkgs): ${count}`,
    updatesAvailable: (count: number) => `Updates available: ${count}`,
    lockAlreadyHas: (candidate: string) => `(lock already has ${candidate})`,
  },

  ipc: {
    ok: "ok",
    updateCount: (count: number) =>
      count === 1 ? "1 update" : `${count} updates`,
    nothingSelected: "(nothing selected)",
    failed: "failed",
    applied: "applied",
    quitting: "quitting",
    help: "commands: check | select [inputs…] | prepare | apply | toggle | settings | status | quit",
  },
}

// Sem `as const`: as strings precisam alargar para `string`, senão cada
// tradução seria obrigada a repetir o literal em inglês.
export type Messages = typeof en
