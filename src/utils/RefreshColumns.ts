// src/utils/RefreshColumns.ts

import { Dispatch, SetStateAction } from "react";

import { Task } from "../interfaces/Column";
import { loadTasksFromJson } from "./FileUtils";

// Function to refresh tasks in any column by calling this utility function
export const refreshTasks = (
	setTasks: Dispatch<SetStateAction<Task[]>>,
	colType: string,
	data: any
) => {
	console.log("------ Inside the refreshTasks function -----");
	// Load tasks from the JSON file
	const { allTasksWithStatus, pendingTasks, completedTasks } =
		loadTasksFromJson();

	// Call the filter function based on the column's tag and properties
	const today = new Date();
	let tasksToDisplay: Task[] = [];

	if (colType === "undated") {
		tasksToDisplay = pendingTasks.filter((task) => !task.due);
	} else if (data.range) {
		const { from, to } = data.range.rangedata;
		tasksToDisplay = pendingTasks.filter((task) => {
			if (!task.due) return false;
			const dueDate = new Date(task.due);
			const diffDays =
				Math.floor(
					(dueDate.getTime() - today.getTime()) /
						(1000 * 60 * 60 * 24)
				) + 1;
			// console.log("The Difference in today and due : ", diffDays, "For the task : ", task.body);

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
		tasksToDisplay = completedTasks;
	}

	setTasks(tasksToDisplay);
};
