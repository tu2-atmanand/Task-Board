// /src/utils/ColumnSortingAlgorithm.ts

import { columnSortingCriteria } from "../../interfaces/BoardConfigs.js";
import { CustomTaskPropertyValueType, taskItem } from "../../interfaces/TaskItem.js";
import {
	DEFAULT_TASK_CACHE_KEYS,
	PropertyTypeConfig,
} from "../../interfaces/Enums.js";
import {
	compareDates,
	compareTimePropertyValue,
} from "../../utils/DateTimeCalculations.js";
import { globalSettingsData } from "../../interfaces/GlobalSettings.js";
import { getTaskPropertyValue } from "../../utils/TaskItemUtils.js";

/**
 * Compares two values based on their type
 */
function compareValues(
	value1: CustomTaskPropertyValueType,
	value2: CustomTaskPropertyValueType,
	criteria: string | DEFAULT_TASK_CACHE_KEYS,
	order: "asc" | "desc",
	propertyType?: PropertyTypeConfig,
): number {
	// Apply configured custom-property semantics from shared property metadata.
	if (
		propertyType === PropertyTypeConfig.date ||
		propertyType === PropertyTypeConfig.dateTime
	) {
		const dateValue1 =
			typeof value1 === "number" || typeof value1 === "string"
				? value1
				: "";
		const dateValue2 =
			typeof value2 === "number" || typeof value2 === "string"
				? value2
				: "";
		return compareDates(dateValue1, dateValue2, order);
	}
	if (propertyType === PropertyTypeConfig.time) {
		return compareTimePropertyValue(
			String(value1 ?? ""),
			String(value2 ?? ""),
			order,
		);
	}
	if (propertyType === PropertyTypeConfig.numeric) {
		const number1 = Number(value1);
		const number2 = Number(value2);
		if (!Number.isFinite(number1) && !Number.isFinite(number2)) return 0;
		if (!Number.isFinite(number1)) return 1;
		if (!Number.isFinite(number2)) return -1;
		return number1 - number2;
	}

	// TODO : Need to add the logic to sort boolean values, all true will
	// be on top and false on botttom or vice-versa based on the asc or desc.
	// if (propertyType === PropertyTypeConfig.boolean) {
	// 	const bool1 =
	// 		value1 === true || String(value1).toLowerCase() === "true";
	// 	const bool2 =
	// 		value2 === true || String(value2).toLowerCase() === "true";
	// 	return Number(bool1) - Number(bool2);
	// }
	// Built-in date/date-time type properties
	// if (
	// 	[
	// 		"dueDate",
	// 		"startDate",
	// 		"scheduledDate",
	// 		"createdDate",
	// 		"completedDate",
	// 		"completed",
	// 	].includes(criteria) &&
	// 	typeof value1 === "string" &&
	// 	typeof value2 === "string"
	// ) {
	// 	return compareDates(value1, value2, order);
	// }

	// // Handle time properties
	// if (
	// 	criteria === "time" &&
	// 	typeof value1 === "string" &&
	// 	typeof value2 === "string"
	// ) {
	// 	return compareTimePropertyValue(value1, value2, order);
	// }

	// Legacy cached priority 0 values are still treated as "none".
	if (
		criteria === "priority" &&
		typeof value1 === "number" &&
		typeof value2 === "number"
	) {
		const isNone1 = value1 === 0;
		const isNone2 = value2 === 0;

		if (isNone1 && isNone2) return 0;
		if (isNone1) return 1;
		if (isNone2) return -1;

		// For non-zero priorities: 1 (highest) to 5 (lowest)
		// For ascending (High->Low->None): lower numbers (1) come before higher numbers (5)
		// Return negative if value1 should come before value2
		if (order === "asc") {
			return value2 - value1; // 5 before 1 (Low to High)
		} else {
			// For descending (Low->High->None): higher numbers (5) come before lower numbers (1)
			return value1 - value2; // 1 before 5 (High to Low)
		}
	}

	// Handle numeric properties
	if (typeof value1 === "number" && typeof value2 === "number") {
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

		// Convert first element to string for safe comparison
		const str1 = arr1.length > 0 ? String(arr1[0]).toLowerCase() : "";
		const str2 = arr2.length > 0 ? String(arr2[0]).toLowerCase() : "";

		if (str1 === "" && str2 === "") return 0;
		if (str1 === "") return 1;
		if (str2 === "") return -1;

		return str1.localeCompare(str2);
	}

	// Handle string criteria — narrow type to primitives before stringifying
	const str1 = (
		value1 == null
			? ""
			: typeof value1 === "string" || typeof value1 === "number"
				? String(value1)
				: ""
	).toLowerCase();
	const str2 = (
		value2 == null
			? ""
			: typeof value2 === "string" || typeof value2 === "number"
				? String(value2)
				: ""
	).toLowerCase();

	if (str1 === "" && str2 === "") return 0;
	if (str1 === "") return 1;
	if (str2 === "") return -1;

	return str1.localeCompare(str2);
}

/**
 * Sorts tasks based on multiple sorting criteria.
 *
 * For {@link taskItem.priority} - Criteria are applied in reverse priority order (lowest priority first, highest priority last)
 * to ensure that the highest priority criteria has the final say in the sort order.
 *
 * @param tasksToDisplay - Array of tasks to sort
 * @param sortCriteria - Array of sorting criteria to apply
 * @returns Sorted array of tasks
 */
export function columnSortingAlgorithm<T extends taskItem>(
	tasksToDisplay: T[],
	sortCriteria: columnSortingCriteria[],
	globalSettings: globalSettingsData,
): T[] {
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
		(a, b) => a.priority - b.priority,
	);

	// Apply sorting criteria in reverse order (lowest priority first)
	// This ensures that the highest priority criteria has the final say
	for (let i = orderedCriteria.length - 1; i >= 0; i--) {
		const criterion = orderedCriteria[i];
		if (!criterion) continue;

		sortedTasks = sortedTasks.sort((taskA, taskB) => {
			const valueNtypeofA = getTaskPropertyValue(
				taskA,
				criterion.criteria,
				globalSettings,
			);
			const valueNtypeofB = getTaskPropertyValue(
				taskB,
				criterion.criteria,
				globalSettings,
			);

			if (
				valueNtypeofA.propertyValue == null ||
				valueNtypeofA.propertyValue === "" ||
				valueNtypeofB.propertyValue == null ||
				valueNtypeofB.propertyValue === ""
			) {
				if (
					(valueNtypeofA.propertyValue == null ||
						valueNtypeofA.propertyValue === "") &&
					(valueNtypeofB.propertyValue == null ||
						valueNtypeofB.propertyValue === "")
				)
					return 0;
				const emptyFirst =
					criterion.criteria !== "priority" &&
					criterion.order === "desc";
				return valueNtypeofA.propertyValue == null ||
					valueNtypeofA.propertyValue === ""
					? emptyFirst
						? -1
						: 1
					: emptyFirst
						? 1
						: -1;
			}

			// TODO : Somehow need to handle
			const comparison = compareValues(
				valueNtypeofA.propertyValue,
				valueNtypeofB.propertyValue,
				criterion.criteria,
				criterion.order,
				valueNtypeofA.propertyType,
			);

			// For priority and other criteria that already handle order internally,
			// return the comparison directly
			// For other criteria, apply the order
			if (
				criterion.criteria === "priority"
				// ||
				// [
				// 	"dueDate",
				// 	"startDate",
				// 	"scheduledDate",
				// 	"createdDate",
				// 	"completedDate",
				// 	"completed",
				// 	"time",
				// ].includes(criterion.criteria)
			) {
				// These criteria already handle order in compareValues
				return comparison;
			}

			// Apply the order (ascending or descending)
			return criterion.order === "asc" ? comparison : -comparison;
			// return comparison;
		});
	}

	return sortedTasks;
}
