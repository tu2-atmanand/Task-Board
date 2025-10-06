// src/utils/AdvancedFilters.ts

import { taskItem } from "src/interfaces/TaskItem";
import { AdvancedFilters, FilterGroup, TaskFilter, FilterProperty, FilterOperator } from "src/interfaces/BoardConfigs";
import { moment as _moment } from "obsidian";
import { getAllTaskTags } from "./TaskItemUtils";

/**
 * Apply advanced filters to a list of tasks
 * @param tasks - Array of tasks to filter
 * @param filters - Advanced filters configuration
 * @returns Filtered array of tasks
 */
export function applyAdvancedFilters(
	tasks: taskItem[],
	filters: AdvancedFilters | undefined
): taskItem[] {
	// If filters are not enabled or not defined, return all tasks
	if (!filters || !filters.enabled || filters.groups.length === 0) {
		return tasks;
	}

	return tasks.filter((task) => {
		// Evaluate all filter groups
		const groupResults = filters.groups.map((group) =>
			evaluateFilterGroup(task, group)
		);

		// Combine group results based on matchType
		if (filters.matchType === "All") {
			// All groups must match (AND)
			return groupResults.every((result) => result);
		} else {
			// Any group must match (OR)
			return groupResults.some((result) => result);
		}
	});
}

/**
 * Evaluate a single filter group against a task
 */
function evaluateFilterGroup(task: taskItem, group: FilterGroup): boolean {
	// Evaluate all filters in the group
	const filterResults = group.filters.map((filter) =>
		evaluateFilter(task, filter)
	);

	// Combine filter results based on matchType
	if (group.matchType === "All") {
		// All filters must match (AND)
		return filterResults.every((result) => result);
	} else {
		// Any filter must match (OR)
		return filterResults.some((result) => result);
	}
}

/**
 * Evaluate a single filter against a task
 */
function evaluateFilter(task: taskItem, filter: TaskFilter): boolean {
	const property = filter.property;
	const operator = filter.operator;
	const value = filter.value;

	// Get the task property value
	const taskValue = getTaskPropertyValue(task, property);

	// Apply the operator
	return applyOperator(taskValue, operator, value, property);
}

/**
 * Get the value of a task property
 */
function getTaskPropertyValue(task: taskItem, property: FilterProperty): any {
	switch (property) {
		case "priority":
			return task.priority;
		case "status":
			return task.status;
		case "due date":
			return task.due;
		case "created date":
			return task.createdDate;
		case "scheduled date":
			return task.scheduledDate;
		case "start date":
			return task.startDate;
		case "completion date":
			return task.completion;
		case "file path":
			return task.filePath;
		case "tags":
			return getAllTaskTags(task);
		default:
			return null;
	}
}

/**
 * Apply an operator to compare task value with filter value
 */
function applyOperator(
	taskValue: any,
	operator: FilterOperator,
	filterValue: string,
	property: FilterProperty
): boolean {
	// Handle "is empty" and "is not empty" operators
	if (operator === "is empty") {
		if (Array.isArray(taskValue)) {
			return taskValue.length === 0;
		}
		return !taskValue || taskValue === "" || taskValue === null || taskValue === undefined;
	}

	if (operator === "is not empty") {
		if (Array.isArray(taskValue)) {
			return taskValue.length > 0;
		}
		return !!taskValue && taskValue !== "";
	}

	// For other operators, we need a value to compare
	if (!filterValue) {
		return false;
	}

	// Handle date comparisons
	if (property.includes("date")) {
		return compareDates(taskValue, operator, filterValue);
	}

	// Handle string comparisons
	if (typeof taskValue === "string") {
		return compareStrings(taskValue, operator, filterValue);
	}

	// Handle array comparisons (tags)
	if (Array.isArray(taskValue)) {
		return compareArrays(taskValue, operator, filterValue);
	}

	// Handle number comparisons (priority)
	if (typeof taskValue === "number") {
		return compareNumbers(taskValue, operator, filterValue);
	}

	return false;
}

/**
 * Compare dates
 */
function compareDates(
	taskDate: string | undefined,
	operator: FilterOperator,
	filterDate: string
): boolean {
	if (!taskDate) {
		return false;
	}

	try {
		// Parse dates using moment
		const moment = _moment as unknown as typeof _moment.default;
		const taskMoment = moment(taskDate);
		const filterMoment = moment(filterDate);

		if (!taskMoment.isValid() || !filterMoment.isValid()) {
			return false;
		}

		// Compare only dates, ignoring time
		const taskDay = taskMoment.format("YYYY-MM-DD");
		const filterDay = filterMoment.format("YYYY-MM-DD");

		switch (operator) {
			case "=":
				return taskDay === filterDay;
			case ">=":
				return taskDay >= filterDay;
			case "<=":
				return taskDay <= filterDay;
			case ">":
				return taskDay > filterDay;
			case "<":
				return taskDay < filterDay;
			default:
				return false;
		}
	} catch (e) {
		return false;
	}
}

/**
 * Compare strings
 */
function compareStrings(
	taskValue: string,
	operator: FilterOperator,
	filterValue: string
): boolean {
	const taskLower = taskValue.toLowerCase();
	const filterLower = filterValue.toLowerCase();

	switch (operator) {
		case "is":
			return taskLower === filterLower;
		case "is not":
			return taskLower !== filterLower;
		case "contains":
			return taskLower.includes(filterLower);
		case "does not contain":
			return !taskLower.includes(filterLower);
		case "starts with":
			return taskLower.startsWith(filterLower);
		case "ends with":
			return taskLower.endsWith(filterLower);
		default:
			return false;
	}
}

/**
 * Compare arrays (tags)
 */
function compareArrays(
	taskValues: string[],
	operator: FilterOperator,
	filterValue: string
): boolean {
	const filterLower = filterValue.toLowerCase();

	switch (operator) {
		case "contains":
			return taskValues.some((tag) =>
				tag.toLowerCase().includes(filterLower)
			);
		case "does not contain":
			return !taskValues.some((tag) =>
				tag.toLowerCase().includes(filterLower)
			);
		default:
			return false;
	}
}

/**
 * Compare numbers (priority)
 */
function compareNumbers(
	taskValue: number,
	operator: FilterOperator,
	filterValue: string
): boolean {
	const filterNum = parseFloat(filterValue);
	if (isNaN(filterNum)) {
		return false;
	}

	switch (operator) {
		case "=":
			return taskValue === filterNum;
		case ">=":
			return taskValue >= filterNum;
		case "<=":
			return taskValue <= filterNum;
		case ">":
			return taskValue > filterNum;
		case "<":
			return taskValue < filterNum;
		default:
			return false;
	}
}
