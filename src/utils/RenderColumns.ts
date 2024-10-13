// src/utils/RenderColumns.ts

import { Dispatch, SetStateAction } from "react";
import {
	taskItem,
	taskJsonMerged,
	tasksJson,
} from "src/interfaces/TaskItemProps";

import TaskBoard from "main";
import moment from "moment";

// Function to refresh tasks in any column by calling this utility function
export const renderColumns = (
	plugin: TaskBoard,
	setTasks: Dispatch<SetStateAction<taskItem[]>>,
	activeBoard: number,
	colType: string,
	data: any,
	allTasks: taskJsonMerged
) => {
	console.log(
		"renderColumns function : This will run as many times as there are columns in the current board -----------"
	);
	// Load tasks from the JSON file
	// const { allTasksWithStatus, pendingTasks, completedTasks } =
	// 	loadTasksProcessed();

	// Call the filter function based on the column's tag and properties
	let tasksToDisplay: taskItem[] = [];
	const pendingTasks = allTasks.Pending;
	const completedTasks = allTasks.Completed;
	// setTasks(tasksToDisplay);

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
			// console.log(
			// 	"Dudate : ",
			// 	dueDate.getTime(),
			// 	"Today : ",
			// 	today.getTime(),
			// 	"The Difference is : ",
			// 	diffDays,
			// 	"For the task : ",
			// 	task.title
			// );

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
		tasksToDisplay = pendingTasks.filter((task) => !task.tag);
	} else if (colType === "namedTag") {
		tasksToDisplay = pendingTasks.filter(
			(task) => task.tag === `#${data.coltag}`
		);
	} else if (colType === "otherTags") {
		tasksToDisplay = pendingTasks.filter(
			(task) => task.tag && task.tag !== data.coltag
		);
	} else if (colType === "completed") {
		const boardConfigs = plugin.settings.data.boardConfigs; // NOTE : I think i will have to use this function only to get the boardConfigs, although, i know its possible to get this from `plugin.settings`.
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
		// tasksToDisplay = sortedCompletedTasks;

		// console.log("The value of Limit for Completed Column : ", tasksLimit);
		// console.log("All Completed taks i have : ", completedTasks);
		// console.log("Tasks to Display : ", tasksToDisplay);
	}

	setTasks(tasksToDisplay);
};
