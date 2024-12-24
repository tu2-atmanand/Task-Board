<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from "svelte";
	import { FaTimes, FaTrash } from "svelte/fa";
	import { t } from "src/utils/lang/helper";
	import {
		extractBody,
		extractCompletionDate,
		extractDueDate,
		extractPriority,
		extractTags,
		extractTime,
		extractTitle,
	} from "src/utils/ScanningVault";
	import { taskElementsFormatter } from "src/utils/TaskItemUtils";
	import {
		priorityOptions,
		type taskItem,
	} from "src/interfaces/TaskItemProps";
	import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
	import { hookMarkdownLinkMouseEventHandlers } from "src/services/MarkdownHoverPreview";

	export let app;
	export let plugin;
	export let task: taskItem = {
		id: 0,
		title: "",
		body: [],
		due: "",
		tags: [],
		time: "",
		priority: 0,
		completed: "",
		filePath: "",
	};
	export let taskExists = false;
	export let filePath = "";
	export let onSave: (updatedTask: taskItem) => void;

	let title = task.title || "";
	let due = task.due || "";
	let tags: string[] = task.tags || [];
	let startTime = task.time?.split(" - ")[0] || "";
	let endTime = task.time?.split(" - ")[1] || "";
	let newTime = task.time || "";
	let priority = task.priority || 0;
	let bodyContent = task.body?.join("\n") || "";

	let activeTab: "preview" | "editor" = "preview";
	let isCtrlPressed = false;
	let previewContainerRef: HTMLDivElement;

	const dispatch = createEventDispatcher();

	// Update end time when start time changes
	$: if (startTime) {
		const [hours, minutes] = startTime.split(":");
		const newEndTime = `${String(Number(hours) + 1).padStart(2, "0")}:${minutes}`;
		endTime = newEndTime;
		newTime = `${startTime} - ${newEndTime}`;
	}

	// Helper to toggle subtask completion
	const toggleSubTaskCompletion = (index: number) => {
		const updatedBodyContent = bodyContent.split("\n");
		updatedBodyContent[index] = updatedBodyContent[index].startsWith(
			"- [x]",
		)
			? updatedBodyContent[index].replace("- [x]", "- [ ]")
			: updatedBodyContent[index].replace("- [ ]", "- [x]");
		bodyContent = updatedBodyContent.join("\n");
	};

	const removeSubTask = (index: number) => {
		const updatedSubTasks = bodyContent
			.split("\n")
			.filter((_, idx) => idx !== index);
		bodyContent = updatedSubTasks.join("\n");
	};

	const addNewSubTask = () => {
		const updatedBodyContent = bodyContent.split("\n");
		bodyContent = [`\t- [ ] ${t(166)}`, ...updatedBodyContent].join("\n");
	};

	const updateSubTaskContent = (index: number, value: string) => {
		const updatedBodyContent = bodyContent.split("\n");
		updatedBodyContent[index] = `\t- [ ] ${value}`;
		bodyContent = updatedBodyContent.join("\n");
	};

	const handleTagInput = (e: KeyboardEvent) => {
		if (e.key === "Enter") {
			const input = (e.target as HTMLInputElement).value.trim();
			if (!tags.includes(input)) {
				tags = [...tags, input.startsWith("#") ? input : `#${input}`];
				(e.target as HTMLInputElement).value = "";
			}
		}
	};

	const removeTag = (tagToRemove: string) => {
		tags = tags.filter((tag) => tag !== tagToRemove);
	};

	const handleSave = () => {
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
		dispatch("close");
	};

	const parseTaskContent = (content: string) => {
		return {
			...task,
			title: extractTitle(content),
			body: extractBody(content.split("\n"), 1),
			due: extractDueDate(content),
			tags: extractTags(content),
			time: extractTime(content),
			priority: extractPriority(content),
			completed: extractCompletionDate(content),
			filePath: task.filePath,
		};
	};

	onMount(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey) isCtrlPressed = true;
		};
		const handleKeyUp = () => {
			isCtrlPressed = false;
		};
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		const formattedContent = taskElementsFormatter(plugin, task);
		if (previewContainerRef && formattedContent !== "") {
			previewContainerRef.innerHTML = "";
			MarkdownUIRenderer.renderTaskDisc(
				app,
				formattedContent,
				previewContainerRef,
				filePath,
				null,
			);
			hookMarkdownLinkMouseEventHandlers(
				app,
				plugin,
				previewContainerRef,
				filePath,
				filePath,
			);
		}

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	});

	$: subTaskCheckedState = true;
</script>

<div class="EditTaskModalHome">
	<div class="EditTaskModalHomeTitle">
		{taskExists ? t(21) : t(22)}
	</div>
	<div class="EditTaskModalHomeBody">
		<div class="EditTaskModalHomeLeftSec">
			<label>{t(23)}</label>
			<input bind:value={title} />

			<label>{t(24)}</label>
			<div>
				<!-- {#each bodyContent.split("\n") as line, index}
					{#if line.startsWith("\t- [ ]") || line.startsWith("\t- [x]")}
						<div>
							<input
								type="checkbox"
								bind:subTaskCheckedState
								on:change={() => toggleSubTaskCompletion(index)}
							/>
							<input
								type="text"
								value={line.replace(/\t- \[(.)\] /, "")}
								on:input={(e) =>
									updateSubTaskContent(index, e.target.value)}
							/>
							<FaTrash on:click={() => removeSubTask(index)} />
						</div>
					{/if}
				{/each} -->
				<button on:click={addNewSubTask}>{t(4)}</button>
			</div>

			<div>
				<div on:click={() => (activeTab = "preview")}>
					{t(25)}
				</div>
				<div on:click={() => (activeTab = "editor")}>
					{t(26)}
				</div>
			</div>

			{#if activeTab === "preview"}
				<div bind:this={previewContainerRef}></div>
			{:else}
				<textarea bind:value={bodyContent}></textarea>
			{/if}

			<button on:click={handleSave}>{t(1)}</button>
		</div>
		<div class="EditTaskModalHomeRightSec">
			<label>{t(30)}</label>
			<input type="time" bind:value={startTime} />

			<label>{t(31)}</label>
			<input type="time" bind:value={endTime} />

			<label>{t(32)}</label>
			<input type="date" bind:value={due} />

			<label>{t(33)}</label>
			<select bind:value={priority}>
				{#each priorityOptions as option}
					<option value={option.value}>{option.text}</option>
				{/each}
			</select>

			<label>{t(34)}</label>
			<input on:keydown={handleTagInput} placeholder={t(148)} />
			<div>
				{#each tags as tag}
					<span>{tag}<FaTimes on:click={() => removeTag(tag)} /></span
					>
				{/each}
			</div>
		</div>
	</div>
</div>
