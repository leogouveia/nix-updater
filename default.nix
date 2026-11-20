# Empacotamento do nix-updater: o `ags bundle` transforma o TSX num único
# arquivo JS executado pelo gjs. O wrapGAppsHook4 injeta os typelibs (GTK4,
# libadwaita) e o loader de SVG — sem ele os ícones não carregam.
{
  lib,
  stdenv,
  ags,
  astal4,
  astal-io,
  glib,
  gtk4,
  libadwaita,
  librsvg,
  gdk-pixbuf,
  makeWrapper,
  makeDesktopItem,
  wrapGAppsHook4,
  gobject-introspection,
  nix,
  home-manager,
  nvd,
  # Sondagem dos inputs: a API da forja via curl, com git ls-remote de reserva.
  curl,
  git,
}:

let
  # Precisa casar com o applicationId do AGS ("io.Astal." + instanceName),
  # senão as notificações do Gio não aparecem. O ícone do app leva o mesmo
  # nome: é assim que o shell casa a janela com o ícone.
  appId = "io.Astal.nix-updater";

  desktopItem = makeDesktopItem {
    name = appId;
    desktopName = "Atualizações";
    comment = "Atualizações do Home Manager";
    exec = "nix-updater";
    icon = appId;
    categories = [ "System" "Settings" ];
    startupNotify = false;
    extraConfig.X-GNOME-UsesNotifications = "true";
  };
in
stdenv.mkDerivation {
  pname = "nix-updater";
  version = "0.1.0";

  src = lib.cleanSourceWith {
    src = ./.;
    filter =
      path: _type:
      let
        base = baseNameOf path;
      in
      base != "node_modules" && base != "@girs" && base != "result";
  };

  nativeBuildInputs = [
    ags
    makeWrapper
    wrapGAppsHook4
    gobject-introspection
  ];

  buildInputs = [
    # O runtime do AGS carrega os typelibs do Astal mesmo sem widgets Astal.
    astal4
    astal-io
    glib
    gtk4
    libadwaita
    librsvg
    gdk-pixbuf
  ];

  buildPhase = ''
    runHook preBuild
    ags bundle app.tsx nix-updater.js --gtk 4 -d "SRC='$out/share/nix-updater'"
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    # O `ags bundle` já emite um lançador auto-contido (payload + gjs); só
    # precisa virar executável e ganhar o PATH das ferramentas que o app chama.
    install -Dm755 nix-updater.js $out/share/nix-updater/nix-updater

    # Tudo vai para o diretório que o app passa como IconThemePath (bandeja)
    # e como "icons" do AGS; o tema hicolor recebe cada um na sua categoria.
    for icon in icons/*.svg; do
      install -Dm644 "$icon" "$out/share/nix-updater/icons/$(basename "$icon")"
    done

    # Ícones de status (bandeja): é em "status" que o host do appindicator
    # resolve o IconName sem depender do IconThemePath.
    for icon in icons/nix-updater-*.svg; do
      name=$(basename "$icon")
      install -Dm644 "$icon" "$out/share/icons/hicolor/scalable/status/$name"
    done

    # Ícone do aplicativo (janela, lançador, AboutDialog) — categoria "apps",
    # não "status": é onde o shell procura pelo ícone de um .desktop.
    install -Dm644 "icons/${appId}.svg" \
      "$out/share/icons/hicolor/scalable/apps/${appId}.svg"

    makeWrapper $out/share/nix-updater/nix-updater $out/bin/nix-updater \
      --prefix PATH : ${lib.makeBinPath [ nix home-manager nvd curl git ]}

    runHook postInstall
  '';

  # O .desktop vem do makeDesktopItem para não depender de heredoc no build.
  postInstall = ''
    mkdir -p $out/share/applications
    cp ${desktopItem}/share/applications/*.desktop $out/share/applications/
  '';

  meta = {
    description = "Indicador e gerenciador de atualizações seletivas do Home Manager";
    mainProgram = "nix-updater";
    # Travado de propósito: ver SYSTEM em src/core/registry.ts.
    platforms = [ "x86_64-linux" ];
  };
}
