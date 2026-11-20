import type { Messages } from "./en"

export const es: Messages = {
  app: {
    name: "Nix Updater",
    windowTitle: "Actualizaciones",
    menu: "Menú",
    settings: "Configuración",
    about: "Acerca de Nix Updater",
  },

  tabs: {
    apps: "Aplicaciones",
    packages: "Paquetes",
    inputs: "Entradas",
    history: "Historial",
  },

  actions: {
    check: "Buscar actualizaciones",
    prepare: "Preparar",
    apply: "Aplicar",
    prepareGranularTooltip:
      "Actualiza las entradas seleccionadas y compila, sin activar",
    prepareAllTooltip:
      "Actualiza todas las entradas sin aplicación dedicada y compila, sin activar",
  },

  status: {
    updateAvailable: "actualización",
    pendingApply: "lock sin aplicar",
    upToDate: "al día",
    unknown: "desconocido",
    error: "error",
    unknownVersion: "versión desconocida",

    checking: "Comprobando…",
    building: "Compilando…",
    applying: "Aplicando…",
    failed: "Falló",
    applied: "Aplicado",
    readyToApply: "Listo para aplicar",
    nothingSelected: "Nada seleccionado",
    selectedCount: (count) =>
      count === 1 ? "1 seleccionado" : `${count} seleccionados`,
    everythingUpToDate: "Todo al día",
    sharedPending: (count) =>
      count === 1
        ? "1 entrada compartida con actualización"
        : `${count} entradas compartidas con actualizaciones`,
  },

  apps: {
    title: "Aplicaciones",
    description:
      "Cada una viene de su propia entrada del flake, así que puede actualizarse por separado.",
    lockAhead: (installed, candidate) =>
      `${installed} (el lock ya tiene ${candidate})`,
  },

  inputs: {
    title: "Entradas del flake",
    description:
      "Revisión fijada en flake.lock y la revisión candidata. Que una entrada cambie no significa, necesariamente, una versión nueva de alguna aplicación.",
  },

  packages: {
    declaredTitle: "Paquetes declarados",
    declaredDescription:
      "Atributo propio en home.packages, pero sin entrada dedicada — la versión se identifica por paquete, mientras que la actualización viene de la entrada 'nixpkgs' completa (botón Preparar/Aplicar de esta pestaña).",
    sharedTitle: "Otros paquetes",
    sharedDescription: (count) =>
      `${count} paquetes siguen el nixpkgs compartido — se actualizan todos juntos, por la entrada "nixpkgs".`,
    filterPlaceholder: "Filtrar paquetes",
  },

  history: {
    changesTitle: "Paquetes afectados",
    nothingBuilt: "Nada compilado todavía.",
    added: (version) => `nuevo: ${version}`,
    removed: (version) => `eliminado: ${version}`,
    generationsTitle: "Generaciones de Home Manager",
    generationsDescription:
      "La reversión reactiva una generación anterior. Revertir el flake.lock es una operación aparte, desde una copia de seguridad.",
    generation: (id) => `Generación ${id}`,
    active: "activa",
    reactivate: "Reactivar",
    logTitle: "Registro",
    noLog: "Sin registro todavía.",
  },

  tray: {
    open: "Abrir",
    quit: "Salir",
    checkingUpdates: "Buscando actualizaciones…",
    buildingConfig: "Compilando la nueva configuración…",
    applying: "Aplicando…",
    lastOperationFailed: "Falló la última operación",
    neverChecked: "Aún sin comprobaciones",
    allUpToDate: (time) => `Todo actualizado — comprobado a las ${time}`,
    updatesSummary: (count, detail) =>
      count === 1
        ? `1 actualización: ${detail}`
        : `${count} actualizaciones: ${detail}`,
    sharedInputsDetail: "entradas del nixpkgs compartido",
  },

  notifications: {
    title: (count) =>
      count === 1
        ? "1 actualización disponible"
        : `${count} actualizaciones disponibles`,
    view: "Ver",
    flakeInputs: "entradas del flake",
  },

  toasts: {
    checkDoneUpToDate: "Comprobación completa: todo al día",
    checkDoneUpdates: (count) =>
      count === 1
        ? "Comprobación completa: 1 actualización disponible"
        : `Comprobación completa: ${count} actualizaciones disponibles`,
    checkFailed: (message) => `Error al comprobar: ${message}`,
    preparedChanges: (count) =>
      count === 1
        ? "Preparado: 1 paquete afectado"
        : `Preparado: ${count} paquetes afectados`,
    preparedNoChanges: "Preparado: nada cambiaría",
    prepareFailed: (message) => `Error al preparar: ${message}`,
    applySucceeded: "Actualización aplicada correctamente",
    applyFailed: (message) => `Error al aplicar: ${message}`,
    generationReactivated: (id) => `Generación ${id} reactivada`,
    rollbackFailed: (id, message) =>
      `Error al reactivar la generación ${id}: ${message}`,
    appSaved: (id) => `Aplicación "${id}" guardada`,
    appRemoved: (id) => `Aplicación "${id}" eliminada`,
    homeConfigDetected: (name) => `Configuración detectada: "${name}"`,
    homeConfigNotFound:
      "No se encontró homeConfigurations en el flake — usando el usuario del sistema como suposición",
    homeConfigAmbiguous: (names) =>
      `Se encontraron varias configuraciones (${names}) — elige la correcta abajo`,
  },

  settings: {
    title: "Configuración",

    generalTab: "General",
    flakeLocationTitle: "Ubicación del flake",
    flakeLocationDescription:
      "Carpeta donde están el flake.nix y el flake.lock de tu home-manager.",
    flakeDirEntry: "Directorio del flake de home-manager",
    chooseFolder: "Elegir carpeta",
    folderDialogTitle: "Elegir la carpeta del flake",
    homeConfigTitle: "Configuración de Home Manager",
    homeConfigDescription:
      'Debe coincidir exactamente con la clave usada en tu flake.nix: lo que escribas aquí se convierte en "homeConfigurations.NOMBRE" en el nix eval de Preparar. Equivocarse hace que Preparar falle.',
    homeConfigEntry: "Nombre de la configuración",
    detectHomeConfig: "Detectar automáticamente",

    languageTitle: "Idioma",
    languageDescription: "Se aplica al reiniciar la aplicación.",
    languageEntry: "Idioma de la interfaz",
    languageSystem: "Idioma del sistema",
    languageChanged:
      "Idioma cambiado — reinicia la aplicación para aplicarlo",

    catalogTab: "Catálogo",
    catalogTitle: "Catálogo de aplicaciones",
    catalogDescription:
      'Aplicaciones con entrada propia en el flake, actualizables por separado en la pestaña Aplicaciones. Las que siguen el patrón "inputs.NOMBRE.packages.${pkgs.system}.default" dentro de home.packages ya aparecen allí solas — registra aquí solo lo que no siga ese patrón.',
    addApp: "Añadir aplicación",
    edit: "Editar",
    newApp: "Nueva aplicación",
    save: "Guardar",
    removeApp: "Eliminar aplicación",
    removeHeading: "¿Eliminar la aplicación?",
    removeBody: (label) =>
      `"${label}" saldrá del catálogo. Esto no se deshace solo.`,
    unnamed: "(sin nombre)",
    cancel: "Cancelar",
    remove: "Eliminar",

    fieldId: "id — único, sin espacios (obligatorio)",
    fieldInput: "Entrada del flake que provee el paquete (obligatorio)",
    fieldLabel: "Nombre mostrado (opcional — usa el id si se deja vacío)",
    fieldIcon:
      "Icono del tema GTK (opcional — usa uno genérico si se deja vacío)",
    fieldAttr: "Atributo dentro de la entrada (opcional)",
    fieldStoreNames: "Nombres en la store, separados por comas (opcional)",
    idRequired: "El campo id es obligatorio",
    inputRequired: 'El campo "entrada del flake" es obligatorio',
    duplicateId: (id) => `Ya existe una aplicación con id "${id}"`,

    aboutTab: "Acerca de",
    aboutTitle: "Acerca de y cómo usar",
    aboutText: `nix-updater es un indicador de bandeja y una ventana para actualizar Home \
Manager de forma selectiva, en vez de un "nixos-rebuild switch" a ciegas.

Niveles de paquetes
• Aplicaciones — tienen entrada propia en el flake, se actualizan solas.
• Paquetes declarados — atributo propio en home.packages, pero siguen el \
nixpkgs compartido.
• Otros paquetes — instalados, pero sin atributo identificable.

Preparar/Aplicar son dos flujos independientes:
• Granular (pestañas Aplicaciones y Entradas) — usa las casillas marcadas.
• General (pestaña Paquetes) — ignora la selección granular, siempre toma \
todas las entradas sin aplicación dueña (nixpkgs, home-manager, nix-flatpak...).

El Historial solo reactiva generaciones antiguas de home-manager — no \
participa del flujo de Preparar/Aplicar.

Las copias del flake.lock están en $XDG_STATE_HOME/nix-updater/backups/, una \
por Preparar. Cualquier fallo en Preparar restaura el lock solo; la reversión \
del perfil (Reactivar) y la del lock son operaciones distintas.

Plataforma: esta aplicación solo funciona en x86_64-linux — no hay soporte \
previsto para otras arquitecturas.`,
  },

  about: {
    comments: (system) =>
      "Actualizaciones selectivas de Home Manager: comprueba, compila y activa " +
      `solo las entradas elegidas, en vez de todo a la vez.\n\nPlataforma: ${system}.`,
  },

  errors: {
    unsupportedPlatform: (arch) =>
      `nix-updater: solo funciona en x86_64-linux (arquitectura detectada: ${arch}).`,
    operationInProgress: "ya hay una operación de actualización en curso",
    staleLock:
      "el flake.lock cambió desde la última comprobación — vuelve a comprobar antes de aplicar",
    commandFailed: (command, status, stderr) =>
      `${command} falló (estado ${status}): ${stderr}`,
    cannotRead: (path) => `no se pudo leer ${path}`,
    buildFailed: (status) => `la compilación falló (estado ${status})`,
    activationFailed: (status) => `la activación falló (estado ${status})`,
    rollbackFailed: (status) => `la reversión falló (estado ${status})`,
  },

  log: {
    failed: (message) => `! falló: ${message}`,
    restoringLock: (backup) => `! restaurando flake.lock desde ${backup}`,
    unselectedChanges: (inputs) =>
      `! entradas cambiadas sin estar seleccionadas (efecto transitivo): ${inputs}`,
    allInputs: "(todas)",
    validating: "$ nix eval (validación)",
  },

  cli: {
    appsHeader: "Aplicaciones (actualizables por separado)",
    declaredHeader: "Paquetes declarados (home.packages, atributo propio)",
    inputsHeader: "Entradas del flake",
    sharedCount: (count) => `Otros paquetes (nixpkgs compartido): ${count}`,
    updatesAvailable: (count) => `Actualizaciones disponibles: ${count}`,
    lockAlreadyHas: (candidate) => `(el lock ya tiene ${candidate})`,
  },

  ipc: {
    ok: "ok",
    updateCount: (count) =>
      count === 1 ? "1 actualización" : `${count} actualizaciones`,
    nothingSelected: "(nada seleccionado)",
    failed: "falló",
    applied: "aplicado",
    quitting: "saliendo",
    help: "comandos: check | select [inputs…] | prepare | apply | toggle | settings | status | quit",
  },
}
