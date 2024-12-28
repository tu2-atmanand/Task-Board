<!-- /src/components/Column.svelte -->

<script lang="ts">
	import { onMount } from "svelte";
	import TaskCard from "./TaskCard.svelte";
	import { t } from "../utils/lang/helper";
	import { renderColumns } from "../utils/RenderColumns";
	import type {
		taskItem,
		taskJsonMerged,
	} from "src/interfaces/TaskItemProps";
	import store, {
		allTasksMerged,
		getAllTasksMerged,
		plugin,
		refreshSignal,
	} from "src/store";

	// Component props
	interface props {
		columnIndex: number;
		activeBoardIndex: number;
		colType: string;
		data: any;
		allTasks: taskJsonMerged;
	}
	let { columnIndex, activeBoardIndex, colType, data, allTasks }: props = $props();

	// Update tasks based on props changes
	// $: tasks = { ...tasks };
	// let allTasks = $state($allTasksMerged);
	let tasks: taskItem[] = $state([]);

	// helper functions
	function isTaskAllowed(task: taskItem) {
		if (
			(parseInt(activeBoardConfigs.filterPolarity || "0") === 1 &&
				task.tags.some((tag) =>
					activeBoardConfigs.filters?.includes(tag),
				)) ||
			parseInt(activeBoardConfigs.filterPolarity || "0") === 0
		) {
			return true;
		}

		return false;
	}

	function getTasksToDisplayInColumn() {
		if (allTasks.Pending.length > 0 || allTasks.Completed.length > 0) {
			console.log(
				"getTasksToDisplayInColumn : I hope this is only running on the initial mount and later when the allTasks prop changes ...",
			);
			const tasksToDisplayInColumn = renderColumns(
				activeBoardIndex,
				colType,
				data,
				allTasks,
			);
			tasks = tasksToDisplayInColumn;
			console.log(
				"getTasksToDisplayInColumn : This function will only run at first mount and then when the refreshSignal will update\nFollowing tasks will be shown under each column :",
				tasks,
			);
		}
	}

	function refreshAllTheColumns() {
		getTasksToDisplayInColumn();
		store.refreshSignal.set(false);
	}

	// Learning : This will never, work, becuase, this only refreshes the first column. You will need to update the parent, so all the columns renders again. That is the getTasksToDisplayInColumn() for all columns, so the task moves from one column to another.
	// $effect(() => {
	// 	console.log(
	// 		"Column : This effect function should only work when the refreshSignal will update",
	// 	);
	// 	if ($refreshSignal || activeBoardIndex) {
	// 		allTasks = $allTasksMerged;
	// 		refreshAllTheColumns();
	// 	}
	// });

	// Below is the alternative of using $effect.
	// store.refreshSignal.subscribe((p) => {
	// 	console.log("Column : refreshSignal changed...");
	// 	if ($refreshSignal) {
	// 		allTasks = $allTasksMerged;
	// 		refreshAllTheColumns();
	// 	}
	// });

	onMount(() => {
		console.log("Column : data in allTasks :", allTasks);
		getTasksToDisplayInColumn();
	});

	const columnWidth =
		$plugin.settings.data.globalSettings.columnWidth || "273px";
	const activeBoardConfigs =
		$plugin.settings.data.boardConfigs[activeBoardIndex];
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
					<TaskCard {task} {columnIndex} {activeBoardConfigs} />
				{/if}
			{/each}
		{:else}
			<p>{t(7)}</p>
		{/if}
	</div>
</div>
