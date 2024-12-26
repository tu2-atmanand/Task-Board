<script lang="ts">
	import type TaskBoard from "main";
	import type { App } from "obsidian";
	import type { taskItem } from "src/interfaces/TaskItemProps";
	import { createEventDispatcher } from "svelte";

	export let task: taskItem;
	export let taskExists: boolean;
	export let filePath: string;
	export let onSave: (updatedTask: taskItem) => void;
	export let onClose: () => void;

	let title = task.title || "";
	let due = task.due || "";
	let tags = task.tags || [];
	let startTime = task.time?.split(" - ")[0] || "";
	let endTime = task.time?.split(" - ")[1] || "";
	let newTime = task.time || "";
	let priority = task.priority || 0;
	let bodyContent = task.body?.join("\n") || "";

	const dispatch = createEventDispatcher();

	function handleSave() {
		const updatedTask = {
			...task,
			title,
			body: bodyContent.split("\n"),
			due,
			tags,
			time: newTime,
			priority,
			filePath,
		};
		onSave(updatedTask);
		onClose();
	}

	console.log("Task I recieved in the modalContent :", task);

	function toggleSubTaskCompletion(index: number) {
		const updatedBodyContent = bodyContent.split("\n");
		updatedBodyContent[index] = updatedBodyContent[index].startsWith(
			"- [x]",
		)
			? updatedBodyContent[index].replace("- [x]", "- [ ]")
			: updatedBodyContent[index].replace("- [ ]", "- [x]");
		bodyContent = updatedBodyContent.join("\n");
	}

	function addNewSubTask() {
		bodyContent = `\t- [ ] New Subtask\n${bodyContent}`;
	}
</script>

<div class="edit-task-modal-content">
	{#if taskExists}
		<h2>Edit Task</h2>
	{:else}
		<h2>Add new task</h2>
	{/if}
	<div>
		<label for="task-title">Title</label>
		<input id="task-title" bind:value={title} />
	</div>

	<div>
		<label for="task-due">Due Date</label>
		<input id="task-due" type="date" bind:value={due} />
	</div>

	<div>
		<label for="task-tags">Tags</label>
		<input
			id="task-tags"
			type="text"
			placeholder="Enter tags"
			on:keypress={(e) => {
				if (e.key === "Enter" && e.currentTarget.value.trim()) {
					tags = [...tags, e.currentTarget.value.trim()];
					e.currentTarget.value = "";
				}
			}}
		/>
		<div>
			{#each tags as tag, index}
				<span class="tag">
					{tag}
					<button on:click={() => tags.splice(index, 1)}>x</button>
				</span>
			{/each}
		</div>
	</div>

	<div>
		<label for="task-body">Body</label>
		<textarea id="task-body" bind:value={bodyContent} rows="10"></textarea>
	</div>

	<div>
		<button on:click={handleSave}>Save</button>
		<button on:click={onClose}>Cancel</button>
	</div>
</div>

<style>
	.edit-task-modal-content {
		padding: 16px;
		background: var(--background-primary);
		border-radius: 8px;
	}
	.tag {
		margin-right: 8px;
		padding: 4px 8px;
		background: var(--accent);
		color: var(--text-on-accent);
		border-radius: 4px;
		display: inline-block;
	}
</style>
