// src/utils/RenderColumns.ts

import { Dispatch, SetStateAction } from "react";

import { Task } from "../interfaces/Column";
import { loadGlobalSettings } from "./SettingsOperations";
import { loadTasksFromJson } from "./TaskItemUtils";

// Function to refresh tasks in any column by calling this utility function
export const renderColumns = (
	setTasks: Dispatch<SetStateAction<Task[]>>,
	activeBoard: number,
	colType: string,
	data: any
) => {
	console.log("------ Inside the renderColumns function : Only Reading tasks.json -----");
	// Load tasks from the JSON file
	const { allTasksWithStatus, pendingTasks, completedTasks } =
		loadTasksFromJson();

	// Call the filter function based on the column's tag and properties
	let tasksToDisplay: Task[] = [];
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
		const globalSettings = loadGlobalSettings();
		const completedColumnIndex = globalSettings.data.boardConfigs[
			activeBoard
		].columns.findIndex((column) => column.colType === "completed");
		const tasksLimit =
			globalSettings.data.boardConfigs[activeBoard].columns[
				completedColumnIndex
			].data.limit;

		const sortedCompletedTasks = completedTasks.sort((a, b) => {
			const dateA = new Date(a.completed);
			const dateB = new Date(b.completed);
			return dateB.getTime() - dateA.getTime(); // Sort in descending order (newest first)
		});

		tasksToDisplay = sortedCompletedTasks.slice(0, tasksLimit);
		// tasksToDisplay = sortedCompletedTasks;

		// console.log("The value of Limit for Completed Column : ", tasksLimit);
		// console.log("All Completed taks i have : ", completedTasks);
		// console.log("Tasks to Display : ", tasksToDisplay);
	}

	setTasks(tasksToDisplay);
};
