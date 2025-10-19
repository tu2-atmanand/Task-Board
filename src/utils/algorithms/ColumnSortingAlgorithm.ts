// /src/utils/ColumnSortingAlgorithm.ts

import type TaskBoard from "main";
import { columnSortingCriteria } from "src/interfaces/BoardConfigs";
import { taskItem } from "src/interfaces/TaskItem";

/**
 * Gets the property value from a task based on the criteria name
 */
function getTaskPropertyValue(
	plugin: TaskBoard,
	task: taskItem,
	criteria: string
): any {
	switch (criteria) {
		case "content":
			return task.title;
		case "id":
			return task.id;
		case "status":
			return task.status;
		case "completed":
		case "completedDate":
			return task.completion;
		case "priority":
			return task.priority;
		case "dueDate":
			return task.due;
		case "startDate":
			return task.startDate;
		case "scheduledDate":
			return task.scheduledDate;
		case "createdDate":
			return task.createdDate;
		case "tags":
			return task.tags;
		case "project":
			// Project is not yet implemented in taskItem
			return "";
		case "context":
			// Context is not yet implemented in taskItem
			return "";
		case "time":
			if (task.time) {
				return task.time;
			}
			if (plugin.settings.data.globalSettings.defaultStartTime) {
				return `${
					plugin.settings.data.globalSettings.defaultStartTime
				} - ${
					plugin.settings.data.globalSettings.defaultStartTime
						.split(":")[0]
						.trim() === "23"
						? "00"
						: Number(
								plugin.settings.data.globalSettings.defaultStartTime
									.split(":")[0]
									.trim()
						  ) + 1
				}:${plugin.settings.data.globalSettings.defaultStartTime
					.split(":")[1]
					.trim()}`;
			} else {
				return "";
			}
		case "recurrence":
			// Recurrence is not yet implemented in taskItem
			return "";
		case "filePath":
			return task.filePath;
		case "lineNumber":
			return task.taskLocation.startLine;
		default:
			return undefined;
	}
}

/**
 * Compares two dates
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 * Handles empty/null dates by placing them at the end for ascending order
 */
function compareDates(date1: any, date2: any, order: "asc" | "desc"): number {
	// Handle empty/null values
	const hasDate1 = date1 && date1 !== "";
	const hasDate2 = date2 && date2 !== "";

	if (!hasDate1 && !hasDate2) return 0;
	if (!hasDate1) return order === "asc" ? 1 : -1; // Empty values go to end for asc, start for desc
	if (!hasDate2) return order === "asc" ? -1 : 1;

	const d1 = new Date(date1);
	const d2 = new Date(date2);

	if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
		return 0;
	}

	if (d1 < d2) return -1;
	if (d1 > d2) return 1;
	return 0;
}

/**
 * Compares two time strings (e.g., "09:00", "9:00", or "09:00-10:00")
 * Returns: -1 if time1 < time2, 0 if equal, 1 if time1 > time2
 */
function compareTimes(time1: any, time2: any, order: "asc" | "desc"): number {
	// Handle empty/null values
	const hasTime1 = time1 && time1 !== "";
	const hasTime2 = time2 && time2 !== "";

	if (!hasTime1 && !hasTime2) return 0;
	if (!hasTime1) return order === "asc" ? 1 : -1; // Empty values go to end for asc, start for desc
	if (!hasTime2) return order === "asc" ? -1 : 1;

	// Extract start time if it's a range (e.g., "09:00-10:00")
	const extractStartTime = (timeStr: string): string => {
		if (timeStr.includes("-")) {
			return timeStr.split("-")[0].trim();
		}
		return timeStr.trim();
	};

	const t1 = extractStartTime(String(time1));
	const t2 = extractStartTime(String(time2));

	// Parse time to compare numerically (handles both "9:00" and "09:00")
	const parseTime = (timeStr: string): number => {
		const parts = timeStr.split(":");
		if (parts.length !== 2) return -1; // Invalid format
		const hours = parseInt(parts[0], 10);
		const minutes = parseInt(parts[1], 10);
		if (isNaN(hours) || isNaN(minutes)) return -1; // Invalid number
		if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1; // Out of range
		return hours * 60 + minutes; // Convert to minutes since midnight
	};

	const time1Minutes = parseTime(t1);
	const time2Minutes = parseTime(t2);

	// Treat invalid times as equal
	if (time1Minutes < 0 && time2Minutes < 0) return 0;
	if (time1Minutes < 0) return order === "asc" ? 1 : -1; // Invalid times go to end for asc
	if (time2Minutes < 0) return order === "asc" ? -1 : 1;

	if (time1Minutes < time2Minutes) return -1;
	if (time1Minutes > time2Minutes) return 1;
	return 0;
}

/**
 * Compares two values based on their type
 */
function compareValues(
	value1: any,
	value2: any,
	criteria: string,
	order: "asc" | "desc"
): number {
	// Handle date criteria
	if (
		[
			"dueDate",
			"startDate",
			"scheduledDate",
			"createdDate",
			"completedDate",
			"completed",
		].includes(criteria)
	) {
		return compareDates(value1, value2, order);
	}

	// Handle time criteria
	if (criteria === "time") {
		return compareTimes(value1, value2, order);
	}

	// Handle priority - special case where lower numbers are higher priority
	// Priority scale: 1 (highest) -> 5 (lowest) -> 0 (none)
	if (criteria === "priority") {
		const hasValue1 = value1 !== undefined && value1 !== null;
		const hasValue2 = value2 !== undefined && value2 !== null;

		if (!hasValue1 && !hasValue2) return 0;

		// Handle priority 0 (none) - should be treated as "no priority"
		const isNone1 = value1 === 0;
		const isNone2 = value2 === 0;

		if (isNone1 && isNone2) return 0;
		// For ascending (High->Low->None): none goes to end
		if (isNone1) return order === "asc" ? 1 : -1;
		if (isNone2) return order === "asc" ? -1 : 1;

		// For non-zero priorities: 1 (highest) to 5 (lowest)
		// For ascending (High->Low->None): lower numbers (1) come before higher numbers (5)
		if (order === "asc") {
			return value1 - value2; // 1 before 5
		} else {
			// For descending (None->Low->High): higher numbers (5) come before lower numbers (1)
			return value2 - value1; // 5 before 1
		}
	}

	// Handle numeric criteria
	if (
		criteria === "lineNumber" ||
		criteria === "id" ||
		typeof value1 === "number"
	) {
		const num1 = Number(value1);
		const num2 = Number(value2);

		if (isNaN(num1) && isNaN(num2)) return 0;
		if (isNaN(num1)) return 1;
		if (isNaN(num2)) return -1;

		return num1 - num2;
	}

	// Handle array criteria (e.g., tags)
	if (Array.isArray(value1) || Array.isArray(value2)) {
		const arr1 = Array.isArray(value1) ? value1 : [];
		const arr2 = Array.isArray(value2) ? value2 : [];

		// Compare arrays by their first element (or length if you prefer)
		const str1 = arr1.length > 0 ? arr1[0].toLowerCase() : "";
		const str2 = arr2.length > 0 ? arr2[0].toLowerCase() : "";

		if (str1 === "" && str2 === "") return 0;
		if (str1 === "") return 1;
		if (str2 === "") return -1;

		return str1.localeCompare(str2);
	}

	// Handle string criteria
	const str1 = String(value1 || "").toLowerCase();
	const str2 = String(value2 || "").toLowerCase();

	if (str1 === "" && str2 === "") return 0;
	if (str1 === "") return 1;
	if (str2 === "") return -1;

	return str1.localeCompare(str2);
}

/**
 * Sorts tasks based on multiple sorting criteria.
 * Criteria are applied in reverse priority order (lowest priority first, highest priority last)
 * to ensure that the highest priority criteria has the final say in the sort order.
 *
 * @param tasksToDisplay - Array of tasks to sort
 * @param sortCriteria - Array of sorting criteria to apply
 * @returns Sorted array of tasks
 */
export function columnSortingAlgorithm(
	plugin: TaskBoard,
	tasksToDisplay: taskItem[],
	sortCriteria: columnSortingCriteria[]
): taskItem[] {
	// Return empty array if no tasks
	if (!tasksToDisplay || tasksToDisplay.length === 0) {
		return [];
	}

	// Return original array if no sorting criteria
	if (!sortCriteria || sortCriteria.length === 0) {
		return tasksToDisplay;
	}

	// Create a copy of the array to avoid mutating the original
	let sortedTasks = [...tasksToDisplay];

	// Sort criteria by priority (ascending order)
	const orderedCriteria = [...sortCriteria].sort(
		(a, b) => a.priority - b.priority
	);

	// Apply sorting criteria in reverse order (lowest priority first)
	// This ensures that the highest priority criteria has the final say
	for (let i = orderedCriteria.length - 1; i >= 0; i--) {
		const criterion = orderedCriteria[i];

		sortedTasks = sortedTasks.sort((taskA, taskB) => {
			const valueA = getTaskPropertyValue(
				plugin,
				taskA,
				criterion.criteria
			);
			const valueB = getTaskPropertyValue(
				plugin,
				taskB,
				criterion.criteria
			);

			if (criterion.criteria === "time") {
				console.log("valueA :", valueA, "\nvalueB :", valueB);
			}

			const comparison = compareValues(
				valueA,
				valueB,
				criterion.criteria,
				criterion.order
			);

			// Apply the order (ascending or descending)
			return criterion.order === "asc" ? comparison : -comparison;
		});
	}

	return sortedTasks;
}
