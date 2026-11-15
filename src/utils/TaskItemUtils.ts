// /src/utils/TaskItemUtils.ts

import TaskBoard from "../../main.js";
import { taskItem } from "../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../core/managers/BugReporter.js";
import { extractTaskId } from "../core/managers/VaultScanner.js";
import { updateTaskInFile } from "./task_line/TaskLineUtils.js";
import {
	isTaskNotePresentInTags,
	updateFrontmatterInMarkdownFile,
} from "./task_note/TaskNoteUtils.js";
import {
	DEFAULT_TASK_CACHE_KEYS,
	statusTypeNames,
} from "../interfaces/Enums.js";
import {
	CustomStatus,
	PluginDataJson,
} from "../interfaces/GlobalSettings.js";
import {
	defaultTaskStatuses,
	GetCustomStatusOptionsConfig,
	GroupedStatusOptions,
	priorityDropDownOption,
	priorityEmojis,
	StatusDropdownOption,
	StatusDropdownOutput,
} from "../interfaces/Mapping.js";
import { t } from "i18next";

/**
 * Combines both the normal task.tags and frontmatter tags of a taskItem and return it as a single array.
 * @param task - Task item with updated properties
 * @returns string[] - Array of tags
 */
export const getAllTaskTags = (task: taskItem): string[] => {
	const lineTags = task[DEFAULT_TASK_CACHE_KEYS.Tags] || [];
	const frontmatterTags = task[DEFAULT_TASK_CACHE_KEYS.FrontMatterTags] || [];
	return [...lineTags, ...frontmatterTags];
};

/**
 * Retrieves a task from the TaskBoard plugin's task cache using its ID.
 * @param plugin - The TaskBoard plugin instance.
 * @param id - The ID of the task to retrieve. Can be a string (legacyId) or a number (id).
 * @returns The task item if found, or null if not found.
 */
export const getTaskFromId = async (
	plugin: TaskBoard,
	id: string | number,
): Promise<taskItem | null> => {
	try {
		let foundTask: taskItem | undefined | null;

		// Search in Pending tasks
		const pendingTasksObj = plugin.vaultScanner.tasksCache?.Pending ?? {};
		for (const tasks of Object.values(pendingTasksObj)) {
			if (id) {
				foundTask = tasks.find(
					(task) =>
						task[DEFAULT_TASK_CACHE_KEYS.LegacyID] === id ||
						task[DEFAULT_TASK_CACHE_KEYS.ID] === id,
				);
			}
			if (foundTask) return foundTask;
		}

		// Search in Completed tasks
		const completedTasksObj =
			plugin.vaultScanner.tasksCache?.Completed ?? {};
		for (const tasks of Object.values(completedTasksObj)) {
			if (id) {
				foundTask = tasks.find(
					(task) =>
						task[DEFAULT_TASK_CACHE_KEYS.LegacyID] === id ||
						task[DEFAULT_TASK_CACHE_KEYS.ID] === id,
				);
			}
			if (foundTask) return foundTask;
		}

		return null; // Return null if the task is not found
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			82,
			"Error retrieving task from tasksCache using ID",
			String(error),
			"TaskItemUtils.ts/getTaskFromId",
		);
		return null;
	}
};

// // Generate a unique ID for each task
// export const generateTaskId = (): number => {
// 	const array = new Uint32Array(1);
// 	crypto.getRandomValues(array);
// 	return array[0];
// };

/**
 * Generates a random unique ID using the Web Crypto API.
 *
 * For example : '1851955511'.
 * @return {string} a random unique ID for a task
 */
export function generateRandomStringId(prefix?: string): string {
	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	return prefix ? `${prefix}_${String(array[0])}` : String(array[0]);
}

/**
 * Generates a random unique ID using the Web Crypto API.
 *
 * For example : 1851955511.
 * @return a random unique 10 digit number
 */
export function generateRandomNumber(): number {
	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	return array[0];
}

/**
 * Generates a unique ID for a task based on the plugin's settings.
 * It increments the plugin's settings data globalSettings.uniqueIdCounter by 1 and then saves the updated settings.
 * The current counter value is returned as a string and will be used as the ID for the next task.
 * If the uniqueIdCounter is not set, it will be set to 0 before incrementing.
 * @param plugin - The TaskBoard plugin instance
 * @returns A string representing the unique ID for the task
 */
export function generateTaskId(plugin: TaskBoard): string {
	plugin.settings.data.uniqueIdCounter =
		plugin.settings.data.uniqueIdCounter + 1 || 0;

	// Save the updated uniqueIdCounter back to settings
	void plugin.saveSettings();
	// Return the current counter value and then increment it for the next ID
	return String(plugin.settings.data.uniqueIdCounter);
}

/**
 * Applies a new id to the task in a file if it does not have one already. This function will force an id to be added to the task.
 * @param plugin - The TaskBoard plugin instance.
 * @param task - The taskItem object representing the task to which an id needs to be applied.
 * @returns A promise that resolves to the new id if applied, or undefined if the task already has an id or if an error occurs.
 */
export const applyIdToTaskItem = async (
	plugin: TaskBoard,
	task: taskItem,
): Promise<string | undefined> => {
	// If the task already has an ID, return it and avoid assigning a new one.
	if (
		task[DEFAULT_TASK_CACHE_KEYS.LegacyID] &&
		String(task[DEFAULT_TASK_CACHE_KEYS.LegacyID]).trim() !== ""
	) {
		return String(task[DEFAULT_TASK_CACHE_KEYS.LegacyID]);
	}

	// If it's a task note, ensure frontmatter has an ID and return it.
	if (
		isTaskNotePresentInTags(
			plugin.settings.data.taskNoteIdentifierTag,
			task[DEFAULT_TASK_CACHE_KEYS.Tags],
		)
	) {
		let newId = task[DEFAULT_TASK_CACHE_KEYS.LegacyID];
		if (!newId || String(newId).trim() === "") {
			newId = generateTaskId(plugin);
			task[DEFAULT_TASK_CACHE_KEYS.LegacyID] = newId;
		}
		void updateFrontmatterInMarkdownFile(plugin, task, true);

		return newId;
	}

	// Try to extract an ID from the title (legacy inline format)
	const extractedTaskId = extractTaskId(
		task[DEFAULT_TASK_CACHE_KEYS.Title],
	)?.[1];
	if (extractedTaskId) return extractedTaskId;

	// Otherwise, update the task line in the file which should return a new ID
	const newIdToReturn = await updateTaskInFile(plugin, task, task, true);
	return newIdToReturn;
};

/**
 * Map priority emoji from frontmatter to priority number
 * @param priorityValue - Priority value from frontmatter
 * @returns number - Priority number (0-5)
 */
export function getPriorityNumberUsingPriorityName(
	priorityValue: string,
): number {
	if (!priorityValue) return 0;

	if (priorityValue.length === 1 && Number(priorityValue))
		return Number(priorityValue);

	const priorityStr = String(priorityValue).trim().toLowerCase();
	// Map emojis to priority numbers
	switch (priorityStr) {
		case "highest":
			return 1; // Highest
		case "high":
			return 2; // High
		case "medium":
			return 3; // Medium
		case "low":
			return 4; // Low
		case "lowest":
			return 5; // Lowest
		default:
			return 0; // None
	}
}

/**
 * Get priority name from priority number
 * @param priority - Priority number (1-5)
 * @returns string - Priority emoji
 */
export function getPriorityNameUsingPriorityPriorityNumber(
	priority: number,
): string {
	const priorityNames: { [key: number]: string } = {
		0: "none",
		1: "highest",
		2: "high",
		3: "medium",
		4: "low",
		5: "lowest",
	};
	return priorityNames[priority] || "URGENT";
}

// Helper function to get priority emoji
export const getPriorityEmoji = (priority: number): string => {
	return priorityEmojis[priority] || "";
};

// Priority Options - function to ensure translations are loaded
export const getPriorityOptionsForDropdown = (): priorityDropDownOption[] => [
	{ value: 0, text: "0 - " + t("none") },
	{ value: 1, text: "1 - " + t("highest") + " : 🔺" },
	{ value: 2, text: "2 - " + t("high") + " : ⏫" },
	{ value: 3, text: "3 - " + t("medium") + " : 🔼" },
	{ value: 4, text: "4 - " + t("low") + " : 🔽" },
	{ value: 5, text: "5 - " + t("lowest") + " : ⏬" },
];

// Legacy export for backward compatibility
export const priorityOptions = getPriorityOptionsForDropdown();

/**
 * Map status string to status symbol
 * Eg. statusValue="Pending" then output will be " ".
 * @param statusName - Status value from frontmatter
 * @returns string - Status symbol
 */
export function getStatusSymbolFromStatusName(
	statusName: string | undefined,
	settings: PluginDataJson,
): string {
	if (!statusName) return " ";

	// const statusStr = statusValue.trim().toLowerCase();

	// // Handle both symbol and name formats
	// if (Object.prototype.hasOwnProperty.call(taskStatuses, statusStr)) {
	// 	return (taskStatuses as Record<string, string>)[statusStr];
	// }
	// return " ";

	const tasksPluginStatusConfigs = settings.data.customStatuses;
	let statusSymbol = "";
	tasksPluginStatusConfigs.some((customStatus: CustomStatus) => {
		if (customStatus.name === statusName) {
			statusSymbol = customStatus.symbol;
			return true;
		}
	});
	return statusSymbol;
}

/**
 * Map status symbol to status name
 * Eg. statusValue="/" then output will be "inprogress".
 * @param statusSymbol - Status value from frontmatter
 * @returns string - Status symbol
 */
export function getStatusNameFromStatusSymbol(
	statusSymbol: string | undefined,
	customStatuses: CustomStatus[],
): string {
	if (!statusSymbol) return "pending";

	if (customStatuses.length > 0) {
		const tasksPluginStatusConfigs = customStatuses;
		let statusName = "";
		tasksPluginStatusConfigs.some((customStatus: CustomStatus) => {
			if (customStatus.symbol === statusSymbol) {
				statusName = customStatus.name;
				return true;
			}
		});
		return statusName;
	}

	// Create a reverse mapping from taskStatuses enum
	// taskStatuses contains mappings like: { unchecked: " ", regular: "x", "in-progress": "/" }
	const statusMapping: { [symbol: string]: string } = {};

	for (const [statusName, symbol] of Object.entries(defaultTaskStatuses)) {
		statusMapping[symbol] = statusName;
	}

	// Return the status name for the given symbol, default to "pending" if not found
	return statusMapping[statusSymbol] || "pending";
}

/**
 * Generates dropdown options from CustomStatus array with validation and grouping support.
 *
 * @param statusConfigs - Array of CustomStatus objects from settings
 * @param config - Optional configuration for output format and behavior
 * @returns Structured options ready for rendering in <select>
 */
export const getCustomStatusOptionsForDropdown = (
	statusConfigs: CustomStatus[] | null | undefined,
	config: GetCustomStatusOptionsConfig = {},
): StatusDropdownOutput => {
	const {
		mode = "flat",
		includePlaceholder = false,
		placeholderText = t("select-status") || "Select a status...",
		showTooltips = true,
		formatLabel = (status) => `${status.name} [${status.symbol}]`,
		groupLabelFormatter = (type) => type,
		validateSymbols = true,
	} = config;

	// 🔒 Validation: Handle null/undefined/empty input
	if (
		!statusConfigs ||
		!Array.isArray(statusConfigs) ||
		statusConfigs.length === 0
	) {
		bugReporterManagerInsatance.addToLogs(
			189,
			"Empty or invalid statusConfigs provided",
			"Mapping.ts/getCustomStatusOptionsForDropdown",
		);
		return mode === "grouped"
			? { type: "grouped", groups: [] }
			: {
					type: "flat",
					options: includePlaceholder
						? [
								{
									value: " ",
									label: placeholderText,
									tooltip: undefined,
								},
							]
						: [],
				};
	}

	// 🔒 Validation: Filter out invalid status entries
	const validStatuses = statusConfigs.filter((status, index) => {
		const isValid =
			status &&
			typeof status.symbol === "string" &&
			typeof status.name === "string" &&
			status.name.trim() !== "" &&
			typeof status.type === typeof statusTypeNames;

		if (!isValid) {
			bugReporterManagerInsatance.addToLogs(
				190,
				`Invalid status at index ${index}: ${JSON.stringify(status)}`,
				"Mapping.ts/getCustomStatusOptionsForDropdown",
			);
		}
		return isValid;
	});

	if (validStatuses.length === 0) {
		bugReporterManagerInsatance.addToLogs(
			197,
			`No valid statuses after filtering`,
			"Mapping.ts/getCustomStatusOptionsForDropdown",
		);
		return mode === "grouped"
			? { type: "grouped", groups: [] }
			: { type: "flat", options: [] };
	}

	// 🔒 Validation: Check for duplicate symbols (can cause select bugs)
	if (validateSymbols) {
		const symbolCounts = new Map<string, number>();
		validStatuses.forEach((s) => {
			symbolCounts.set(s.symbol, (symbolCounts.get(s.symbol) || 0) + 1);
		});

		const duplicates = Array.from(symbolCounts.entries())
			.filter(([_, count]) => count > 1)
			.map(([symbol]) => symbol);

		if (duplicates.length > 0) {
			bugReporterManagerInsatance.addToLogs(
				191,
				`Duplicate status symbols detected: ${duplicates.join(", ")}.\nThis may cause unexpected behavior in dropdown selection.`,
				"Mapping.ts/getCustomStatusOptionsForDropdown",
			);
			// Optional: Deduplicate by keeping first occurrence
			// validStatuses = Array.from(new Map(validStatuses.map(s => [s.symbol, s])).values());
		}
	}

	// 🔧 Transform statuses into dropdown options
	const createOption = (status: CustomStatus): StatusDropdownOption => ({
		value: status.symbol,
		label: formatLabel(status),
		tooltip: showTooltips
			? `${t("next")}: [${status.nextStatusSymbol}]`
			: undefined,
		group: status.type,
		metadata: status, // Keep full object for advanced use cases
	});

	const baseOptions = validStatuses.map(createOption);

	// 🎯 Return flat structure
	if (mode === "flat") {
		const options = includePlaceholder
			? [
					{ value: " ", label: placeholderText, tooltip: undefined },
					...baseOptions,
				]
			: baseOptions;

		return { type: "flat", options };
	}

	// 🎯 Return grouped structure
	const grouped = validStatuses.reduce(
		(acc, status) => {
			const existingGroup = acc.find((g) => g.type === status.type);
			if (existingGroup) {
				existingGroup.statuses.push(status);
			} else {
				acc.push({ type: status.type, statuses: [status] });
			}
			return acc;
		},
		[] as Array<{ type: statusTypeNames; statuses: CustomStatus[] }>,
	);

	const groups: GroupedStatusOptions[] = grouped.map((group) => ({
		type: group.type,
		label: groupLabelFormatter(group.type),
		options: group.statuses.map(createOption),
	}));

	// Sort groups alphabetically by label (optional)
	groups.sort((a, b) => a.label.localeCompare(b.label));

	return { type: "grouped", groups };
};
