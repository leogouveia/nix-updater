# nix-updater

A tray indicator and window for updating your [Home Manager](https://github.com/nix-community/home-manager)
packages selectively, instead of updating everything at once.

Built with AGS v3 ([Astal](https://aylur.github.io/astal/) GTK4 + gnim),
TypeScript/TSX, single process. The UI follows GNOME/libadwaita conventions
on purpose — the goal is a small, native-feeling tool, not a dashboard.

![platform](https://img.shields.io/badge/platform-x86__64--linux-blue)
![license](https://img.shields.io/badge/license-MIT-green)

## Why

In Nix, update granularity is determined by the flake *input*, not the
package: a package's version comes from whichever `nixpkgs` revision is
pinned, so "just update Firefox" only makes sense if that package has a
**dedicated input**, or if it has its own attribute in `home.packages` (which
at least lets its version be tracked, even without a dedicated input).

nix-updater surfaces that distinction instead of hiding it:

| Tier | What it is | Control |
|---|---|---|
| **Applications** | packages with a dedicated flake input | checkbox per app — granular |
| **Declared packages** | have their own attribute in `home.packages`, but share `nixpkgs` | no checkbox — move together with whichever input provides them |
| **Other packages** | installed, but no attribute found in your config | no checkbox |

The Applications tier is a catalog you edit in Settings (gear button) — add
an app directly, or import one from any input already in your `flake.lock`
(the search in Settings → Catalog lists packages it provides, if it's a
flake with more than one). Anything with its own input but not registered
here just falls into "Other packages" instead, with no individual version
tracking.

## Scope today

This project currently only understands **Home Manager**: it reads
`home.packages` out of your home-manager modules and drives `flake.lock`
updates + `home-manager switch` through a built flake output. It does not
know about NixOS system configuration, Flatpak, or any other package
manager — see [Roadmap](#roadmap) below.

Only **x86_64-linux** is supported; this is deliberate, not a current
limitation.

## Install

```bash
nix run github:leogouveia/nix-updater
# or
nix build github:leogouveia/nix-updater && ./result/bin/nix-updater
```

There's no systemd service or timer — nix-updater stays a plain binary you
launch. To run it alongside your session, add a `.desktop` entry under
`~/.config/autostart`, or add this flake as an input to your own
home-manager configuration.

## Configuration

Three things are specific to your machine and are editable from the gear
button in the title bar (or via IPC, see below), persisted to
`$XDG_CONFIG_HOME/nix-updater/config.json`:

- **Flake location** — the folder containing your home-manager `flake.nix`/`flake.lock`.
- **Home Manager configuration name** — the key under `homeConfigurations.<this>`
  in your `flake.nix`.
- **Application catalog** — packages with a dedicated input (see table
  above); edit or add entries without recompiling the project.

On first run, the first two are auto-detected: the flake location by
checking common paths (`~/nix-config`, `~/.config/home-manager`,
`~/nixos-config`, `~/dotfiles`), and the configuration name by evaluating
`homeConfigurations` on whatever flake was found. A guess (ambiguous match,
or nothing found) is never saved silently — it only fills the field for you
to confirm in Settings, where a "detect automatically" button re-runs it on
demand.

## The three operations

| Operation | Writes to disk? | What it does |
|---|---|---|
| **Check** | no | asks each input's forge for its current revision (no download), and evaluates a candidate version only for inputs that actually changed |
| **Prepare** | yes (`flake.lock`) | backs up the lock, updates only the selected inputs, builds with `nix build`, and shows the diff via `nvd` |
| **Apply** | yes (the profile) | activates the already-built result — exactly what was shown in the diff |

If **Prepare** fails, `flake.lock` is restored from its backup
(`$XDG_STATE_HOME/nix-updater/backups/<timestamp>/`). Reactivating a
previous generation (History tab) and reverting the lock are separate
operations, as they should be.

Prepare/Apply are **two independent flows** sharing the same build
underneath:

- **Granular** (Applications and Inputs tabs): operates on whichever
  checkboxes are selected.
- **General** (Packages tab): ignores the granular selection on purpose —
  it always targets every input without a dedicated app, since
  "Declared packages"/"Other packages" can't be controlled more finely
  than that.

## Development

```bash
nix develop                     # ags, gjs, GTK4, libadwaita
ags run -g 4 .                  # full app (window + tray)
ags run -g 4 cli.ts             # check only, as text
ags run -g 4 cli.ts -- --json
ags types -d .                  # regenerate @girs types
```

With the app running, everything is reachable over IPC — useful for testing
without clicking, or for scripting a periodic check:

```bash
ags request -i nix-updater check
ags request -i nix-updater select zen-browser vscode-pkgs
ags request -i nix-updater prepare
ags request -i nix-updater apply
ags request -i nix-updater status      # current state as JSON
ags request -i nix-updater toggle
```

## Non-obvious decisions

- **The tray indicator is a hand-written StatusNotifierItem** (`src/tray/sni.ts`).
  `AstalTray` is a *host* — it consumes a tray, it doesn't publish one. The
  item re-registers with the watcher whenever it changes owner; without
  that, the icon disappears on a GNOME Shell restart or extension reload.
- **No `Astal.Window`**: it depends on `gtk4-layer-shell`, which Mutter
  doesn't implement. The window is a plain `Adw.ApplicationWindow`, which
  keeps it identical on GNOME and on a wlroots compositor.
- **D-Bus method returns in GJS have three cases** (`src/tray/sni.ts`): with
  several out-arguments, return an array; with exactly one, return the raw
  value; and a `GLib.Variant` returned as-is becomes the entire reply tuple
  — which is why `GetProperty` builds `"(v)"` explicitly. Getting this wrong
  isn't harmless: an invalid `GetGroupProperties` once took down GNOME's
  entire appindicator extension, recoverable only with a fresh login.
- **Commands always run from an argument array** (`src/core/proc.ts`), never
  through shell string concatenation.
- **Symbolic icons use fill only, no `stroke`**: GTK recolors symbols by
  overriding `fill`; strokes would stay black on a dark panel.
- **`nvd list` doesn't work on the Home Manager profile.** The list of
  installed packages comes from
  `nix-store -q --references .../home-path` instead.
- **A lockfile under `$XDG_RUNTIME_DIR`** prevents preparing and applying at
  the same time, including across separate instances.

## Known limitations

- `ags types` doesn't generate libadwaita types (a fixed list in
  ts-for-gir), so `tsc --noEmit` complains about
  `import Adw from "gi://Adw?version=1"`. The runtime is unaffected; the
  rest of the code passes the type check.
- GNOME's **AppIndicator** extension needs `gjs` on the shell's PATH — and
  specifically the *system* `gjs`, not the flake's (a different glib
  revision makes the flake's `gjs` abort against the session's typelibs).
  Without this, the extension stays `INACTIVE` and no tray icon appears.

## Roadmap

Ideas for where this could go next, roughly in order of how likely they are
to land:

- [ ] Cache remote probes for a short TTL, keyed by the lock's hash — right
      now every check re-queries every input's forge, which costs real
      seconds in the common case where nothing changed.
- [ ] Read-only Flatpak section — `nix-flatpak` already self-updates, so
      this would just surface what's pinned, not control it.
- [ ] NixOS system generations (not just Home Manager) as a second,
      separate history source.
- [ ] A `--dry-run --override-input` preview step between Check and
      Prepare, so a build failure surfaces before `flake.lock` is touched.
- [ ] Package `home.packages` attribute chains deeper than one level
      (`pkgs.pythonPackages.foo`), currently unrecognized by the discovery
      parser.
- [ ] A home-manager module to install and optionally autostart
      nix-updater, instead of wiring the `.desktop` file by hand.

Contributions and issues are welcome — this is a small personal tool shared
in case it's useful to someone else with a similar setup.

## License

[MIT](./LICENSE)
