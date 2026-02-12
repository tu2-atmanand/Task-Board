// src/utils/RenderColumns.ts

import { taskItem, taskJsonMerged } from "src/interfaces/TaskItem";
import { moment as _moment } from "obsidian";
import { Board, ColumnData, getActiveColumns, getActiveColumnKey } from "src/interfaces/BoardConfigs";
import { allowedFileExtensionsRegEx } from "src/regularExpressions/MiscelleneousRegExpr";
import { columnSortingAlgorithm } from "./ColumnSortingAlgorithm";
import { colTypeNames, UniversalDateOptions } from "src/interfaces/Enums";
import { matchTagsWithWildcards } from "./ScanningFilterer";
import { boardFilterer } from "./BoardFilterer";
import { PluginDataJson } from "src/interfaces/GlobalSettings";
import { getAllTaskTags } from "../TaskItemUtils";

/**
 * Segregates tasks into columns based on column configurations and then filters the tasks based on the advanced column filters configs. And then sorts the tasks within the particular column based on the sorting criteria.
 *
 * @param {PluginDataJson} settings - The plugin settings object.
 * @param {number} activeBoardIndex - The index of the active board.
 * @param {ColumnData} columnData - The single column configs.
 * @param {taskJsonMerged | null} allTasks - The collection of all tasks to segregate.
 * @returns {taskItem[]} - The tasks to display in the column.
 */
export const columnSegregator = (
	settings: PluginDataJson,
	// setTasks: Dispatch<SetStateAction<taskItem[]>>,
	activeBoardIndex: number,
	columnData: ColumnData,
	allTasks: taskJsonMerged | null,
	onBoardDataChange?: (boardData: Board) => void
): taskItem[] => {
	if (activeBoardIndex < 0 || !allTasks) return [];

	const boardConfigs = settings.data.boardConfigs;

	// 1. Get the current board based on activeBoardIndex index
	const currentBoard = boardConfigs.find(
		(board: Board) => board.index === activeBoardIndex
	);
	// 2. Collect all coltags from columns where colType is 'namedTag'
	const activeColumns = currentBoard ? getActiveColumns(currentBoard) : [];

	// Call the filter function based on the column's tag and properties
	let tasksToDisplay: taskItem[] = [];
	const pendingTasks = allTasks.Pending;
	const completedTasks = allTasks.Completed;

	/**
	 * --------------------------------------------------------------
	 * 		FILTERING BASED ON COLUMN TYPE
	 * -------------------------------------------------------------
	 */
	switch (columnData.colType) {
		case colTypeNames.undated:
			tasksToDisplay = pendingTasks.filter((task) => {
				if (
					columnData.datedBasedColumn?.dateType ===
					UniversalDateOptions.dueDate
				) {
					return !task.due;
				} else if (
					columnData.datedBasedColumn?.dateType ===
					UniversalDateOptions.startDate
				) {
					return !task.startDate;
				} else if (
					columnData.datedBasedColumn?.dateType ===
					UniversalDateOptions.scheduledDate
				) {
					return !task.scheduledDate;
				}
			});
			break;
		case colTypeNames.dated:
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
				if (!taskUniversalDate || taskUniversalDate === "")
					return false;

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
			});
			break;
		case colTypeNames.untagged:
			tasksToDisplay = pendingTasks.filter(
				(task) => getAllTaskTags(task).length === 0
			);
			break;
		case colTypeNames.namedTag:
			tasksToDisplay = pendingTasks.filter((task) =>
				getAllTaskTags(task).some((tag) => {
					// return (
					// 	tag.replace(`#`, "").toLocaleLowerCase() ===
					// 	columnData.coltag?.replace(`#`, "").toLowerCase()
					// );

					const result = matchTagsWithWildcards(
						columnData?.coltag || "",
						tag
					);
					return result !== null;
				})
			);
			break;
		case colTypeNames.pathFiltered:
			// Filter tasks based on their file path
			if (columnData.filePaths) {
				// Split the path patterns by comma and trim whitespace
				const pathPatterns = columnData.filePaths
					.split(",")
					.map((pattern: string) => pattern.trim())
					.filter((pattern: string) => pattern.length > 0);

				if (pathPatterns.length > 0) {
					tasksToDisplay = pendingTasks.filter((task) => {
						if (!task.filePath) {
							return false;
						}

						const lowerCasePath = task.filePath;
						const matchedPattern = pathPatterns.some(
							(pattern: string) => {
								if (allowedFileExtensionsRegEx.test(pattern)) {
									return pattern === lowerCasePath;
								} else {
									// Check if the task's file path contains the pattern
									return lowerCasePath.includes(pattern);
								}
							}
						);
						return matchedPattern;
					});
				} else {
					tasksToDisplay = [];
				}
			} else {
				tasksToDisplay = [];
			}
			break;
		case colTypeNames.otherTags:
			const namedTags =
				activeColumns
					.filter((col: ColumnData) => col.colType === colTypeNames.namedTag && col.coltag)
					.map((col: ColumnData) => col.coltag?.toLowerCase().replace(`#`, "")).filter(
					(tag): tag is string =>
						typeof tag === "string" && tag.length > 0
				) || [];

			// Now filter tasks
			tasksToDisplay = pendingTasks.filter((task) => {
				const allTaskTags = getAllTaskTags(task);
				if (allTaskTags.length === 0) return false;

			// Check if none of the task's tags are in the namedTags list
				return allTaskTags.every((tag: string) => {
					// return !namedTags.includes(tag.replace("#", "").toLowerCase());
					const result = matchTagsWithWildcards(namedTags, tag);
					return result === null;
				});
			});
			break;
		case colTypeNames.completed:
			const completedColumnIndex = activeColumns.findIndex((column: ColumnData) => column.colType === colTypeNames.completed);
			const tasksLimit = activeColumns[completedColumnIndex]?.limit;

			// This sorting will be done through the columnData.sortCriteria for this column if its configured
			// const sortedCompletedTasks = completedTasks.sort((a, b): number => {
			// 	if (a.completion && b.completion) {
			// 		const dateA = new Date(a.completion).getTime();
			// 		const dateB = new Date(b.completion).getTime();
			// 		return dateB - dateA;
			// 	}
			// 	return 0;
			// });

			tasksToDisplay = completedTasks.slice(0, tasksLimit);
			break;
		case colTypeNames.taskPriority:
			tasksToDisplay = pendingTasks.filter(
				(task) => task.priority === columnData.taskPriority
			);
			break;
		case colTypeNames.taskStatus:
			const allTasks = [...pendingTasks, ...completedTasks];
			tasksToDisplay = allTasks.filter(
				(task) => task.status === columnData.taskStatus
			);
			break;
		case colTypeNames.allPending:
			tasksToDisplay = pendingTasks;
			break;
		default:
			tasksToDisplay = [];
			break;
	}

	/**
	 * --------------------------------------------------------------
	 * 		FILTERING BASED ON COLUMN ADVANCED FILTERS
	 * -------------------------------------------------------------
	 */
	if (columnData?.filters && columnData.filters.filterGroups) {
		tasksToDisplay = boardFilterer(tasksToDisplay, columnData.filters);
	}

	/**
	 * --------------------------------------------------------------
	 * 		SORTING
	 * -------------------------------------------------------------
	 */
	if (columnData?.sortCriteria && columnData.sortCriteria.length > 0) {
		// TODO : This code can be moved inside the ColumnSortingAlgorithm function.
		// If manualOrder is one of the sorting criteria, apply manual ordering using columnData.tasksIdManualOrder
		const hasManualOrder = columnData.sortCriteria.some(
			(c) => c.criteria === "manualOrder"
		);
		if (hasManualOrder) {
			// Ensure tasksIdManualOrder exists
			if (!Array.isArray(columnData.tasksIdManualOrder)) {
				columnData.tasksIdManualOrder = [];
			}

			// Add any new tasks (not present in manual order) to the TOP of the manual order array
			const currentIds = tasksToDisplay.map((t) => t.id);
			const missingIds = currentIds.filter(
				(id) => !columnData.tasksIdManualOrder!.includes(id)
			);
			if (missingIds.length > 0) {
				// Prepend missing ids so newest appear on top
				columnData.tasksIdManualOrder = [
					...missingIds,
					...columnData.tasksIdManualOrder!,
				];
			}

			let newTasksIdManualOrder = columnData.tasksIdManualOrder;
			let currentBoardData = settings.data.boardConfigs[activeBoardIndex];

			let didTasksIdManualOrderChange = false;
			// Build sorted list based on manual order
			const idToTask = new Map(tasksToDisplay.map((t) => [t.id, t]));
			const sorted: taskItem[] = [];
			for (const id of columnData.tasksIdManualOrder) {
				const task = idToTask.get(id);
				if (task) {
					sorted.push(task);
				} else {
					newTasksIdManualOrder.splice(
						newTasksIdManualOrder.indexOf(id),
						1
					);
					didTasksIdManualOrderChange = true;
				}
			}

			// Update the newTasksIdManualOrder inside board data.
			// columnData.tasksIdManualOrder = newTasksIdManualOrder;
			const columnKey = getActiveColumnKey(currentBoardData);
			const colIdx = currentBoardData.columns[columnKey].findIndex((col: ColumnData) => col.id === columnData.id);
			if (colIdx !== -1) {
				currentBoardData.columns[columnKey][colIdx].tasksIdManualOrder = newTasksIdManualOrder;
			}

			if (onBoardDataChange && didTasksIdManualOrderChange) {
				onBoardDataChange(currentBoardData);
			}

			tasksToDisplay = sorted;
		} else {
			// Default algorithm for other criteria
			tasksToDisplay = columnSortingAlgorithm(
				settings.data.globalSettings.defaultStartTime,
				tasksToDisplay,
				columnData.sortCriteria
			);
		}
	}

	return tasksToDisplay;
};
