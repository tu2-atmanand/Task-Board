<script lang="ts">
  import { writable } from "svelte/store";
  interface Props {
    line: string; // The line to render
    padding: string; // Padding for the sub-task
    onChange: (checked: boolean) => void; // Callback for checkbox changes
  }

  let { line, padding, onChange }: Props = $props();

  // Writable store for checkbox checked state
  const isChecked = writable(line.trim().startsWith("- [x]"));

  // Handle checkbox change
  function handleChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    isChecked.set(checked);
    onChange(checked);
  }
</script>

<div
  class="taskItemBodySubtaskItem"
  style="padding-left: {padding}"
>
  <input
    type="checkbox"
    bind:checked={$isChecked}
    onchange={handleChange}
  />
  <div class="subtaskTextRenderer">
    {line.replace(/^-\s*\[.\]\s*/, "")}
  </div>
</div>
