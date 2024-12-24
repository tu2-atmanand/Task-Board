<script lang="ts">
	import { onMount } from "svelte";
	import TaskCard from "./TaskCard.svelte";
	import { t } from "../utils/lang/helper";
	import { renderColumns } from "../utils/RenderColumns";
	import type {
		taskItem,
		taskJsonMerged,
	} from "src/interfaces/TaskItemProps";
	import { allTaskItemsToDisplay, plugin } from "src/store";

	// Component props
	export let columnIndex: number; // Run the script tomorrow, dont keep doing all this migration manually
	export let activeBoardIndex: number;
	export let colType: string;
	export let data: any;
	export let allTasks: taskJsonMerged = { Pending: [], Completed: [] };

	// Update tasks based on props changes
	// $: tasks = { ...tasks };
	let tasks:taskItem[] = $state([]);
	$: allTasks = { ...allTasks };

	onMount(() => {
		if (allTasks.Pending.length > 0 || allTasks.Completed.length > 0) {
			const tasksToDisplayInColumn = renderColumns(
				activeBoardIndex,
				colType,
				data,
				allTasks,
			);
			tasks = tasksToDisplayInColumn;
		}
	});

	const columnWidth =
		$plugin.settings.data.globalSettings.columnWidth || "273px";
	const activeBoardSettings =
		$plugin.settings.data.boardConfigs[activeBoardIndex];

	function isTaskAllowed(task: taskItem) {
		if (
			(parseInt(activeBoardSettings.filterPolarity || "0") === 1 &&
				task.tags.some((tag) =>
					activeBoardSettings.filters?.includes(tag),
				)) ||
			parseInt(activeBoardSettings.filterPolarity || "0") === 0
		) {
			return true;
		}

		return false;
	}
</script>

<div class="TaskBoardColumnsSection" style="--column-width: {columnWidth}">
	<div class="taskBoardColumnSecHeader">
		<div class="taskBoardColumnSecHeaderTitleSec">
			<div class="columnTitle">{data.name}</div>
		</div>
	</div>
	<div
		class={`tasksContainer${
			$plugin.settings.data.globalSettings.showVerticalScroll ? "" : "-SH"
		}`}
	>
		{#if tasks.length > 0}
			{#each tasks as task, taskKey}
				{#if isTaskAllowed(task)}
					<TaskCard {task} {columnIndex} {activeBoardSettings} />
				{/if}
			{/each}
		{:else}
			<p>{t(7)}</p>
		{/if}
	</div>
</div>
