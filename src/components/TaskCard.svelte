<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import {
		handleCheckboxChange,
		handleDeleteTask,
		handleEditTask,
		handleSubTasksChange,
	} from "../utils/handleTaskEvents";
	import { type taskItem } from "../interfaces/TaskItemProps";
	import { priorityEmojis } from "../interfaces/TaskItemProps";
	import {
		taskBoardSettings,
		plugin,
		app,
		view,
		refreshSignal,
	} from "src/store";
	import type { Board } from "src/interfaces/BoardConfigs";
	import SubTaskItem from "./SubTaskItem.svelte";
	import { EditButtonMode } from "src/interfaces/GlobalSettings";
	import { Edit, Trash } from "lucide-svelte";
	import {
		hookMarkdownLinkMouseEventHandlers,
		markdownButtonHoverPreviewEvent,
	} from "src/services/MarkdownHoverPreview";
	import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
	// import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	// import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';

	interface Props {
		task: taskItem;
		columnIndex: number;
		activeBoardConfigs: Board;
	}

	let { task, columnIndex, activeBoardConfigs }: Props = $props();

	let taskIdKey = $state(task.id);
	let isChecked = $state(task.completed !== "" ? true : false);
	let taskTitle = $state(task.title);
	let taskBody = $state(task.body);
	let taskDesc = $state(
		task.body.filter(
			(line) =>
				!line.trim().startsWith("- [ ]") &&
				!line.trim().startsWith("- [x]"),
		),
	);

	let taskTitleElement: HTMLElement | null = $state(null);
	let isDescriptionExpanded = $state(false);
	let descriptionHeight: string = $state("0px"); // Dynamically controls the height for animation
	let descriptionBodyDiv: HTMLElement | null = $state(null);
	let descriptionDiv: HTMLElement | null = $state(null);

	const getColorIndicator = () => {
		const today = new Date();
		const taskDueDate = new Date(task.due);
		if (taskDueDate.toDateString() === today.toDateString()) {
			return "var(--color-yellow)";
		} else if (taskDueDate > today) {
			return "var(--color-green)";
		} else if (taskDueDate < today) {
			return "var(--color-red)";
		}
		return "grey";
	};

	// Toggles the description's expanded state
	const toggleDescription = () => {
		isDescriptionExpanded = !isDescriptionExpanded;

		if (descriptionBodyDiv) {
			if (isDescriptionExpanded) {
				// Set the height to its scrollHeight for animation
				descriptionHeight = `${descriptionBodyDiv.scrollHeight}px`;
			} else {
				// Collapse by setting height to 0
				descriptionHeight = "0px";
			}
		}
	};

	const handleSubtaskCheckboxChange = (
		index: number,
		isCompleted: boolean,
	) => {
		console.log(
			"handleSubtaskCheckboxChange : The index and isCompleted :",
			index,
			isCompleted,
		);
		const updatedBody = taskBody.map((line, idx) => {
			if (idx === index) {
				return isCompleted
					? line.replace("- [x]", "- [ ]")
					: line.replace("- [ ]", "- [x]");
			}
			return line;
		});
		taskBody = updatedBody;
		handleSubTasksChange({ ...task, body: updatedBody });
	};

	const defaultTagColor = "var(--default-tag-color)";
	// Function to get the color of a tag
	function getTagColor(tag: string) {
		const customTagColor =
			$plugin.settings.data.globalSettings.tagColors?.[
				tag.replace("#", "")
			];
		return customTagColor || defaultTagColor;
	}

	// Function to get the border color of a tag
	function getTagBorderColor(tag: string) {
		const tagColor = getTagColor(tag);
		return tagColor ? hexToRgba(tagColor, 0.5) : "var(--tag-color-hover)";
	}

	// Function to get the background color of a tag
	function getTagBackgroundColor(tag: string) {
		const customTagColor =
			$plugin.settings.data.globalSettings.tagColors?.[
				tag.replace("#", "")
			];
		return customTagColor
			? hexToRgba(customTagColor, 0.1) // 10% opacity background
			: "var(--tag-background)";
	}

	// Helper function to convert a hex color to an RGBA string with the specified opacity
	const hexToRgba = (hex: string, opacity: number): string => {
		let r = 0,
			g = 0,
			b = 0;

		if (hex.length === 4) {
			r = parseInt(hex[1] + hex[1], 16);
			g = parseInt(hex[2] + hex[2], 16);
			b = parseInt(hex[3] + hex[3], 16);
		} else if (hex.length === 7 || hex.length === 9) {
			r = parseInt(hex[1] + hex[2], 16);
			g = parseInt(hex[3] + hex[4], 16);
			b = parseInt(hex[5] + hex[6], 16);
		}

		return `rgba(${r},${g},${b},${opacity})`;
	};

	// Utility to determine whether to show a tag
	function showTag(tag: string) {
		const column = activeBoardConfigs.columns[columnIndex];

		// Check if tag matches column tag and should be hidden
		if (
			!activeBoardConfigs.showColumnTags &&
			column.colType === "namedTag" &&
			tag === column.data.coltag
		) {
			return false;
		}

		// Check if tag is in filtered tags and should be hidden
		if (
			!activeBoardConfigs.showFilteredTags &&
			activeBoardConfigs.filters?.includes(tag) &&
			parseInt(activeBoardConfigs.filterPolarity || "0")
		) {
			return false;
		}

		return true;
	}

	// Check if the line is a subtask
	function isSubTask(line: string) {
		return line.trim().startsWith("- [");
	}

	function getSubTaskPadding(line: string) {
		const numTabs = line.match(/^\t+/)?.[0].length || 0;
		return numTabs > 1 ? `${(numTabs - 1) * 15}px` : "0px";
	}

	function isSubTaskChecked(line: string) {
		if (line.trim().startsWith("- [x]")) return true;

		return false;
	}

	function isTaskChecked() {
		return task.completed || isChecked;
	}

	const onEditButtonClicked = (event: MouseEvent) => {
		if (
			$taskBoardSettings.editButtonAction !== EditButtonMode.NoteInHover
		) {
			handleEditTask(task);
		} else {
			// event.ctrlKey = true;
			markdownButtonHoverPreviewEvent($app, event, task.filePath);
			// event.ctrlKey = false;
		}
	};

	const renderTitleAndDescription = async (
		el: HTMLElement | null,
		data: string,
	): Promise<void> => {
		if (el) {
			el.empty();
			// Call the MarkdownUIRenderer to render the description
			MarkdownUIRenderer.renderTaskDisc(
				$app,
				data,
				el,
				task.filePath,
				$view,
			);

			// // Add event handlers for markdown links
			// hookMarkdownLinkMouseEventHandlers(
			// 	$app,
			// 	$plugin,
			// 	element,
			// 	task.filePath,
			// 	task.filePath,
			// );
		}
	};

	// // Reactive function to regenerate the task title
	// $effect(() => {
	// 	console.log("TaskCard : Should only run when taskTitle changes...");
	// 	if (taskTitle) {
	// 		renderTitleAndDescription(taskTitleElement, taskTitle);
	// 	}
	// });

	// // Reactive function to regenerate the task Description
	// $effect(() => {
	// 	console.log("TaskCard : Should only run when taskDesc changes...");
	// 	if (taskDesc) {
	// 		renderTitleAndDescription(
	// 			descriptionDiv,
	// 			taskDesc.join("\n").trim(),
	// 		);
	// 	}
	// });

	function refreshTaskCard() {
		taskTitle = task.title;
		taskBody = task.body;
		taskDesc = task.body.filter(
			(line) =>
				!line.trim().startsWith("- [ ]") &&
				!line.trim().startsWith("- [x]"),
		);
		isChecked = task.completed !== "" ? true : false;
		taskIdKey = task.id;
		renderTitleAndDescription(taskTitleElement, taskTitle);
		renderTitleAndDescription(descriptionDiv, taskDesc.join("\n").trim());
	}

	$effect(() => {
		console.log(
			"TaskCard : Should only run when prop task changes from the parent component...",
		);
		// if ($refreshSignal) refreshTaskCard();
	});

	onMount(() => {
		// MY NOTES : Okay, so what I have understood of svelte, if you pass the data from the parent component, this compoenent wont render again and again. Because, right now whenever the tasksJsonMerged data is changed after you update the parent note, the TaskCard component do not re-renders, otherwise the $effect function should have again ran. So, the best idea will be to calculate the data of createTaskDescription() function in the Column.svelte and then send it as a prop. That is somehow I have to keep the output of the Obsidian.MarkdownRenderer() function.
		console.log(
			"I hope this is running, only at the initial mount of the component...",
		);
		renderTitleAndDescription(taskTitleElement, taskTitle);
		renderTitleAndDescription(descriptionDiv, taskDesc.join("\n").trim());
		if (descriptionBodyDiv) {
			descriptionHeight = isDescriptionExpanded
				? `${descriptionBodyDiv.scrollHeight}px`
				: "0px";
		}
	});
</script>

<div class="taskItem" id={taskIdKey.toString()}>
	<div
		class="colorIndicator"
		style="background-color: {getColorIndicator()}"
	></div>
	<div class="taskItemMainContent">
		{#if $plugin.settings.data.globalSettings.showHeader}
			<div class="taskItemHeader">
				<div class="taskItemHeaderLeft">
					<div class="taskItemPrio">
						{task.priority > 0
							? priorityEmojis[task.priority as number]
							: ""}
					</div>
					<div class="taskItemTags">
						{#each task.tags as tag}
							{#if showTag(tag)}
								<div
									class="taskItemTag"
									style="color: {getTagColor(
										tag,
									)}; border: 1px solid {getTagBorderColor(
										tag,
									)}; background-color: {getTagBackgroundColor(
										tag,
									)}"
								>
									{tag}
								</div>
							{/if}
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<div class="taskItemMainBody">
			<div class="taskItemMainBodyTitleNsubTasks">
				<input
					type="checkbox"
					class="taskItemCheckbox"
					bind:checked={isChecked}
					onchange={() => handleCheckboxChange(task)}
				/>
				<div class="taskItemBodyContent">
					<div
						class="taskItemTitle"
						bind:this={taskTitleElement}
						role="presentation"
					></div>
					<div class="taskItemBody">
						{#each task.body as line, index}
							{#if isSubTask(line)}
								<SubTaskItem
									{line}
									filePath={task.filePath}
									padding={getSubTaskPadding(line)}
									onChange={(checked: boolean) =>
										handleSubtaskCheckboxChange(
											index,
											checked,
										)}
								/>
							{/if}
						{/each}
					</div>
				</div>
			</div>
			{#if taskDesc.length > 0}
				<div
					class="taskItemMainBodyDescriptionSectionToggler"
					onclick={toggleDescription}
					onkeydown={(e) => e.key === "Enter" && toggleDescription()}
					role="button"
					tabindex="0"
				>
					{isDescriptionExpanded
						? "Hide Description"
						: "Show Description"}
				</div>
				<div
					bind:this={descriptionBodyDiv}
					style="height: {descriptionHeight};"
					class={`taskItemBodyDescription${isDescriptionExpanded ? "-expanded" : ""}`}
				>
					<div
						class="taskItemBodyDescriptionRenderer"
						bind:this={descriptionDiv}
						role="presentation"
					></div>
				</div>
			{/if}
		</div>

		{#if $taskBoardSettings.showFooter}
			<div class="taskItemFooter">
				<!-- Conditionally render task.completed or the date/time -->
				{#if task.completed}
					<div class="taskItemDateCompleted">✅ {task.completed}</div>
				{:else}
					<div class="taskItemDate">
						{#if task.time}⏰{task.time}{/if}
						{#if task.time && task.due}
							|
						{/if}
						{#if task.due}📅{task.due}{/if}
					</div>
				{/if}
				<div id="taskItemFooterBtns" class="taskItemFooterBtns">
					<!-- Edit button -->
					<div
						class="taskItemiconButton taskItemiconButtonEdit"
						onclick={(event) => onEditButtonClicked(event)}
						onkeydown={(e) =>
							e.key === "Enter" && handleDeleteTask(task)}
						tabindex="0"
						aria-label="Edit task"
						role="button"
					>
						<Edit size={16} opacity={0.4} name="Edit task" />
					</div>
					<div
						class="taskItemiconButton taskItemiconButtonDelete"
						onclick={() => handleDeleteTask(task)}
						onkeydown={(e) =>
							e.key === "Enter" && handleDeleteTask(task)}
						tabindex="0"
						aria-label="Delete task"
						role="button"
					>
						<Trash size={16} opacity={0.4} name="Delete task" />
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
