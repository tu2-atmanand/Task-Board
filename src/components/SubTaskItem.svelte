<script lang="ts">
  interface Props {
    line: string; // The line to render
    padding: string; // Padding for the sub-task
    onChange: (checked: boolean) => void; // Callback for checkbox changes
  }

  let { line, padding, onChange }: Props = $props();

  // State store for checkbox checked state
  let isChecked = $state(line.trim().startsWith('- [x]'));

  // Handle checkbox change
  function handleChange(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    const checked = event.currentTarget.checked;
    isChecked = checked;
    onChange(checked);
  }
</script>

<div
  class="taskItemBodySubtaskItem"
  style="padding-left: {padding}"
>
  <input
    type="checkbox"
    bind:checked={isChecked}
    onchange={handleChange}
  />
  <div class="subtaskTextRenderer">
    {line.replace(/^-\s*\[.\]\s*/, "")}
  </div>
</div>
