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
	import { Component } from "obsidian";
	import { taskBoardSettings, plugin } from "src/store";
	import type { Board } from "src/interfaces/BoardConfigs";
	import SubTaskItem from "./SubTaskItem.svelte";
	// import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	// import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';

	export let task: taskItem;
	export let columnIndex: number;
	export let activeBoardSettings: Board;

	let isChecked = task.completed !== "" ? true : false;
	let isDescriptionExpanded = false;
	let taskBody = task.body;
	let taskDesc = task.body.filter(
		(line) =>
			!line.trim().startsWith("- [ ]") &&
			!line.trim().startsWith("- [x]"),
	);

	let component: Component | null = null;
	let taskIdKey = `${task.id}`;

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

	const toggleDescription = () => {
		isDescriptionExpanded = !isDescriptionExpanded;
	};

	const handleSubtaskCheckboxChange = (
		index: number,
		isCompleted: boolean,
	) => {
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

	const defaultTagColor = "var(--default-tag-color)"; // Define your default color

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
		const column = activeBoardSettings.columns[columnIndex];

		// Check if tag matches column tag and should be hidden
		if (
			!activeBoardSettings.showColumnTags &&
			column.colType === "namedTag" &&
			tag === column.data.coltag
		) {
			return false;
		}

		// Check if tag is in filtered tags and should be hidden
		if (
			!activeBoardSettings.showFilteredTags &&
			activeBoardSettings.filters?.includes(tag) &&
			parseInt(activeBoardSettings.filterPolarity || "0")
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

	onMount(() => {
		component = new Component();
		component.load();
		return () => component?.unload();
	});
</script>

<div class="taskItem">
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
					on:change={() => handleCheckboxChange(task)}
				/>
				<div class="taskItemBodyContent">
					<div class="taskItemTitle" id={taskIdKey}></div>
					<div class="taskItemBody">
						{#each task.body as line, index}
							{#if isSubTask(line)}
								<SubTaskItem
									{line}
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
					style="opacity: 50%; margin: 0.5em 5px; cursor: pointer"
					on:click={toggleDescription}
					on:keydown={(e) => e.key === "Enter" && toggleDescription()}
					role="button"
					tabindex="0"
				>
					{isDescriptionExpanded
						? "Hide Description"
						: "Show Description"}
				</div>
				<div
					class="taskItemBodyDescription"
					class:expanded={isDescriptionExpanded}
				>
					<div class="taskItemBodyDescriptionRenderer"></div>
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
						on:click={() => handleEditTask(task)}
						on:keydown={(e) =>
							e.key === "Enter" && handleEditTask(task)}
						role="button"
						tabindex="0"
					>
						<!-- <FontAwesomeIcon icon={faEdit} /> -->
					</div>
					<!-- Delete button -->
					<div
						class="taskItemiconButton taskItemiconButtonDelete"
						on:click={() => handleDeleteTask(task)}
						on:keydown={(e) =>
							e.key === "Enter" && handleDeleteTask(task)}
						role="button"
						tabindex="0"
						aria-label="Delete task"
					>
						<!-- <FontAwesomeIcon icon={faTrash} /> -->
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
