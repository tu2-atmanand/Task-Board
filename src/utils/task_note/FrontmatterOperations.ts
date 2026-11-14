// /src/utils/taskNote/FrontmatterOperations.ts

import { parseYaml, stringifyYaml, TFile } from "obsidian";

import TaskBoard from "../../../main.js";
import {
	DEFAULT_TASK_CACHE_KEYS,
	PropertyTypeConfig,
	statusTypeNames,
} from "../../interfaces/Enums.js";
import {
	coerceCustomTaskPropertyValue,
	customFrontmatterCache,
	taskItem,
} from "../../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../../core/managers/BugReporter.js";
import { formatToday } from "../DateTimeCalculations.js";
import { generateTaskId } from "../TaskItemUtils.js";
import {
	getStatusNameFromStatusSymbol,
	getPriorityNameForTaskNote,
} from "./TaskNoteUtils.js";
import type { SupportedPropertiesConfig } from "../../interfaces/GlobalSettings.js";
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
	tagsPropertyKey: string = DEFAULT_TASK_CACHE_KEYS.Tags,
): string[] {
	if (!frontmatter) {
		return [];
	}

	let tags: string[] = [];

	const tagValue = frontmatter[tagsPropertyKey];
	if (tagValue) {
		if (Array.isArray(tagValue)) {
			// If tags is an array, process each tag
			tags = tagValue.map((tag: unknown) => {
				const tagStr = String(tag).trim();
				// Ensure tags start with # if they don't already
				return tagStr.replace("#", "");
			});
		} else if (typeof tagValue === "string") {
			// If tags is a string, split by commas and process
			tags = tagValue
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
 * Helper function to order frontmatter properties based on configured ranks
 * @param frontmatterObj - Unordered frontmatter object
 * @param taskProperties - Configured task properties
 * @param existingFrontmatter - Optional existing frontmatter for additional properties
 * @returns Ordered frontmatter object
 */
function orderFrontmatterProperties(
	frontmatterObj: Partial<customFrontmatterCache>,
	taskProperties: SupportedPropertiesConfig[],
	existingFrontmatter?: customFrontmatterCache,
): Partial<customFrontmatterCache> {
	const orderedFrontmatter: Partial<customFrontmatterCache> = {};
	const orderedProperties = [...taskProperties].sort(
		(a, b) => a.rank - b.rank,
	);

	for (const property of orderedProperties) {
		if (property.id in frontmatterObj) {
			orderedFrontmatter[property.id] = frontmatterObj[
				property.id
			] as unknown;
		}
	}

	for (const [key, value] of Object.entries(frontmatterObj)) {
		if (!(key in orderedFrontmatter)) {
			orderedFrontmatter[key] = value as unknown;
		}
	}

	if (existingFrontmatter) {
		for (const [key, value] of Object.entries(existingFrontmatter)) {
			if (key === "index__") continue;
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
): string {
	const frontmatterObj: Record<string, unknown> = {};
	const taskValues = task as taskItem & Record<string, unknown>;
	for (const property of plugin.settings.data.taskProperties) {
		if (!property.id || !property.key) continue;
		const value = taskValues[property.key];

		switch (property.key) {
			case DEFAULT_TASK_CACHE_KEYS.Title:
				frontmatterObj[property.id] = value ?? "";
				break;
			case DEFAULT_TASK_CACHE_KEYS.Status:
				frontmatterObj[property.id] =
					getStatusNameFromStatusSymbol(
						typeof value === "string" ? value : undefined,
						plugin.settings.data.customStatuses ?? [],
					) || "pending";
				break;
			case DEFAULT_TASK_CACHE_KEYS.Tags: {
				const tags = Array.isArray(value) ? value : [];
				const identifierTag =
					plugin.settings.data.taskNoteIdentifierTag;
				frontmatterObj[property.id] = [
					identifierTag,
					...tags.filter(
						(tag) => !compareTwoTags(String(tag), identifierTag),
					),
				];
				break;
			}
			case DEFAULT_TASK_CACHE_KEYS.ID:
				if (
					value &&
					plugin.settings.data.autoAddUniqueID
				) {
					frontmatterObj[property.id] =
						task[DEFAULT_TASK_CACHE_KEYS.LegacyID] || value;
				}
				break;
			case DEFAULT_TASK_CACHE_KEYS.Priority:
				if (typeof value === "number" && value > 0) {
					frontmatterObj[property.id] =
						getPriorityNameForTaskNote(value);
				}
				break;
			default:
				if (value !== undefined && value !== null && value !== "") {
					frontmatterObj[property.id] =
						property.type === PropertyTypeConfig.list &&
						property.key ===
							DEFAULT_TASK_CACHE_KEYS.Dependencies &&
						Array.isArray(value)
							? value
							: coerceCustomTaskPropertyValue(
									value,
									property.type,
								) ?? value;
				}
		}
	}

	const orderedFrontmatter = orderFrontmatterProperties(
		frontmatterObj as Partial<customFrontmatterCache>,
		plugin.settings.data.taskProperties,
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
	const taskProperties = plugin.settings.data.taskProperties;
	const taskValues = task as taskItem & Record<string, unknown>;
	const tempUpdates: Record<string, unknown> = {};
	const statusConfig = plugin.settings.data.customStatuses.find(
		(status) => status.symbol === task[DEFAULT_TASK_CACHE_KEYS.Status],
	);
	const statusType = statusConfig ? statusConfig.type : undefined;
	const specialPropertyKeys = new Set<string>([
		DEFAULT_TASK_CACHE_KEYS.ID,
		DEFAULT_TASK_CACHE_KEYS.Status,
		DEFAULT_TASK_CACHE_KEYS.Tags,
		DEFAULT_TASK_CACHE_KEYS.Priority,
		DEFAULT_TASK_CACHE_KEYS.CancelledDate,
		DEFAULT_TASK_CACHE_KEYS.CompletionDate,
	]);

	for (const property of taskProperties) {
		if (
			!property.id ||
			!property.key ||
			specialPropertyKeys.has(property.key)
		) {
			continue;
		}
		if (
			!property.default &&
			!Object.prototype.hasOwnProperty.call(taskValues, property.key)
		) {
			continue;
		}

		const value = taskValues[property.key];
		if (value === undefined || value === null || value === "") {
			delete tempUpdates[property.id];
			if (existingFrontmatter) delete existingFrontmatter[property.id];
			continue;
		}

		const convertedValue = coerceCustomTaskPropertyValue(
			value,
			property.type,
		);
		tempUpdates[property.id] = convertedValue ?? value;
	}

	const tagsProperty = taskProperties.find(
		(property) => property.key === DEFAULT_TASK_CACHE_KEYS.Tags,
	);
	if (tagsProperty?.id) {
		const existingTagsRaw = existingFrontmatter?.[tagsProperty.id];
		const existingTags =
			Array.isArray(existingTagsRaw)
				? existingTagsRaw.map(String).filter(Boolean)
				: typeof existingTagsRaw === "string"
					? existingTagsRaw
							.split(",")
							.map((tag) => tag.replace("#", "").trim())
							.filter(Boolean)
					: [];
		const taskTags = Array.isArray(task[DEFAULT_TASK_CACHE_KEYS.Tags])
			? task[DEFAULT_TASK_CACHE_KEYS.Tags].filter(Boolean)
			: [];
		const finalTags = [
			...taskTags,
			...existingTags.filter((tag) => taskTags.includes(tag)),
		];
		const identifierTag = plugin.settings.data.taskNoteIdentifierTag;
		if (!finalTags.some((tag) => compareTwoTags(tag, identifierTag))) {
			finalTags.push(identifierTag);
		}
		tempUpdates[tagsProperty.id] = Array.from(
			new Set(finalTags.map((tag) => String(tag).trim()).filter(Boolean)),
		);
	}

	const idProperty = taskProperties.find(
		(property) => property.key === DEFAULT_TASK_CACHE_KEYS.ID,
	);
	if (idProperty?.id) {
		if (existingFrontmatter?.[idProperty.id]) {
			tempUpdates[idProperty.id] = existingFrontmatter[idProperty.id];
		} else if (forceId || plugin.settings.data.autoAddUniqueID) {
			tempUpdates[idProperty.id] =
				task[DEFAULT_TASK_CACHE_KEYS.LegacyID] ||
				generateTaskId(plugin);
		}
	}

	const statusProperty = taskProperties.find(
		(property) => property.key === DEFAULT_TASK_CACHE_KEYS.Status,
	);
	if (statusProperty?.id && task[DEFAULT_TASK_CACHE_KEYS.Status]) {
		const statusName = getStatusNameFromStatusSymbol(
			task[DEFAULT_TASK_CACHE_KEYS.Status],
			plugin.settings.data.customStatuses ?? [],
		);
		tempUpdates[statusProperty.id] =
			statusName ?? `"${task[DEFAULT_TASK_CACHE_KEYS.Status]}"`;
	}

	const priorityProperty = taskProperties.find(
		(property) => property.key === DEFAULT_TASK_CACHE_KEYS.Priority,
	);
	if (priorityProperty?.id) {
		const priority = task[DEFAULT_TASK_CACHE_KEYS.Priority];
		if (priority > 0) {
			tempUpdates[priorityProperty.id] =
				getPriorityNameForTaskNote(priority);
		} else {
			delete tempUpdates[priorityProperty.id];
			if (existingFrontmatter)
				delete existingFrontmatter[priorityProperty.id];
		}
	}

	const cancelledDateProperty = taskProperties.find(
		(property) => property.key === DEFAULT_TASK_CACHE_KEYS.CancelledDate,
	);
	if (cancelledDateProperty?.id) {
		if (statusType === statusTypeNames.CANCELLED) {
			tempUpdates[cancelledDateProperty.id] =
				task[DEFAULT_TASK_CACHE_KEYS.CancelledDate] ||
				formatToday(plugin.settings.data.dateFormat);
		} else {
			delete tempUpdates[cancelledDateProperty.id];
			if (existingFrontmatter)
				delete existingFrontmatter[cancelledDateProperty.id];
		}
	}

	const completionDateProperty = taskProperties.find(
		(property) => property.key === DEFAULT_TASK_CACHE_KEYS.CompletionDate,
	);
	if (completionDateProperty?.id) {
		if (statusType === statusTypeNames.DONE) {
			tempUpdates[completionDateProperty.id] =
				task[DEFAULT_TASK_CACHE_KEYS.CompletionDate] ||
				formatToday(plugin.settings.data.dateFormat);
		} else {
			delete tempUpdates[completionDateProperty.id];
			if (existingFrontmatter)
				delete existingFrontmatter[completionDateProperty.id];
		}
	}

	const orderedFrontmatter = orderFrontmatterProperties(
		tempUpdates as Partial<customFrontmatterCache>,
		taskProperties,
		existingFrontmatter,
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
