// src/utils/advancedFilterer.ts

import {
	Filter,
	FilterCriterionGroup,
	FilterCriterion,
	AdvancedFilter,
} from "../../interfaces/BoardConfigs.js";
import { DEFAULT_DATE_FORMAT } from "../../interfaces/Constants.js";
import { PropertyTypeConfig } from "../../interfaces/Enums.js";
import { taskItem } from "../../interfaces/TaskItem.js";
import {
	compareDates,
	compareTimePropertyValue,
} from "../../utils/DateTimeCalculations.js";
import { getTaskPropertyValue } from "../../utils/TaskItemUtils.js";
import { matchTagsWithWildcards } from "./ScanningFilterer.js";

/**
 * Filters tasks based on the board's filter configuration
 * @param tasks - Array of tasks to filter
 * @param filters - All the filters
 * @param dateFormat - The date format string (e.g., DEFAULT_DATE_FORMAT)
 * @returns Filtered array of tasks
 */
export function advancedFilterer<T extends taskItem>(
	tasks: T[],
	advancedFilter: AdvancedFilter | undefined,
	dateFormat: string = DEFAULT_DATE_FORMAT,
): T[] {
	// TODO : This function runs more number of times than it should be running.
	// Find only the filters which has been enabled by the user
	if (!advancedFilter?.filters || !advancedFilter?.rootCondition)
		return tasks;

	const enabledFilters = advancedFilter.filters.filter(
		(filter) => filter.status,
	);
	if (enabledFilters?.length === 0) return tasks;

	const filtersRootCondition = advancedFilter.rootCondition;

	return tasks.filter((task) => {
		const allFiltersResults = enabledFilters.map((filter: Filter) =>
			evaluateFilter(task, filter, dateFormat),
		);

		// Combine group results based on root condition
		switch (filtersRootCondition) {
			case "all":
				return allFiltersResults.every((result) => result);
			case "any":
				return allFiltersResults.some((result) => result);
			case "none":
				return !allFiltersResults.some((result) => result);
			default:
				return true;
		}
	});
}

/**
 * Evaluates a single filter against a task
 */
function evaluateFilter(
	task: taskItem,
	filterState: Filter,
	dateFormat: string,
): boolean {
	// If no filter state or no filter groups, return all tasks
	if (
		!filterState ||
		!filterState.filterGroups ||
		filterState.filterGroups.length === 0
	) {
		return true;
	}

	// Apply filters based on root condition
	const rootCondition = filterState.rootCondition;
	const filterGroups = filterState.filterGroups;

	// Filter out null/undefined/invalid filter groups before processing
	const validGroups = filterGroups.filter(
		(group) => group && typeof group === "object" && group.groupCondition,
	);

	// If no valid groups after filtering, return true (no filtering applied)
	if (validGroups.length === 0) {
		return true;
	}

	const groupResults = validGroups.map((group) =>
		evaluateFilterCriterionGroup(task, group, dateFormat),
	);

	// Combine group results based on root condition
	switch (rootCondition) {
		case "all":
			return groupResults.every((result) => result);
		case "any":
			return groupResults.some((result) => result);
		case "none":
			return !groupResults.some((result) => result);
		default:
			return true;
	}
}

/**
 * Evaluates a single {@link FilterCriterionGroup} against a task
 */
function evaluateFilterCriterionGroup(
	task: taskItem,
	group: FilterCriterionGroup,
	dateFormat: string,
): boolean {
	// Safety check: validate group structure
	if (!group || !group.groupCondition) {
		return true; // Invalid group, skip it
	}

	const { groupCondition, filters } = group;

	if (!filters || filters.length === 0) {
		return true;
	}

	const filterResults = filters.map((filter) =>
		evaluateFilterCriterion(task, filter, dateFormat),
	);

	// Combine filter results based on group condition
	switch (groupCondition) {
		case "all":
			return filterResults.every((result) => result);
		case "any":
			return filterResults.some((result) => result);
		case "none":
			return !filterResults.some((result) => result);
		default:
			return true;
	}
}

/**
 * Evaluates a single {@link FilterCriterion} against a task.
 *
 * @returns
 * - True - If the task is allowed to pass through this filter.
 * - False - If task does not satisfy the filter.
 */
function evaluateFilterCriterion(
	task: taskItem,
	filter: FilterCriterion,
	dateFormat: string,
): boolean {
	const { property, condition, value } = filter;

	// OLD METHOD - Using feature specific getTaskPropertyValue function
	// // Configured property ids are the keys stored on task cache objects.
	// let taskValue = getTaskPropertyValue(task, property);
	// if (propertyType === PropertyTypeConfig.numeric && taskValue !== "" && taskValue != null) {
	// 	const numericValue = Number(taskValue);
	// 	taskValue = Number.isNaN(numericValue) ? undefined : numericValue;
	// } else if (propertyType === PropertyTypeConfig.boolean) {
	// 	if (typeof taskValue === "string" && taskValue !== "") {
	// 		taskValue = taskValue.toLowerCase() === "true";
	// 	}
	// }

	// NEW MTHOD - Using a universal getTaskPropertyValue function
	const valueNType = getTaskPropertyValue(task, property, globalSettings);

	const taskValue = valueNType.propertyValue;
	const propertyType = valueNType.propertyType;

	const comparisonValue =
		propertyType === PropertyTypeConfig.boolean
			? String(value).toLowerCase() === "true"
			: value;

	// Evaluate based on condition
	switch (condition) {
		case "isNotEmpty":
			if (typeof taskValue === "boolean" || typeof taskValue === "number")
				return true;
			if (Array.isArray(taskValue) && taskValue.length > 0) return true;
			else if (taskValue && taskValue !== "") return true;
			else if (taskValue) return true;
			else return false;

		// return (
		// 	taskValue !== "" ||
		// 	taskValue !== null ||
		// 	taskValue !== undefined ||
		// 	taskValue?.length > 0
		// );
		case "isEmpty":
			if (typeof taskValue === "boolean" || typeof taskValue === "number")
				return false;
			return (
				taskValue === "" ||
				taskValue === null ||
				taskValue === undefined ||
				(Array.isArray(taskValue) && taskValue.length === 0)
			);
		case "equals":
		case "is":
			return taskValue == comparisonValue;
		case "notEquals":
		case "isNot":
			return taskValue != comparisonValue;
		case "contains":
			if (typeof taskValue === "string") {
				return taskValue
					.toLowerCase()
					.includes(String(value).toLowerCase());
			}
			if (Array.isArray(taskValue)) {
				return taskValue.some((item: string) =>
					matchTagsWithWildcards(String(value), item),
				);
			}
			return false;
		case "doesNotContain":
			if (typeof taskValue === "string") {
				return !taskValue
					.toLowerCase()
					.includes(String(value).toLowerCase());
			}
			if (Array.isArray(taskValue)) {
				return !taskValue.some((item: string) =>
					matchTagsWithWildcards(String(value), item),
				);
			}
			return true;
		case "startsWith":
			if (typeof taskValue === "string") {
				return taskValue
					.toLowerCase()
					.startsWith(String(value).toLowerCase());
			}
			return false;
		case "endsWith":
			if (typeof taskValue === "string") {
				return taskValue
					.toLowerCase()
					.endsWith(String(value).toLowerCase());
			}
			return false;
		case "greaterThan":
		case ">":
			return Number(taskValue) > Number(value);
		case "lessThan":
		case "<":
			return Number(taskValue) < Number(value);
		case "greaterThanOrEqual":
		case ">=":
			return Number(taskValue) >= Number(value);
		case "lessThanOrEqual":
		case "<=":
			return Number(taskValue) <= Number(value);
		case "before":
			if (typeof taskValue !== "string" || typeof value !== "string")
				return false;
			return (
				(propertyType === PropertyTypeConfig.time
					? compareTimePropertyValue(taskValue, value, "asc")
					: compareDates(taskValue, value, "asc")) < 0
			);
		case "after":
			if (typeof taskValue !== "string" || typeof value !== "string")
				return false;
			return (
				(propertyType === PropertyTypeConfig.time
					? compareTimePropertyValue(taskValue, value, "asc")
					: compareDates(taskValue, value, "asc")) > 0
			);
		case "onOrBefore":
			if (typeof taskValue !== "string" || typeof value !== "string")
				return false;
			return (
				(propertyType === PropertyTypeConfig.time
					? compareTimePropertyValue(taskValue, value, "asc")
					: compareDates(taskValue, value, "asc")) <= 0
			);
		case "onOrAfter":
			if (typeof taskValue !== "string" || typeof value !== "string")
				return false;
			return (
				(propertyType === PropertyTypeConfig.time
					? compareTimePropertyValue(taskValue, value, "asc")
					: compareDates(taskValue, value, "asc")) >= 0
			);
		case "hasTag":
			if (Array.isArray(taskValue)) {
				return (
					matchTagsWithWildcards(String(value), taskValue) !== null
				);
			}
			return false;
		case "doesNotHaveTag":
			if (Array.isArray(taskValue)) {
				return (
					matchTagsWithWildcards(String(value), taskValue) === null
				);
			}
			return true;
		default:
			return true;
	}
}

/**
 * Gets the property value from a task based on property name
 */
// function getTaskPropertyValue(
// 	task: taskItem,
// 	property: string,
// 	propertyType?: PropertyTypeConfig,
// ): unknown {
// 	if (propertyType) {
// 		return (task as unknown as Record<string, unknown>)[property];
// 	}
// 	switch (property) {
// 		case "content":
// 			return getFormattedTaskContentSync(task);
// 		case "title":
// 			return task[DEFAULT_TASK_CACHE_KEYS.Title] || "";
// 		case "body":
// 		case "description":
// 			return task[DEFAULT_TASK_CACHE_KEYS.Body]?.join("\n") || "";
// 		case "createdDate":
// 		case "created":
// 			return task[DEFAULT_TASK_CACHE_KEYS.CreatedDate] || "";
// 		case "dueDate":
// 		case "due":
// 			return task[DEFAULT_TASK_CACHE_KEYS.DueDate] || "";
// 		case "startDate":
// 		case "start":
// 			return task[DEFAULT_TASK_CACHE_KEYS.StartDate] || "";
// 		case "scheduledDate":
// 		case "scheduled":
// 			return task[DEFAULT_TASK_CACHE_KEYS.ScheduledDate] || "";
// 		case "completion":
// 		case "completedDate":
// 		case "done":
// 			return task?.[DEFAULT_TASK_CACHE_KEYS.CompletionDate] || "";
// 		case "cancelled":
// 		case "cancelledDate":
// 			return task?.[DEFAULT_TASK_CACHE_KEYS.CancelledDate] || "";
// 		case "priority":
// 			return task[DEFAULT_TASK_CACHE_KEYS.Priority] || 0;
// 		case "status":
// 			return task[DEFAULT_TASK_CACHE_KEYS.Status] || " ";
// 		case "tags":
// 			return getAllTaskTags(task) || [];
// 		case "frontmatterTags":
// 			return task[DEFAULT_TASK_CACHE_KEYS.FrontMatterTags] || [];
// 		case "filePath":
// 		case "path":
// 			return task[DEFAULT_TASK_CACHE_KEYS.FilePath] || "";
// 		case "folderPath": {
// 			const parts = task[DEFAULT_TASK_CACHE_KEYS.FilePath].split("/");
// 			const folderPath = parts.slice(0, -1).join("/");
// 			return folderPath + "/" || "";
// 		}
// 		case "startTime":
// 			return task[DEFAULT_TASK_CACHE_KEYS.Time]
// 				? task[DEFAULT_TASK_CACHE_KEYS.Time].split("-")[0].trim()
// 				: "";
// 		case "reminder":
// 			return task?.[DEFAULT_TASK_CACHE_KEYS.Reminder] || "";
// 		case "dependsOn":
// 		case "dependencies":
// 			return task?.[DEFAULT_TASK_CACHE_KEYS.Dependencies] || [];
// 		default:
// 			// Handle tag properties like "tags.myTag"
// 			if (property.startsWith("tags.")) {
// 				const tagName = property.substring(5);
// 				return (task[DEFAULT_TASK_CACHE_KEYS.Tags] ?? []).some(
// 					(tag) => tag.toLowerCase() === tagName.toLowerCase(),
// 				);
// 			}
// 			return undefined;
// 	}
// }

/**
 * Checks if the root filter state is empty (no filter groups or filters)
 * @param filterState - The root filter state to check
 * @returns true if empty, false otherwise
 *
 * @deprecated We are no longer using the older Advanced Filter. Use {@link isAdvancedFilterEmpty} instead
 */
export function isRootFilterStateEmpty(
	filterState: Filter | undefined,
): boolean {
	if (!filterState) return true;
	if (!filterState.filterGroups || filterState.filterGroups.length === 0)
		return true;

	for (const group of filterState.filterGroups) {
		if (group.filters && group.filters.length > 0) {
			return false;
		}
	}

	return true;
}

/**
 * Checks if the {@link AdvancedFilter} is empty (no "active" {@link Filter} are present)
 * @param advancedFilter - The complete advanced filter
 *
 * @returns true if empty, false otherwise
 */
export function isAdvancedFilterEmpty(
	advancedFilter: AdvancedFilter | undefined,
): boolean {
	if (!advancedFilter) return true;

	if (!advancedFilter?.filters || advancedFilter.filters.length === 0)
		return true;

	if (
		advancedFilter.filters.some(
			(filter: Filter) => filter.status && filter.filterGroups.length > 0,
		)
	)
		return false;

	return true;
}
