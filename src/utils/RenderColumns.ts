// src/utils/RenderColumns.ts

import { Dispatch, SetStateAction } from "react";
import { taskItem, taskJsonMerged } from "src/interfaces/TaskItemProps";

import { ColumnData } from "src/interfaces/BoardConfigs";
import TaskBoard from "main";

// Function to refresh tasks in any column by calling this utility function
export const renderColumns = (
	plugin: TaskBoard,
	// setTasks: Dispatch<SetStateAction<taskItem[]>>,
	activeBoard: number,
	columnData: any,
	allTasks: taskJsonMerged
) => {
	// Call the filter function based on the column's tag and properties
	let tasksToDisplay: taskItem[] = [];
	const pendingTasks = allTasks.Pending;
	const completedTasks = allTasks.Completed;

	if (columnData.colType === "undated") {
		tasksToDisplay = pendingTasks.filter((task) => !task.due);
	} else if (columnData.range) {
		const { from, to } = columnData.range.rangedata;

		tasksToDisplay = pendingTasks.filter((task) => {
			if (!task.due) return false;

			// Get today's date (local time)
			const today = new Date();
			today.setHours(0, 0, 0, 0); // Reset to midnight

			// Get due date in local time and adjust it to midnight
			const dueDate = new Date(task.due);
			const timeZoneOffset = dueDate.getTimezoneOffset() * 60000; // Convert minutes to milliseconds
			const dueDateAdjusted = new Date(
				dueDate.getTime() - timeZoneOffset
			);
			dueDateAdjusted.setHours(0, 0, 0, 0); // Ensure it's midnight

			// Calculate difference in days
			const diffDays = Math.round(
				(dueDateAdjusted.getTime() - today.getTime()) /
					(1000 * 3600 * 24)
			);

			// Handle cases where 'from' is greater than 'to'
			if (from > to) {
				return diffDays >= to && diffDays <= from;
			}

			return diffDays >= from && diffDays <= to;
		});
	} else if (columnData.colType === "untagged") {
		tasksToDisplay = pendingTasks.filter((task) => !(task.tags.length > 0));
	} else if (columnData.colType === "namedTag") {
		tasksToDisplay = pendingTasks.filter((task) =>
			task.tags.some((tag) => tag === `#${columnData.coltag}`)
		);
	} else if (columnData.colType === "otherTags") {
		tasksToDisplay = pendingTasks.filter(
			(task) =>
				task.tags && task.tags.some((tag) => tag !== columnData.coltag)
		);
	} else if (columnData.colType === "completed") {
		const boardConfigs = plugin.settings.data.boardConfigs;
		const completedColumnIndex = boardConfigs[
			activeBoard
		]?.columns.findIndex((column) => column.colType === "completed");
		const tasksLimit =
			boardConfigs[activeBoard]?.columns[completedColumnIndex].limit;

		const sortedCompletedTasks = completedTasks.sort((a, b): number => {
			if (a.completion && b.completion) {
				const dateA = new Date(a.completion).getTime();
				const dateB = new Date(b.completion).getTime();
				return dateB - dateA;
			}
			return 0;
		});

		tasksToDisplay = sortedCompletedTasks.slice(0, tasksLimit);
	}

	// setTasks(tasksToDisplay);
	return tasksToDisplay;
};
