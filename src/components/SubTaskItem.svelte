<script lang="ts">
	import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
	import { store } from "src/shared.svelte";
	import { onMount } from "svelte";
	interface Props {
		line: string; // The line to render
		filePath: string;
		padding: string; // Padding for the sub-task
		onChange: (checked: boolean) => void; // Callback for checkbox changes
	}

	let { line, filePath, padding, onChange }: Props = $props();

	let contentDiv: HTMLElement | null = $state(null);
	let isChecked = $state(line.trim().startsWith("- [x]"));

	// Handle checkbox change
	function handleChange(
		event: Event & { currentTarget: EventTarget & HTMLInputElement },
	) {
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
		const myPlugin = store.plugin;
		if (el && myPlugin && store.view) {
			await MarkdownUIRenderer.renderSubtaskText(
				myPlugin.app,
				line.replace(/- \[.*?\]/, "").trim(),
				el,
				filePath,
				store.view,
			);
		}
	};

	onMount(async () => {
		await renderSubtask(contentDiv);
	});
</script>

<div class="taskItemBodySubtaskItem" style="padding-left: {padding}">
	<input type="checkbox" bind:checked={isChecked} onchange={handleChange} />
	<div
		class="subtaskTextRenderer"
		bind:this={contentDiv}
		role="presentation"
	></div>
</div>
