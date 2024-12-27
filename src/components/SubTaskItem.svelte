<script lang="ts">
	import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
	import { plugin, view } from "src/store";
	import { onMount } from "svelte";
	interface Props {
		line: string; // The line to render
		filePath: string;
		padding: string; // Padding for the sub-task
		onChange: (checked: boolean) => void; // Callback for checkbox changes
	}

	let { line, filePath, padding, onChange }: Props = $props();

	let contentDiv: HTMLElement | null = $state(null);

  // State store for checkbox checked state
  let isChecked = $state(line.trim().startsWith('- [x]'));

	// Handle checkbox change
	function handleChange(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		const checked = event.currentTarget.checked;
		console.log(
			"SubTaskItem : I have checked, The subtask is :",
			line,
			"\nline the value is :",
			checked,
		);
		isChecked = checked;
		onChange(checked);
	}

	const renderSubtask = async (el: HTMLElement | null): Promise<void> => {
		if (el) {
			await MarkdownUIRenderer.renderSubtaskText(
				$plugin.app,
				line.replace(/- \[.*?\]/, "").trim(),
				el,
				filePath,
				$view,
			);
		}
	};

	onMount(async () => {
		await renderSubtask(contentDiv);
	});
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
