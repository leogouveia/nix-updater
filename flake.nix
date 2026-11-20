{
  description = "nix-updater — indicador e gerenciador de atualizações seletivas do Home Manager";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

    ags = {
      url = "github:Aylur/ags";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      ags,
      ...
    }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
      agsPkgs = ags.packages.${system};
    in
    {
      packages.${system} = {
        nix-updater = pkgs.callPackage ./default.nix {
          ags = agsPkgs.default;
          astal4 = agsPkgs.astal4;
          astal-io = agsPkgs.io;
        };
        default = self.packages.${system}.nix-updater;
      };

      devShells.${system}.default = pkgs.mkShell {
        name = "nix-updater";

        nativeBuildInputs = [
          pkgs.gobject-introspection
          pkgs.pkg-config
        ];

        buildInputs = [
          agsPkgs.default
          agsPkgs.astal4
          agsPkgs.io
          pkgs.gjs
          pkgs.gtk4
          pkgs.libadwaita
          pkgs.glib
        ];

        # O ts-for-gir (usado pelo "ags types") procura os .gir em
        # XDG_DATA_DIRS, e os outputs "dev" não entram lá sozinhos.
        shellHook = ''
          export EXTRA_GIR_DIRS="${pkgs.libadwaita.dev}/share/gir-1.0''${EXTRA_GIR_DIRS:+:$EXTRA_GIR_DIRS}"
        '';
      };
    };
}
