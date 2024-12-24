// src/utils/RenderColumns.ts

import store, { plugin } from "src/store";
import type { taskItem, taskJsonMerged } from "src/interfaces/TaskItemProps";

import TaskBoard from "main";
import { get } from "svelte/store";

// Function to refresh tasks in any column by calling this utility function
export const renderColumns = (
	activeBoard: number,
	colType: string,
	data: any,
	allTasks: taskJsonMerged
): taskItem[] => {
	const myPlugin = get(plugin);
	// Call the filter function based on the column's tag and properties
	let tasksToDisplay: taskItem[] = [];
	const pendingTasks = allTasks.Pending;
	const completedTasks = allTasks.Completed;

	if (colType === "undated") {
		tasksToDisplay = pendingTasks.filter((task) => !task.due);
	} else if (data.range) {
		const { from, to } = data.range.rangedata;
		tasksToDisplay = pendingTasks.filter((task) => {
			if (!task.due) return false;
			const today = new Date();
			today.setHours(0, 0, 0, 0); // Set time to 00:00
			const dueDate = new Date(task.due);
			dueDate.setHours(0, 0, 0, 0); // Set time to 00:00

			const diffDays = Math.round(
				(dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24)
			);

			if (from < 0 && to === 0) {
				return diffDays < 0;
			} else if (from === 0 && to === 0) {
				return diffDays === 0;
			} else if (from === 1 && to === 1) {
				return diffDays === 1;
			} else if (from === 2 && to === 0) {
				return diffDays >= 2;
			}

			return false;
		});
	} else if (colType === "untagged") {
		tasksToDisplay = pendingTasks.filter((task) => !(task.tags.length > 0));
	} else if (colType === "namedTag") {
		tasksToDisplay = pendingTasks.filter((task) =>
			task.tags.some((tag) => tag === `#${data.coltag}`)
		);
	} else if (colType === "otherTags") {
		tasksToDisplay = pendingTasks.filter(
			(task) => task.tags && task.tags.some((tag) => tag !== data.coltag)
		);
	} else if (colType === "completed") {
		const boardConfigs = myPlugin.settings.data.boardConfigs;
		const completedColumnIndex = boardConfigs[
			activeBoard
		]?.columns.findIndex((column) => column.colType === "completed");
		const tasksLimit =
			boardConfigs[activeBoard]?.columns[completedColumnIndex].data.limit;

		const sortedCompletedTasks = completedTasks.sort((a, b): number => {
			if (a.completed && b.completed) {
				const dateA = new Date(a.completed).getTime();
				const dateB = new Date(b.completed).getTime();
				return dateB - dateA;
			}
			return 0;
		});

		tasksToDisplay = sortedCompletedTasks.slice(0, tasksLimit);
	}

	// store.allTaskItemsToDisplay.set(tasksToDisplay);
	return tasksToDisplay;
};
