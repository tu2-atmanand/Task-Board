// /src/utils/TaskItemUtils.ts

import TaskBoard from "../../main.js";
import {
	CustomTaskPropertyValueType,
	taskItem,
	taskItemWithCustomProperties,
} from "../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../core/managers/BugReporter.js";
import { updateTaskInFile } from "./task_line/TaskLineUtils.js";
import {
	isTaskNotePresentInTags,
	updateFrontmatterInMarkdownFile,
} from "./task_note/TaskNoteUtils.js";
import {
	DEFAULT_TASK_CACHE_KEYS,
	PropertyTypeConfig,
	statusTypeNames,
} from "../interfaces/Enums.js";
import {
	CustomPriority,
	CustomStatus,
	globalSettingsData,
	PluginDataJson,
} from "../interfaces/GlobalSettings.js";
import {
	defaultTaskStatuses,
	GetCustomStatusOptionsConfig,
	GroupedStatusOptions,
	priorityDropDownOption,
	priorityEmojis,
	priorityNames,
	StatusDropdownOption,
	StatusDropdownOutput,
} from "../interfaces/Mapping.js";
import { t } from "i18next";
import { extractTaskId } from "./task_line/PropertiesParsing.js";
import { getFormattedTaskContentSync } from "./task_line/TaskContentFormatter.js";

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

const EMPTY_TASK_STRING_ARRAY: string[] = [];

export function normalizeTaskItem(
	task: taskItem,
): Required<taskItemWithCustomProperties> {
	return {
		...task,
		[DEFAULT_TASK_CACHE_KEYS.Body]:
			task[DEFAULT_TASK_CACHE_KEYS.Body] ?? EMPTY_TASK_STRING_ARRAY,
		[DEFAULT_TASK_CACHE_KEYS.Priority]:
			task[DEFAULT_TASK_CACHE_KEYS.Priority] ?? 0,
		[DEFAULT_TASK_CACHE_KEYS.Tags]:
			task[DEFAULT_TASK_CACHE_KEYS.Tags] ?? EMPTY_TASK_STRING_ARRAY,
		[DEFAULT_TASK_CACHE_KEYS.FrontMatterTags]:
			task[DEFAULT_TASK_CACHE_KEYS.FrontMatterTags] ??
			EMPTY_TASK_STRING_ARRAY,
		[DEFAULT_TASK_CACHE_KEYS.Time]:
			task[DEFAULT_TASK_CACHE_KEYS.Time] ?? "",
		[DEFAULT_TASK_CACHE_KEYS.CreatedDate]:
			task[DEFAULT_TASK_CACHE_KEYS.CreatedDate],
		[DEFAULT_TASK_CACHE_KEYS.StartDate]:
			task[DEFAULT_TASK_CACHE_KEYS.StartDate],
		[DEFAULT_TASK_CACHE_KEYS.ScheduledDate]:
			task[DEFAULT_TASK_CACHE_KEYS.ScheduledDate],
		[DEFAULT_TASK_CACHE_KEYS.DueDate]:
			task[DEFAULT_TASK_CACHE_KEYS.DueDate],
		[DEFAULT_TASK_CACHE_KEYS.Dependencies]:
			task[DEFAULT_TASK_CACHE_KEYS.Dependencies] ??
			EMPTY_TASK_STRING_ARRAY,
		[DEFAULT_TASK_CACHE_KEYS.Reminder]:
			task[DEFAULT_TASK_CACHE_KEYS.Reminder],
		[DEFAULT_TASK_CACHE_KEYS.CompletionDate]:
			task[DEFAULT_TASK_CACHE_KEYS.CompletionDate],
		[DEFAULT_TASK_CACHE_KEYS.CancelledDate]:
			task[DEFAULT_TASK_CACHE_KEYS.CancelledDate],
	} as Required<taskItemWithCustomProperties>;
}

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
			task[DEFAULT_TASK_CACHE_KEYS.Tags] ?? [],
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
		plugin.settings.data.taskProperties,
		plugin.settings.data.taskPropertyFormat,
	)?.[1];
	if (extractedTaskId) return extractedTaskId;

	// Otherwise, update the task line in the file which should return a new ID
	const newIdToReturn = await updateTaskInFile(plugin, task, task, true);
	return newIdToReturn;
};

/**
 * Map a priority name from frontmatter to its configured numeric rank.
 * @param priorityValue - Priority value from frontmatter
 * @param customPriorities - Configured custom priorities.
 * @returns The matching priority rank, or 0 when no name is recognized.
 */
export function getPriorityNumberUsingPriorityName(
	priorityValue: string,
	customPriorities?: CustomPriority[],
): number {
	if (!priorityValue) return 0;

	if (priorityValue.length === 1 && Number(priorityValue))
		return Number(priorityValue);

	const priorityStr = String(priorityValue).trim().toLowerCase();
	const customPriority = customPriorities?.find(
		(priority) => priority.name.trim().toLowerCase() === priorityStr,
	);
	if (customPriority) return customPriority.rank;

	// Map emojis to priority numbers
	switch (priorityStr) {
		case "none":
			return 0;
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
 * Get the configured priority name for a numeric rank.
 * @param priority - Priority rank.
 * @param customPriorities - Configured custom priorities.
 * @returns The matching priority name, or the legacy name for standard ranks.
 */
export function getPriorityNameUsingPriorityNumber(
	priority: number,
	customPriorities?: CustomPriority[],
): string {
	const customPriority = customPriorities?.find(
		(customPriority) => customPriority.rank === priority,
	);
	if (customPriority) return customPriority.name;

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

// Include configured priorities while retaining defaults for legacy callers.
export const getPriorityOptionsForDropdown = (
	customPriorities?: CustomPriority[],
): priorityDropDownOption[] => {
	const priorities =
		customPriorities ??
		[1, 2, 3, 4, 5].map((rank) => ({
			rank,
			name: priorityNames[rank],
			emoji: priorityEmojis[rank],
		}));

	return [
		{ value: 0, text: "0 - " + t("none") },
		...priorities
			.slice()
			.sort((a, b) => a.rank - b.rank)
			.map(({ rank, name, emoji }) => ({
				value: rank,
				text: `${rank} - ${name}${emoji ? ` : ${emoji}` : ""}`,
			})),
	];
};

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

/**
 * This function returns the task property value as it stored inside the
 * cache based on the property type configured by the user in setting.
 * Date, time values are stored as strings and will be returned as string.
 *
 * An optional {@link humanReadableString} can be used to get human readable value for
 * dates. See example below.
 *
 * @param task The cached task item object
 * @param propertyKey The key used to store the task property in cache
 * @param globalSetting Plugin level global setting from plugin.settings
 * @param humanReadableString Whether we want a raw value or human redable formatted value.
 * Example for properties like statuses and priorities user has configured names to the
 * symbols and in UI user will want to see the name rather than the symbol.
 *
 * @returns The value of the property and the property type, so user can cast
 * it in that required format if needed. Example : string date value can be
 * converted to Date object. If the value is null, undefined, 0 or empty
 * then undefined will be returned.
 */
export function getTaskPropertyValue(
	task: taskItem,
	propertyKey: string | DEFAULT_TASK_CACHE_KEYS,
	globalSetting: globalSettingsData,
	humanReadableString?: boolean,
): {
	propertyValue: CustomTaskPropertyValueType | undefined;
	propertyType: PropertyTypeConfig | undefined;
} {
	// There are few properties which are not present in Task Cache.
	// These are requested by advanced filterer or other features.
	// From this function will simply format and return them.
	if (propertyKey === DEFAULT_TASK_CACHE_KEYS.Content) {
		const content = getFormattedTaskContentSync(task);
		return {
			propertyValue: content,
			propertyType: PropertyTypeConfig.text,
		};
	}

	const property = globalSetting.taskProperties.find(
		(item) => item.key === propertyKey,
	);
	if (!property)
		return {
			propertyValue: undefined,
			propertyType: undefined,
		};

	// Step 1 - First handle all the known default properties for which some conversion
	// or sanitization is required.
	if (propertyKey === DEFAULT_TASK_CACHE_KEYS.Status) {
		const status = task[DEFAULT_TASK_CACHE_KEYS.Status];
		if (humanReadableString) {
			const statusValue = status
				? getStatusNameFromStatusSymbol(
						status,
						globalSetting.customStatuses ?? [],
					)
				: undefined;
			return {
				propertyValue: String(statusValue),
				propertyType: property.type,
			};
		}

		return {
			propertyValue: status,
			propertyType: property.type,
		};
	}

	if (propertyKey === DEFAULT_TASK_CACHE_KEYS.Priority) {
		const priorityValue = task[DEFAULT_TASK_CACHE_KEYS.Priority];
		if (priorityValue === undefined || priorityValue <= 0)
			return {
				propertyValue: undefined,
				propertyType: property.type,
			};
		if (humanReadableString) {
			const priorityName = getPriorityNameUsingPriorityNumber(
				priorityValue,
				globalSetting.customPriorities,
			);
			return {
				propertyValue: priorityName,
				propertyType: property.type,
			};
		} else {
			return {
				propertyValue: priorityValue,
				propertyType: property.type,
			};
		}
	}

	if (
		propertyKey === DEFAULT_TASK_CACHE_KEYS.Time ||
		propertyKey === DEFAULT_TASK_CACHE_KEYS.StartTime ||
		propertyKey === DEFAULT_TASK_CACHE_KEYS.EndTime
	) {
		const timeValue = task[DEFAULT_TASK_CACHE_KEYS.Time];
		if (timeValue && timeValue !== "") {
			return {
				propertyValue: String(timeValue),
				propertyType: property.type,
			};
		} else {
			return {
				propertyValue: undefined,
				propertyType: property.type,
			};
		}
	}

	// Step 2 - Return all other custom properties as per the format set by user
	const value = task[propertyKey];
	if (value === undefined || value === null || value === "")
		return {
			propertyValue: undefined,
			propertyType: undefined,
		};

	if (
		propertyKey === DEFAULT_TASK_CACHE_KEYS.FilePath &&
		typeof value === "string"
	) {
		return {
			propertyValue: value.split("/").pop() || value,
			propertyType: property.type,
		};
	}

	// Value is in ARRAY format.
	if (Array.isArray(value)) {
		return {
			propertyValue: value.length > 0 ? value : undefined,
			propertyType: property.type,
		};
	}
	// Value is in BOOLEAN or NUMERIC format
	if (typeof value === "boolean" || typeof value === "number") {
		return {
			propertyValue: value,
			propertyType: property.type,
		};
	}

	// Value is in STRING format
	if (typeof value === "string") {
		// We cannot do this here, as this function is used for UI as well as
		// backend processing, hence the value needs to be converted at the receiver end.
		// if (
		// 	property.type === PropertyTypeConfig.date ||
		// 	property.type === PropertyTypeConfig.dateTime
		// ) {
		// 	if (humanReadableString) {
		// 		return {
		// 			propertyValue: getHumanReadableDateString(value),
		// 			propertyType: property.type,
		// 		};
		// 	} else {
		// 		return {
		// 			propertyValue: String(value),
		// 			propertyType: property.type,
		// 		};
		// 	}
		// }

		return {
			propertyValue: value,
			propertyType: property.type,
		};
	}

	return {
		propertyValue: undefined,
		propertyType: undefined,
	};
}
