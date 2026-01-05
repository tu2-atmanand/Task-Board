// src/utils/boardFilterer.ts

import { taskItem } from "src/interfaces/TaskItem";
import { getFormattedTaskContentSync } from "../taskLine/TaskContentFormatter";
import {
	RootFilterState,
	FilterGroup,
	Filter,
} from "src/interfaces/BoardConfigs";
import { getAllTaskTags } from "../TaskItemUtils";

/**
 * Filters tasks based on the board's filter configuration
 * @param tasks - Array of tasks to filter
 * @param filterState - The root filter state containing all filter groups
 * @returns Filtered array of tasks
 */
export function boardFilterer(
	tasks: taskItem[],
	filterState: RootFilterState | undefined
): taskItem[] {
	// TODO : This function runs more number of times than it should be running.
	// If no filter state or no filter groups, return all tasks
	if (
		!filterState ||
		!filterState.filterGroups ||
		filterState.filterGroups.length === 0
	) {
		return tasks;
	}

	// Apply filters based on root condition
	const rootCondition = filterState.rootCondition;
	const filterGroups = filterState.filterGroups;

	return tasks.filter((task) => {
		const groupResults = filterGroups.map((group) =>
			evaluateFilterGroup(task, group)
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
	});
}

/**
 * Evaluates a single filter group against a task
 */
function evaluateFilterGroup(task: taskItem, group: FilterGroup): boolean {
	const { groupCondition, filters } = group;

	if (!filters || filters.length === 0) {
		return true;
	}

	const filterResults = filters.map((filter) => evaluateFilter(task, filter));

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
 * Evaluates a single filter against a task
 */
function evaluateFilter(task: taskItem, filter: Filter): boolean {
	const { property, condition, value } = filter;

	// Get the property value from the task
	const taskValue = getTaskPropertyValue(task, property);

	// console.log(
	// 	"task :",
	// 	task,
	// 	"\nfilter :",
	// 	filter,
	// 	"\ntaskValue :",
	// 	taskValue
	// );

	// Evaluate based on condition
	switch (condition) {
		case "isNotEmpty":
			if (Array.isArray(taskValue && taskValue.length > 0)) return true;
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
			return (
				taskValue === "" ||
				taskValue === null ||
				taskValue === undefined ||
				(Array.isArray(taskValue) && taskValue.length === 0)
			);
		case "equals":
		case "is":
			return taskValue === value;
		case "notEquals":
		case "isNot":
			return taskValue !== value;
		case "contains":
			if (typeof taskValue === "string") {
				return taskValue
					.toLowerCase()
					.includes(String(value).toLowerCase());
			}
			if (Array.isArray(taskValue)) {
				return taskValue.some((item) =>
					String(item)
						.replace("#", "")
						.toLowerCase()
						.includes(String(value).replace("#", "").toLowerCase())
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
				return !taskValue.some((item) =>
					String(item)
						.replace("#", "")
						.toLowerCase()
						.includes(String(value).replace("#", "").toLowerCase())
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
			return compareDates(taskValue, value) < 0;
		case "after":
			return compareDates(taskValue, value) > 0;
		case "onOrBefore":
			return compareDates(taskValue, value) <= 0;
		case "onOrAfter":
			return compareDates(taskValue, value) >= 0;
		case "hasTag":
			if (Array.isArray(taskValue)) {
				return taskValue.some(
					(tag) =>
						String(tag).toLowerCase() ===
						String(value).toLowerCase()
				);
			}
			return false;
		case "doesNotHaveTag":
			if (Array.isArray(taskValue)) {
				return !taskValue.some(
					(tag) =>
						String(tag).toLowerCase() ===
						String(value).toLowerCase()
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
function getTaskPropertyValue(task: taskItem, property: string): any {
	switch (property) {
		case "content":
			return getFormattedTaskContentSync(task);
		case "title":
			return task.title || "";
		case "body":
		case "description":
			return task.body.join("\n") || "";
		case "createdDate":
		case "created":
			return task.createdDate || "";
		case "dueDate":
		case "due":
			return task.due || "";
		case "startDate":
		case "start":
			return task.startDate || "";
		case "scheduledDate":
		case "scheduled":
			return task.scheduledDate || "";
		case "completion":
		case "completedDate":
		case "done":
			return task?.completion || "";
		case "cancelled":
		case "cancelledDate":
			return task?.cancelledDate || "";
		case "priority":
			return task.priority || 0;
		case "status":
			return task.status || "";
		case "tags":
			return getAllTaskTags(task) || [];
		case "frontmatterTags":
			return task.frontmatterTags || [];
		case "filePath":
		case "path":
			return task.filePath || "";
		case "startTime":
			return task.time ? task.time.split("-")[0].trim() : "";
		case "reminder":
			return task?.reminder || "";
		case "dependsOn":
		case "dependencies":
			return task?.dependsOn || [];
		default:
			// Handle tag properties like "tags.myTag"
			if (property.startsWith("tags.")) {
				const tagName = property.substring(5);
				return task.tags.some(
					(tag) => tag.toLowerCase() === tagName.toLowerCase()
				);
			}
			return undefined;
	}
}

/**
 * Compares two dates
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
function compareDates(date1: any, date2: any): number {
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
 * Checks if the root filter state is empty (no filter groups or filters)
 * @param filterState - The root filter state to check
 * @returns true if empty, false otherwise
 */
export function isRootFilterStateEmpty(
	filterState: RootFilterState | undefined
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
