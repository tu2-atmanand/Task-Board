// src/utils/RenderColumns.ts

import { Dispatch, SetStateAction } from "react";
import {
	taskItem,
	taskJsonMerged,
} from "src/interfaces/TaskItemProps";

import TaskBoard from "main";

// Function to refresh tasks in any column by calling this utility function
export const renderColumns = (
	plugin: TaskBoard,
	setTasks: Dispatch<SetStateAction<taskItem[]>>,
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
	} else if (columnData.colType === "untagged") {
		tasksToDisplay = pendingTasks.filter((task) => !(task.tags.length > 0));
	} else if (columnData.colType === "namedTag") {
		tasksToDisplay = pendingTasks.filter((task) =>
			task.tags.some((tag) => tag === `#${columnData.coltag}`)
		);
	} else if (columnData.colType === "otherTags") {
		tasksToDisplay = pendingTasks.filter(
			(task) => task.tags && task.tags.some((tag) => tag !== columnData.coltag)
		);
	} else if (columnData.colType === "completed") {
		const boardConfigs = plugin.settings.data.boardConfigs;
		const completedColumnIndex = boardConfigs[
			activeBoard
		]?.columns.findIndex((column) => column.colType === "completed");
		const tasksLimit =
			boardConfigs[activeBoard]?.columns[completedColumnIndex].limit;

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

	setTasks(tasksToDisplay);
};
