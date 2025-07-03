// src/utils/RenderColumns.ts

import { taskItem, taskJsonMerged } from "src/interfaces/TaskItem";

import TaskBoard from "main";
import { moment as _moment } from "obsidian";
import { ColumnData } from "src/interfaces/BoardConfigs";
import { UniversalDateOptions } from "src/interfaces/GlobalSettings";

// Function to get all tags from a task (both line tags and frontmatter tags)
const getAllTaskTags = (task: taskItem): string[] => {
	const lineTags = task.tags || [];
	const frontmatterTags = task.frontmatterTags || [];
	return [...lineTags, ...frontmatterTags];
};

// Function to refresh tasks in any column by calling this utility function
export const renderColumns = (
	plugin: TaskBoard,
	// setTasks: Dispatch<SetStateAction<taskItem[]>>,
	activeBoard: number,
	columnData: ColumnData,
	allTasks: taskJsonMerged
) => {
	// Call the filter function based on the column's tag and properties
	let tasksToDisplay: taskItem[] = [];
	const pendingTasks = allTasks.Pending;
	const completedTasks = allTasks.Completed;

	if (columnData.colType === "undated") {
		tasksToDisplay = pendingTasks.filter((task) => !task.due);
	} else if (columnData.colType === "dated") {
		const { dateType, from, to } = columnData.datedBasedColumn || {
			dateType: "due",
			from: 0,
			to: 0,
		};

		tasksToDisplay = pendingTasks.filter((task) => {
			let taskUniversalDate = task.due;
			if (dateType === UniversalDateOptions.startDate) {
				taskUniversalDate = task.startDate;
			} else if (dateType === UniversalDateOptions.scheduledDate) {
				taskUniversalDate = task.scheduledDate;
			}
			if (!taskUniversalDate || taskUniversalDate === "") return false;

			// ---------- METHOD 1 -------------

			// // Get today's date in UTC (ignoring time)
			// const today = new Date();
			// today.setHours(0, 0, 0, 0);
			// const todayUTC = Date.UTC(
			// 	today.getUTCFullYear(),
			// 	today.getUTCMonth(),
			// 	today.getUTCDate()
			// );

			// // Parse the task's due date
			// const dueDate = parseDueDate(taskUniversalDate);
			// if (!dueDate) return false;

			// dueDate.setHours(0, 0, 0, 0);
			// const dueDateUTC = Date.UTC(
			// 	dueDate.getUTCFullYear(),
			// 	dueDate.getUTCMonth(),
			// 	dueDate.getUTCDate()
			// );

			// // Calculate difference in full days
			// const diffDays = Math.round(
			// 	(dueDateUTC - todayUTC) / (1000 * 3600 * 24)
			// );

			// //  ---------- METHOD 2 -------------
			// const today = new Date();
			// /**
			//  * Formats a Date object into "DD/MM/YYYY" format.
			//  */
			// function formatDate(date: Date): string {
			// 	const day = String(date.getDate()).padStart(2, "0");
			// 	const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-based
			// 	const year = date.getFullYear();

			// 	return `${year}-${month}-${day}`;
			// }

			// function treatAsUTC(date: string): number {
			// 	let result = new Date(date);
			// 	result.setMinutes(
			// 		result.getMinutes() - result.getTimezoneOffset()
			// 	);
			// 	return result.getTime();
			// }

			// function daysBetween(startDate: string, endDate: string): number {
			// 	const millisecondsPerDay = 24 * 60 * 60 * 1000;
			// 	const diff: number = (treatAsUTC(endDate) - treatAsUTC(startDate)) / millisecondsPerDay;
			// 	return diff;
			// }

			// const diffDays = daysBetween(formatDate(today), taskUniversalDate);

			//  ---------- METHOD 3 -------------
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const moment = _moment as unknown as typeof _moment.default;
			const diffDays = moment(taskUniversalDate).diff(
				moment(today),
				"days"
			);

			// console.log(
			// 	"diffDays",
			// 	diffDays,
			// 	" | For today : ",
			// 	today,
			// 	" | Universal Date : ",
			// 	taskUniversalDate
			// );

			// Handle cases where 'from' is greater than 'to'
			if (from > to) {
				return diffDays >= to && diffDays <= from;
			}

			return diffDays >= from && diffDays <= to;
		});	} else if (columnData.colType === "untagged") {
		tasksToDisplay = pendingTasks.filter((task) => getAllTaskTags(task).length === 0);
	} else if (columnData.colType === "namedTag") {
		tasksToDisplay = pendingTasks.filter((task) =>
			getAllTaskTags(task).some((tag) => tag === `#${columnData.coltag}`)
		);
	} else if (columnData.colType === "pathFiltered") {
	
		// Filter tasks based on their file path
		if (columnData.filePaths) {
			// Split the path patterns by comma and trim whitespace
			const pathPatterns = columnData.filePaths
				.split(',')
				.map((pattern: string) => pattern.trim().toLowerCase())
				.filter((pattern: string) => pattern.length > 0);
			
			if (pathPatterns.length > 0) {
				tasksToDisplay = pendingTasks.filter((task) => {
					if (!task.filePath) {
						console.log("Task missing filePath:", task);
						return false;
					}
					
					const lowerCasePath = task.filePath.toLowerCase();
					const matchedPattern = pathPatterns.some((pattern: string) => lowerCasePath.includes(pattern));
					console.log(`Checking task path: ${lowerCasePath}, matched: ${matchedPattern}`);
					return matchedPattern;
				});
			} else {
				tasksToDisplay = [];
			}
		} else {
			tasksToDisplay = [];
		}
	} else if (columnData.colType === "otherTags") {
		// 1. Get the current board based on activeBoard index
		const currentBoard = plugin.settings.data.boardConfigs.find(
			(board) => board.index === activeBoard + 1
		);

		// 2. Collect all coltags from columns where colType is 'namedTag'
		const namedTags =
			currentBoard?.columns
				.filter((col) => col.colType === "namedTag" && col.coltag)
				.map((col) => col.coltag?.toLowerCase()) || [];
		// 3. Now filter tasks
		tasksToDisplay = pendingTasks.filter((task) => {
			const allTaskTags = getAllTaskTags(task);
			if (allTaskTags.length === 0) return false;

			// Check if none of the task's tags are in the namedTags list
			return allTaskTags.every(
				(tag) => !namedTags.includes(tag.replace("#", "").toLowerCase())
			);
		});
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
	} else if (columnData.colType === "taskStatus") {
		tasksToDisplay = pendingTasks.filter(
			(task) => task.status === columnData.taskStatus
		);
	} else if (columnData.colType === "taskPriority") {
		tasksToDisplay = pendingTasks.filter(
			(task) => task.priority === columnData.taskPriority
		);
	}

	// setTasks(tasksToDisplay);
	return tasksToDisplay;
};
