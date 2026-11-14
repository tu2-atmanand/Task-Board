// /src/utils/taskNote/FrontmatterOperations.ts

import { parseYaml, stringifyYaml, TFile } from "obsidian";

import TaskBoard from "../../../main.js";
import {
	DEFAULT_TASK_CACHE_KEYS,
	statusTypeNames,
} from "../../interfaces/Enums.js";
import { customFrontmatterCache, taskItem } from "../../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../../core/managers/BugReporter.js";
import { formatToday } from "../DateTimeCalculations.js";
import { generateTaskId } from "../TaskItemUtils.js";
import {
	getCustomFrontmatterKey,
	getStatusNameFromStatusSymbol,
	getPriorityNameForTaskNote,
} from "./TaskNoteUtils.js";
import {
	FrontmatterFormattingInterface,
	getDefaultPropertyFrontmatterFormatting,
} from "../../interfaces/GlobalSettings.js";
import { compareTwoTags } from "../../core/algorithms/ScanningFilterer.js";

/**
 * Extract frontmatter from file content
 * @param plugin - TaskBoard plugin instance
 * @param file - Obsidian file
 * @returns any - Frontmatter object or null if not found
 */
export function extractFrontmatterFromFile(
	plugin: TaskBoard,
	file: TFile,
): customFrontmatterCache | undefined {
	// Method 1 - Find the frontmatter using delimiters
	// // Check if the file starts with frontmatter delimiter
	// if (!fileContent.startsWith("---\n")) {
	// 	return null;
	// }

	// // Find the end of frontmatter
	// const secondDelimiterIndex = fileContent.indexOf("\n---\n", 4);
	// if (secondDelimiterIndex === -1) {
	// 	return null;
	// }

	// // Extract the YAML content between delimiters
	// const yamlContent = fileContent.substring(4, secondDelimiterIndex);

	// try {
	// 	// Parse the YAML content
	// 	const frontmatter = yaml.load(yamlContent);
	// 	return frontmatter;
	// } catch (error) {
	// bugReporterManagerInsatance.addToLogs(
	// 	175,
	// 	`Failed to parse frontmatter: ${String(error)}`,
	// 	"FrontmatterOperations.ts/extractFrontmatterFromFile",
	// );
	// 	return null;
	// }

	// Method 2 - Get frontmatter using Obsidian API
	try {
		// API-1 : Get fronmatter as a string
		// const fileContent = await this.app.vault.cachedRead(file);
		// const frontmatterAsString =
		// 	getFrontMatterInfo(fileContent).frontmatter;

		// API-2 : Get frontmatter as an object
		const frontmatterAsObject =
			plugin.app.metadataCache.getFileCache(file)?.frontmatter;

		return frontmatterAsObject;
	} catch (error) {
		bugReporterManagerInsatance.addToLogs(
			176,
			`Failed to parse frontmatter: ${String(error)}`,
			"FrontmatterOperations.ts/extractFrontmatterFromFile",
		);
		return undefined;
	}
}

/**
 * Extract frontmatter from file content string
 * @param plugin - TaskBoard plugin instance
 * @param fileContent - Content of the file as string
 * @returns any - Frontmatter object or undefined if not found
 */
export function extractFrontmatterFromContent(
	plugin: TaskBoard,
	fileContent: string,
): customFrontmatterCache | undefined {
	// Method 1 - Find the frontmatter using delimiters
	// Check if the content starts with frontmatter delimiter
	if (!fileContent.startsWith("---\n")) {
		return undefined;
	}

	// Find the end of frontmatter
	const secondDelimiterIndex = fileContent.indexOf("\n---\n", 4);
	if (secondDelimiterIndex === -1) {
		return undefined;
	}

	// Extract the YAML content between delimiters
	const yamlContent = fileContent.substring(4, secondDelimiterIndex);

	try {
		// Parse the YAML content using Obsidian's API
		const frontmatter = parseYaml(yamlContent) as customFrontmatterCache;
		return frontmatter;
	} catch (error) {
		bugReporterManagerInsatance.addToLogs(
			107,
			String(error),
			"TaskContentFormatter.ts/sanitizeStatus",
		);
		return undefined;
	}
}

/**
 * Extract tags from frontmatter
 * @param frontmatter - Frontmatter object
 * @returns string[] - Array of tags
 */
export function extractFrontmatterTags(
	frontmatter: Partial<customFrontmatterCache> | undefined,
): string[] {
	if (!frontmatter) {
		return [];
	}

	let tags: string[] = [];

	// Check if there's a 'tags' property in frontmatter
	if (frontmatter.tags) {
		if (Array.isArray(frontmatter.tags)) {
			// If tags is an array, process each tag
			tags = frontmatter.tags.map((tag: unknown) => {
				const tagStr = String(tag).trim();
				// Ensure tags start with # if they don't already
				return tagStr.replace("#", "");
			});
		} else if (typeof frontmatter.tags === "string") {
			// If tags is a string, split by commas and process
			tags = frontmatter.tags
				.split(",")
				.map((tag: string) => {
					const tagStr = tag.trim();
					return tagStr.replace("#", "");
				})
				.filter((tag: string) => tag.length > 1); // Filter out empty tags
		}
	}

	return tags;
}

/**
 * Helper function to order frontmatter properties based on frontmatterFormatting index values
 * @param frontmatterObj - Unordered frontmatter object
 * @param frontmatterFormatting - Array of frontmatter formatting configs
 * @param existingFrontmatter - Optional existing frontmatter for additional properties
 * @returns Ordered frontmatter object
 */
function orderFrontmatterProperties(
	frontmatterObj: Partial<customFrontmatterCache>,
	frontmatterFormatting: FrontmatterFormattingInterface[],
	existingFrontmatter?: customFrontmatterCache,
): Partial<customFrontmatterCache> {
	const orderedFrontmatter: Partial<customFrontmatterCache> = {};

	// Create a set of all custom frontmatter keys for quick lookup
	const customKeys = new Set(
		frontmatterFormatting.map((format) => format.key),
	);

	// Sort frontmatter formatting by index and add properties in order
	const sortedFormatting = [...frontmatterFormatting].sort(
		(a, b) => a.index - b.index,
	);

	for (const format of sortedFormatting) {
		const key = format.key;
		// If the key exists in the frontmatter object, add it to the ordered object
		if (key in frontmatterObj) {
			orderedFrontmatter[key] = frontmatterObj[key] as unknown;
		}
	}

	// Add any additional properties from the frontmatter object that aren't in the formatted list
	for (const [key, value] of Object.entries(frontmatterObj)) {
		if (!(key in orderedFrontmatter) && !customKeys.has(key)) {
			orderedFrontmatter[key] = value as unknown;
		}
	}

	// Add any additional properties from existingFrontmatter if provided
	if (existingFrontmatter) {
		for (const [key, value] of Object.entries(existingFrontmatter)) {
			// Skip the index__ function
			if (key === "index__") continue;
			// Skip keys that are already in the ordered frontmatter
			if (!(key in orderedFrontmatter)) {
				orderedFrontmatter[key] = value as unknown;
			}
		}
	}

	return orderedFrontmatter;
}

/**
 * Create frontmatter YAML string from task item
 * @param task - Task item
 * @returns string - YAML frontmatter content
 */
export function createFrontmatterFromTask(
	plugin: TaskBoard,
	task: taskItem,
	frontmatterFormatting: FrontmatterFormattingInterface[],
): string {
	const frontmatterObj: Partial<customFrontmatterCache> = {};

	frontmatterObj[getCustomFrontmatterKey("title", frontmatterFormatting)] =
		task?.[DEFAULT_TASK_CACHE_KEYS.Title] || "";
	frontmatterObj[getCustomFrontmatterKey("status", frontmatterFormatting)] =
		getStatusNameFromStatusSymbol(
			task?.[DEFAULT_TASK_CACHE_KEYS.Status],
			plugin.settings.data.customStatuses ?? [],
		) || "pending";
	frontmatterObj[getCustomFrontmatterKey("tags", frontmatterFormatting)] = [
		plugin.settings.data.taskNoteIdentifierTag,
		...(task?.[DEFAULT_TASK_CACHE_KEYS.Tags]?.filter(
			(tag) =>
				!compareTwoTags(
					tag,
					plugin.settings.data.taskNoteIdentifierTag,
				),
		) ?? []),
	];

	if (task[DEFAULT_TASK_CACHE_KEYS.ID] && plugin.settings.data.autoAddUniqueID)
		frontmatterObj[
			getCustomFrontmatterKey(
				DEFAULT_TASK_CACHE_KEYS.ID,
				frontmatterFormatting,
			)
		] = task[DEFAULT_TASK_CACHE_KEYS.LegacyID] ? task[DEFAULT_TASK_CACHE_KEYS.LegacyID] : task[DEFAULT_TASK_CACHE_KEYS.ID];
	if (task[DEFAULT_TASK_CACHE_KEYS.Priority] && task[DEFAULT_TASK_CACHE_KEYS.Priority] > 0) {
		frontmatterObj[
			getCustomFrontmatterKey("priority", frontmatterFormatting)
		] = getPriorityNameForTaskNote(task[DEFAULT_TASK_CACHE_KEYS.Priority]) || "";
	}
	if (task[DEFAULT_TASK_CACHE_KEYS.CreatedDate])
		frontmatterObj[
			getCustomFrontmatterKey("createdDate", frontmatterFormatting)
		] = task[DEFAULT_TASK_CACHE_KEYS.CreatedDate];
	if (task[DEFAULT_TASK_CACHE_KEYS.StartDate])
		frontmatterObj[
			getCustomFrontmatterKey("startDate", frontmatterFormatting)
		] = task[DEFAULT_TASK_CACHE_KEYS.StartDate];
	if (task[DEFAULT_TASK_CACHE_KEYS.ScheduledDate])
		frontmatterObj[
			getCustomFrontmatterKey("scheduledDate", frontmatterFormatting)
		] = task[DEFAULT_TASK_CACHE_KEYS.ScheduledDate];
	if (task[DEFAULT_TASK_CACHE_KEYS.DueDate])
		frontmatterObj[
			getCustomFrontmatterKey(
				DEFAULT_TASK_CACHE_KEYS.DueDate,
				frontmatterFormatting,
			)
		] = task[DEFAULT_TASK_CACHE_KEYS.DueDate];
	if (task[DEFAULT_TASK_CACHE_KEYS.Time])
		frontmatterObj[getCustomFrontmatterKey("time", frontmatterFormatting)] =
			task[DEFAULT_TASK_CACHE_KEYS.Time];
	if (task[DEFAULT_TASK_CACHE_KEYS.Reminder])
		frontmatterObj[
			getCustomFrontmatterKey("reminder", frontmatterFormatting)
		] = task[DEFAULT_TASK_CACHE_KEYS.Reminder];
	if (task[DEFAULT_TASK_CACHE_KEYS.Dependencies] && task[DEFAULT_TASK_CACHE_KEYS.Dependencies].length > 0)
		frontmatterObj[
			getCustomFrontmatterKey("dependsOn", frontmatterFormatting)
		] = task[DEFAULT_TASK_CACHE_KEYS.Dependencies].join(", ");

	if (task[DEFAULT_TASK_CACHE_KEYS.CancelledDate])
		frontmatterObj[
			getCustomFrontmatterKey("cancelledDate", frontmatterFormatting)
		] = task[DEFAULT_TASK_CACHE_KEYS.CancelledDate];
	if (task[DEFAULT_TASK_CACHE_KEYS.CompletionDate])
		frontmatterObj[
			getCustomFrontmatterKey("completionDate", frontmatterFormatting)
		] = task[DEFAULT_TASK_CACHE_KEYS.CompletionDate];

	// Order the frontmatter properties based on index values
	const orderedFrontmatter = orderFrontmatterProperties(
		frontmatterObj,
		frontmatterFormatting,
	);

	return createYamlFromObject(orderedFrontmatter);
}

/**
 * Update existing frontmatter object with task properties
 * @param existingFrontmatter - Existing frontmatter object
 * @param task - Task item with updated properties
 * @returns object - Updated frontmatter object
 *
 * @todo Remove redundant code by creating a helper function for adding/deleting properties. This function seems to be doing expensive operations which might affect the performance and increase time complexity.
 */
export function updateFrontmatterProperties(
	plugin: TaskBoard,
	existingFrontmatter: customFrontmatterCache | undefined,
	task: taskItem,
	forceId?: boolean,
): Partial<customFrontmatterCache> {
	const frontmatterFormatting = getDefaultPropertyFrontmatterFormatting(
		plugin.settings.data.taskProperties,
	);
	const oldFrontmatter = existingFrontmatter;

	// Step 1: Build a temporary object with all the updated values
	const tempUpdates: Record<string, unknown> = {};

	if (task[DEFAULT_TASK_CACHE_KEYS.Title]) {
		tempUpdates[getCustomFrontmatterKey("title", frontmatterFormatting)] =
			task[DEFAULT_TASK_CACHE_KEYS.Title];
	} else {
		tempUpdates[getCustomFrontmatterKey("title", frontmatterFormatting)] =
			"";
	}

	// Ensure taskNote tag exists and respect removed tags (task.tags is source of truth)
	const tagsKey = getCustomFrontmatterKey("tags", frontmatterFormatting);
	const existingTagsRaw = existingFrontmatter?.[
		tagsKey as keyof customFrontmatterCache
	] as unknown;

	// Normalize existing tags to array of strings
	let existingTags: string[] = [];
	if (Array.isArray(existingTagsRaw)) {
		existingTags = existingTagsRaw.filter(Boolean) as string[];
	} else if (typeof existingTagsRaw === "string" && existingTagsRaw.length) {
		existingTags = existingTagsRaw
			.split(",")
			.map((t) => t.replace("#", "").trim())
			.filter(Boolean);
	}

	// Normalize task tags to array of strings (task.tags is the source of truth)
	// const taskTags: string[] = task.tags
	// 	? Array.isArray(task.tags)
	// 		? task.tags.map((t) => String(t).trim()).filter(Boolean)
	// 		: typeof task.tags === "string" &&
	// 		  task.tags &&
	// 		  task.tags.trim().length
	// 		? task.tags
	// 				.split(",")
	// 				.map((t) => t.trim())
	// 				.filter(Boolean)
	// 		: []
	// 	: [];

	const taskTags: string[] = task[DEFAULT_TASK_CACHE_KEYS.Tags].filter(Boolean);

	const identifierTag = plugin.settings.data.taskNoteIdentifierTag;

	// // Step 1: Add any new tags from task.tags that are not in existingTags
	// let newTagsToAdd = taskTags.filter((t) => !existingTags.includes(t));

	// Do not carry over tags that exist in existingTags but were removed from task.tags
	existingTags = existingTags.filter((tag: string) => taskTags.includes(tag));

	// Build final tags: identifier + all tags from taskTags (which covers common + new)
	let finalTags = [...taskTags, ...existingTags];

	const hasIdentifierTag = finalTags.some((tag) =>
		compareTwoTags(tag, identifierTag),
	);
	finalTags = hasIdentifierTag ? finalTags : [...finalTags, identifierTag];

	// Remove duplicates and empty entries
	tempUpdates[tagsKey] = Array.from(
		new Set(finalTags.map((t) => String(t).trim()).filter(Boolean)),
	);

	// Update or add unique ID
	const idKey = getCustomFrontmatterKey(
		DEFAULT_TASK_CACHE_KEYS.ID,
		frontmatterFormatting,
	);
	if (!existingFrontmatter?.[idKey]) {
		if (forceId || plugin.settings.data.autoAddUniqueID) {
			tempUpdates[idKey] = task[DEFAULT_TASK_CACHE_KEYS.LegacyID]
				? task[DEFAULT_TASK_CACHE_KEYS.LegacyID]
				: generateTaskId(plugin);
		}
	} else {
		// Preserve existing ID
		tempUpdates[idKey] = existingFrontmatter[idKey];
	}

	const statusKey = getCustomFrontmatterKey("status", frontmatterFormatting);
	if (task[DEFAULT_TASK_CACHE_KEYS.Status]) {
		const statusName = getStatusNameFromStatusSymbol(
			task[DEFAULT_TASK_CACHE_KEYS.Status],
			plugin.settings.data.customStatuses ?? [],
		);
		tempUpdates[statusKey] = statusName ?? `"${task[DEFAULT_TASK_CACHE_KEYS.Status]}"`;
	}

	// All the below properties are optional

	// Update time property
	const timeKey = getCustomFrontmatterKey("time", frontmatterFormatting);
	if (task[DEFAULT_TASK_CACHE_KEYS.Time]) {
		tempUpdates[timeKey] = task[DEFAULT_TASK_CACHE_KEYS.Time];
	} else {
		delete tempUpdates[timeKey];
		delete oldFrontmatter?.[timeKey];
	}

	// Update date properties
	const createdDateKey = getCustomFrontmatterKey(
		"createdDate",
		frontmatterFormatting,
	);
	if (task[DEFAULT_TASK_CACHE_KEYS.CreatedDate]) {
		tempUpdates[createdDateKey] = task[DEFAULT_TASK_CACHE_KEYS.CreatedDate];
	} else {
		delete tempUpdates[createdDateKey];
		delete oldFrontmatter?.[createdDateKey];
	}

	const startDateKey = getCustomFrontmatterKey(
		"startDate",
		frontmatterFormatting,
	);
	if (task[DEFAULT_TASK_CACHE_KEYS.StartDate]) {
		tempUpdates[startDateKey] = task[DEFAULT_TASK_CACHE_KEYS.StartDate];
	} else {
		delete tempUpdates[startDateKey];
		delete oldFrontmatter?.[startDateKey];
	}

	const scheduledDateKey = getCustomFrontmatterKey(
		"scheduledDate",
		frontmatterFormatting,
	);
	if (task[DEFAULT_TASK_CACHE_KEYS.ScheduledDate]) {
		tempUpdates[scheduledDateKey] = task[DEFAULT_TASK_CACHE_KEYS.ScheduledDate];
	} else {
		delete tempUpdates[scheduledDateKey];
		delete oldFrontmatter?.[scheduledDateKey];
	}

	const dueKey = getCustomFrontmatterKey("due", frontmatterFormatting);
	if (task[DEFAULT_TASK_CACHE_KEYS.DueDate]) {
		tempUpdates[dueKey] = task[DEFAULT_TASK_CACHE_KEYS.DueDate];
	} else {
		delete tempUpdates[dueKey];
		delete oldFrontmatter?.[dueKey];
	}

	const statusConfig = plugin.settings.data.customStatuses.find(
		(status) => status.symbol === task[DEFAULT_TASK_CACHE_KEYS.Status],
	);
	const statusType = statusConfig ? statusConfig.type : undefined;

	const cancelledDateKey = getCustomFrontmatterKey(
		"cancelledDate",
		frontmatterFormatting,
	);
	if (statusType === statusTypeNames.CANCELLED) {
		if (task[DEFAULT_TASK_CACHE_KEYS.CancelledDate]) {
			tempUpdates[cancelledDateKey] = task[DEFAULT_TASK_CACHE_KEYS.CancelledDate];
		} else {
			const globalSettings = plugin.settings.data;
			// const moment = _moment as unknown as typeof _moment.default;
			// const currentDateValue = moment().format(
			// 	globalSettings?.dateTimeFormat,
			// );
			const currentDateValue = formatToday(globalSettings.dateFormat);

			tempUpdates[cancelledDateKey] = currentDateValue;
		}
	} else {
		delete tempUpdates[cancelledDateKey];
		delete oldFrontmatter?.[cancelledDateKey];
	}

	const completionKey = getCustomFrontmatterKey(
		"completion",
		frontmatterFormatting,
	);
	if (statusType === statusTypeNames.DONE) {
		if (task[DEFAULT_TASK_CACHE_KEYS.CancelledDate]) {
			tempUpdates[completionKey] = task[DEFAULT_TASK_CACHE_KEYS.CompletionDate];
		} else {
			const globalSettings = plugin.settings.data;
			// const moment = _moment as unknown as typeof _moment.default;
			// const currentDateValue = moment().format(
			// 	globalSettings?.dateTimeFormat,
			// );
			const currentDateValue = formatToday(globalSettings.dateFormat);

			tempUpdates[completionKey] = currentDateValue;
		}
	} else {
		delete tempUpdates[completionKey];
		delete oldFrontmatter?.[completionKey];
	}

	const priorityKey = getCustomFrontmatterKey(
		"priority",
		frontmatterFormatting,
	);
	if (task[DEFAULT_TASK_CACHE_KEYS.Priority] && task[DEFAULT_TASK_CACHE_KEYS.Priority] > 0) {
		tempUpdates[priorityKey] =
			getPriorityNameForTaskNote(task[DEFAULT_TASK_CACHE_KEYS.Priority]) || "";
	} else {
		delete tempUpdates[priorityKey];
		delete oldFrontmatter?.[priorityKey];
	}

	const reminderKey = getCustomFrontmatterKey(
		"reminder",
		frontmatterFormatting,
	);
	if (task?.[DEFAULT_TASK_CACHE_KEYS.Reminder]) {
		tempUpdates[reminderKey] = task[DEFAULT_TASK_CACHE_KEYS.Reminder];
	} else {
		delete tempUpdates[reminderKey];
		delete oldFrontmatter?.[reminderKey];
	}

	const dependsOnKey = getCustomFrontmatterKey(
		"dependsOn",
		frontmatterFormatting,
	);
	if (task?.[DEFAULT_TASK_CACHE_KEYS.Dependencies] && task[DEFAULT_TASK_CACHE_KEYS.Dependencies].length > 0) {
		tempUpdates[dependsOnKey] = task[DEFAULT_TASK_CACHE_KEYS.Dependencies];
	} else {
		delete tempUpdates[dependsOnKey];
		delete oldFrontmatter?.[dependsOnKey];
	}

	// Persist configured custom values under each configured frontmatter ID.
	const builtInIds = new Set(
		plugin.settings.data.taskProperties
			.filter((property) => property.default)
			.map((property) => property.id),
	);
	for (const property of plugin.settings.data.taskProperties.filter(
		(property) => !property.default,
	)) {
		if (!property.id || builtInIds.has(property.id)) continue;
		if (Object.prototype.hasOwnProperty.call(task, property.id)) {
			const value = (task as unknown as Record<string, unknown>)[
				property.id
			];
			if (value === undefined || value === null || value === "") {
				delete tempUpdates[property.id];
				delete oldFrontmatter?.[property.id];
			} else {
				tempUpdates[property.id] = value;
			}
		}
	}

	// Step 2: Order the frontmatter properties and add additional properties from existing frontmatter
	const orderedFrontmatter = orderFrontmatterProperties(
		tempUpdates,
		frontmatterFormatting,
		oldFrontmatter,
	);

	return orderedFrontmatter;
}

/**
 * Create YAML string from object (simple implementation)
 * @param obj - Frontmatter object to convert to YAML string
 * @returns string - YAML string
 */
export function createYamlFromObject(
	obj: Partial<customFrontmatterCache>,
): string {
	// METHOD 1 - Using Obsidian's API
	const YAMLstringUsingAPI = stringifyYaml(obj);

	return YAMLstringUsingAPI;

	// METHOD 2 - Using manual string building
	// Simple YAML serialization (handles strings, numbers, arrays)
	// const lines: string[] = [];

	// for (const [key, value] of Object.entries(obj)) {
	// 	if (Array.isArray(value)) {
	// 		lines.push(`${key}:`);
	// 		for (const item of value) {
	// 			const newItem = item.startsWith('"') ? item : `"${item}"`;
	// 			lines.push(`  - ${newItem}`);
	// 		}
	// 	} else if (typeof value === "string") {
	// 		// Escape quotes and handle multiline
	// 		const escapedValue =
	// 			value.includes("\n") || value.includes('"')
	// 				? `"${value.replace(/"/g, '\\"')}"`
	// 				: value;
	// 		lines.push(`${key}: ${escapedValue}`);
	// 	} else {
	// 		lines.push(`${key}: ${value}`);
	// 	}
	// }

	// return lines.join("\n");
}
