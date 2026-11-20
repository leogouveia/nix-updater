import Adw from "gi://Adw?version=1"
import Gtk from "gi://Gtk?version=4.0"
import { For, createComputed } from "ags"
import { t } from "../../../core/i18n"
import { result } from "../../../core/state"
import type { InputStatus } from "../../../core/types"
import HelpButton from "../../components/HelpButton"
import SelectionCheckButton from "../../components/SelectionCheckButton"
import { trackById } from "../../reactivity"

function revisionLabel(input: InputStatus): string {
  return input.changed
    ? `${input.currentRev} → ${input.candidateRev}   (${input.currentDate} → ${input.candidateDate})`
    : `${input.currentRev}   (${input.currentDate})`
}

function InputRow(initial: InputStatus): Gtk.Widget {
  const inputs = createComputed([result], (r) => r?.inputs ?? [])
  const input = trackById(inputs, initial, (i) => i.name)

  return (
    <Adw.ActionRow
      title={initial.name}
      subtitle={createComputed([input], revisionLabel)}
      cssClasses={["monospace"]}
    >
      <SelectionCheckButton
        input={initial.name}
        enabled={createComputed([input], (i) => i.changed)}
      />
    </Adw.ActionRow>
  ) as Gtk.Widget
}

export default function InputsPage(): Gtk.Widget {
  const inputs = createComputed([result], (r) => r?.inputs ?? [])

  return (
    <Adw.PreferencesPage>
      <Adw.PreferencesGroup
        title={t.inputs.title}
        description={t.inputs.description}
        headerSuffix={HelpButton(t.inputs.helpText)}
      >
        <For each={inputs} id={(i: InputStatus) => i.name}>
          {(input: InputStatus) => InputRow(input)}
        </For>
      </Adw.PreferencesGroup>
    </Adw.PreferencesPage>
  ) as Gtk.Widget
}
