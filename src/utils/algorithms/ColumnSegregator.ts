// src/utils/RenderColumns.ts

import { differenceInDays } from "date-fns";
import {
	TaskBoardViewType,
	ColumnData,
} from "../../interfaces/BoardConfigs.js";
import { DEFAULT_DATE_FORMAT } from "../../interfaces/Constants.js";
import { colTypeNames, UniversalDateOptions } from "../../interfaces/Enums.js";
import { PluginDataJson } from "../../interfaces/GlobalSettings.js";
import { taskJsonMerged, taskItem } from "../../interfaces/TaskItem.js";
import { allowedFileExtensionsRegEx } from "../../regularExpressions/MiscelleneousRegExpr.js";
import { robustDateParser } from "../DateTimeCalculations.js";
import { getAllTaskTags } from "../TaskItemUtils.js";
import { advancedFilterer } from "./AdvancedFilterer.js";
import { columnSortingAlgorithm } from "./ColumnSortingAlgorithm.js";
import { matchTagsWithWildcards } from "./ScanningFilterer.js";

/**
 * Segregates tasks into columns based on column configurations and then filters the tasks based on the advanced column filters configs. And then sorts the tasks within the particular column based on the sorting criteria.
 *
 * @param {PluginDataJson} settings - The plugin settings object.
 * @param {number} activeViewData - The active view configs.
 * @param {ColumnData} columnData - The single column configs.
 * @param {taskJsonMerged | null} allTasks - The collection of all tasks to segregate.
 * @param {function} onBoardDataChange - Optional callback function to update the board data when changes occur (e.g., when manual ordering is enabled and tasks are reordered).
 * @returns {taskItem[]} - The tasks to display in the column.
 */
export const columnSegregator = (
	settings: PluginDataJson,
	// setTasks: Dispatch<SetStateAction<taskItem[]>>,
	activeViewData: TaskBoardViewType,
	columnData: ColumnData,
	allTasks: taskJsonMerged | null,
	onBoardDataChange?: (updatedViewData: TaskBoardViewType) => void,
): taskItem[] => {
	if (!allTasks || !activeViewData || !activeViewData.kanbanView) return [];

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
				//  * Formats a Date object into "dd/MM/yyyy" format.
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

				// //  ---------- METHOD 3 -------------
				// const today = new Date();
				// today.setHours(0, 0, 0, 0);

				// const moment = _moment as unknown as typeof _moment.default;
				// const diffDays = moment(taskUniversalDate).diff(
				// 	moment(today),
				// 	"days",
				// );

				//  ---------- METHOD 4 -------------
				// Parse the task's universal date using robust parser
				const universalDateFormat =
					settings.data.dateFormat || DEFAULT_DATE_FORMAT;

				let parsedTaskDate = robustDateParser(
					taskUniversalDate,
					universalDateFormat,
				);

				if (!parsedTaskDate) {
					return false;
				}

				const today = new Date();
				today.setHours(0, 0, 0, 0);
				parsedTaskDate.setHours(0, 0, 0, 0);

				const diffDays = differenceInDays(parsedTaskDate, today);

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
				(task) => getAllTaskTags(task).length === 0,
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
						tag,
					);
					return result !== null;
				}),
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
							},
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
			const TaggedColumns = activeViewData.kanbanView.columns.filter(
				(col: ColumnData) =>
					col.colType === colTypeNames.namedTag && col.coltag,
			);
			const namedTags =
				TaggedColumns.map((col: ColumnData) => {
					if (col.coltag)
						return col.coltag.toLowerCase().replace(`#`, "");
					else return "";
				}) || [];

			// 3. Now filter tasks
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
			// NOTE : to apply the sorting algorithm properly, we have to take all the completed tasks.
			// Here we are taking around 1000 which should be enough.
			// After applying the filtering and sorting algorithms, we will slice as per the configs limit.
			// A better approach is under discussion. See this : https://github.com/tu2-atmanand/Task-Board/issues/68

			tasksToDisplay = completedTasks.slice(0, 1000);
			break;
		case colTypeNames.taskPriority:
			tasksToDisplay = pendingTasks.filter(
				(task) => task.priority === columnData.taskPriority,
			);
			break;
		case colTypeNames.taskStatus:
			const allTasks = [...pendingTasks, ...completedTasks];
			tasksToDisplay = allTasks.filter(
				(task) => task.status === columnData.taskStatus,
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
		const dateFormat = settings.data.dateFormat || DEFAULT_DATE_FORMAT;
		tasksToDisplay = advancedFilterer(
			tasksToDisplay,
			columnData.filters,
			dateFormat,
		);
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
			(c) => c.criteria === "manualOrder",
		);
		if (hasManualOrder) {
			// Ensure tasksIdManualOrder exists
			if (!Array.isArray(columnData.tasksIdManualOrder)) {
				columnData.tasksIdManualOrder = [];
			}

			// Add any new tasks (not present in manual order) to the TOP of the manual order array
			const currentIds = tasksToDisplay.map((t) => t.id);
			const missingIds = currentIds.filter(
				(id) => !columnData.tasksIdManualOrder!.includes(id),
			);
			if (missingIds.length > 0) {
				// Prepend missing ids so newest appear on top
				columnData.tasksIdManualOrder = [
					...missingIds,
					...columnData.tasksIdManualOrder!,
				];
			}

			let newTasksIdManualOrder = columnData.tasksIdManualOrder;
			let updatedViewdData = activeViewData;

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
						1,
					);
					didTasksIdManualOrderChange = true;
				}
			}

			// Update the newTasksIdManualOrder inside board data.
			// columnData.tasksIdManualOrder = newTasksIdManualOrder;
			updatedViewdData.kanbanView!.columns[
				columnData.index - 1
			].tasksIdManualOrder = newTasksIdManualOrder;

			if (onBoardDataChange && didTasksIdManualOrderChange) {
				onBoardDataChange(updatedViewdData);
			}

			tasksToDisplay = sorted;
		} else {
			// Default algorithm for other criteria
			tasksToDisplay = columnSortingAlgorithm(
				settings.data.defaultStartTime,
				tasksToDisplay,
				columnData.sortCriteria,
			);
		}
	}

	if (columnData.colType === colTypeNames.completed) {
		tasksToDisplay = tasksToDisplay.slice(0, columnData?.limit ?? 20);
	}

	return tasksToDisplay;
};
