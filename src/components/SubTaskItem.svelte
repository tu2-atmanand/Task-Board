<script lang="ts">
	import { Component, MarkdownRenderer } from "obsidian";
	import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
	import { plugin, view } from "src/store";
	import { onMount } from "svelte";
	import { writable } from "svelte/store";
	interface Props {
		line: string; // The line to render
		filePath: string;
		padding: string; // Padding for the sub-task
		onChange: (checked: boolean) => void; // Callback for checkbox changes
	}

	let { line, filePath, padding, onChange }: Props = $props();

	let contentDiv: HTMLElement | null = $state(null);

	// Writable store for checkbox checked state
	const isChecked = writable(line.trim().startsWith("- [x]"));

	// Handle checkbox change
	function handleChange(event: Event) {
		const checked = (event.target as HTMLInputElement).checked;
		console.log(
			"SubTaskItem : I have checked, The subtask is :",
			line,
			"\nline the value is :",
			checked,
		);
		isChecked.set(checked);
		onChange(checked);
	}

	const renderSubtask = async (el: HTMLElement | null): Promise<void> => {
		console.log(
			"renderSubtask: This should not run if subTask do not exists...",
		);
		if (el) {
			console.log("renderSubtask : Is this even running...");
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

<div class="taskItemBodySubtaskItem" style="padding-left: {padding}">
	<input type="checkbox" bind:checked={$isChecked} onchange={handleChange} />
	<div
		class="subtaskTextRenderer"
		bind:this={contentDiv}
		role="presentation"
	></div>
</div>
