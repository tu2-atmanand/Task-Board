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
	}
	let { columnIndex, activeBoardIndex, colType, data }: props = $props();

	// Update tasks based on props changes
	// $: tasks = { ...tasks };
	let allTasks = $state($allTasksMerged);
	let tasks: taskItem[] = $state([]);

	store.allTasksMerged.subscribe((p) => {
		console.log(
			"allTasksMerged store variable should have been changed...",
		);
		allTasks = p;
	});

	function getTasksToDisplayInColumn() {
		if (allTasks.Pending.length > 0 || allTasks.Completed.length > 0) {
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

	$effect(() => {
		console.log(
			"Column : This effect function should only work when the refreshSignal will update",
		);
		if ($refreshSignal) {
			refreshAllTheColumns();
		}
	});

	onMount(() => {
		console.log("Column : data in allTasks :", allTasks);
		getTasksToDisplayInColumn();
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
