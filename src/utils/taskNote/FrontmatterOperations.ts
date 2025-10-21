import TaskBoard from "main";
import { FrontMatterCache, parseYaml, stringifyYaml, TFile } from "obsidian";
import { customFrontmatterCache, taskItem } from "src/interfaces/TaskItem";
import {
	getCustomFrontmatterKey,
	getPriorityNameForTaskNote,
	getStatusNameFromStatusSymbol,
	isTaskNotePresentInTags,
} from "./TaskNoteUtils";
import { taskStatuses } from "src/interfaces/Enums";
import { frontmatterFormatting } from "src/interfaces/GlobalSettings";
import { generateTaskId } from "src/managers/VaultScanner";

/**
 * Extract frontmatter from file content
 * @param plugin - TaskBoard plugin instance
 * @param file - Obsidian file
 * @returns any - Frontmatter object or null if not found
 */
export function extractFrontmatterFromFile(
	plugin: TaskBoard,
	file: TFile
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
	// 	console.warn("Failed to parse frontmatter:", error);
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
		// console.warn("Failed to parse frontmatter:", error);
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
	fileContent: string
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
		console.warn(
			"FrontmatterOperations.ts/extractFrontmatterFromContent : Failed to parse frontmatter:",
			error
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
	frontmatter: Partial<customFrontmatterCache> | undefined
): string[] {
	if (!frontmatter) {
		return [];
	}

	let tags: string[] = [];

	// Check if there's a 'tags' property in frontmatter
	if (frontmatter.tags) {
		if (Array.isArray(frontmatter.tags)) {
			// If tags is an array, process each tag
			tags = frontmatter.tags.map((tag: any) => {
				const tagStr = String(tag).trim();
				// Ensure tags start with # if they don't already
				return tagStr.startsWith("#") ? tagStr : `#${tagStr}`;
			});
		} else if (typeof frontmatter.tags === "string") {
			// If tags is a string, split by commas and process
			tags = frontmatter.tags
				.split(",")
				.map((tag: string) => {
					const tagStr = tag.trim();
					return tagStr.startsWith("#") ? tagStr : `#${tagStr}`;
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
	frontmatterFormatting: frontmatterFormatting[],
	existingFrontmatter?: customFrontmatterCache
): Partial<customFrontmatterCache> {
	const orderedFrontmatter: Partial<customFrontmatterCache> = {};
	
	// Create a set of all custom frontmatter keys for quick lookup
	const customKeys = new Set(
		frontmatterFormatting.map((format) => format.key)
	);

	// Sort frontmatter formatting by index and add properties in order
	const sortedFormatting = [...frontmatterFormatting].sort((a, b) => a.index - b.index);
	
	for (const format of sortedFormatting) {
		const key = format.key;
		// If the key exists in the frontmatter object, add it to the ordered object
		if (key in frontmatterObj) {
			orderedFrontmatter[key] = frontmatterObj[key];
		}
	}

	// Add any additional properties from the frontmatter object that aren't in the formatted list
	for (const [key, value] of Object.entries(frontmatterObj)) {
		if (!(key in orderedFrontmatter) && !customKeys.has(key)) {
			orderedFrontmatter[key] = value;
		}
	}

	// Add any additional properties from existingFrontmatter if provided
	if (existingFrontmatter) {
		for (const [key, value] of Object.entries(existingFrontmatter)) {
			// Skip the index__ function
			if (key === "index__") continue;
			// Skip keys that are already in the ordered frontmatter
			if (!(key in orderedFrontmatter)) {
				orderedFrontmatter[key] = value;
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
	frontmatterFormatting: frontmatterFormatting[]
): string {
	const statusKey = Object.keys(taskStatuses).find(
		(key) => taskStatuses[key as keyof typeof taskStatuses] === task.status
	);

	const frontmatterObj: Partial<customFrontmatterCache> = {};

	frontmatterObj[getCustomFrontmatterKey("title", frontmatterFormatting)] =
		task?.title || "";
	frontmatterObj[getCustomFrontmatterKey("status", frontmatterFormatting)] =
		getStatusNameFromStatusSymbol(task?.status) || "pending";
	frontmatterObj[getCustomFrontmatterKey("tags", frontmatterFormatting)] = [
		plugin.settings.data.globalSettings.taskNoteIdentifierTag,
		...(task?.tags?.filter(
			(tag) =>
				tag.includes(
					plugin.settings.data.globalSettings.taskNoteIdentifierTag
				) === false
		) ?? []),
	];

	if (task.id && plugin.settings.data.globalSettings.autoAddUniqueID)
		frontmatterObj[getCustomFrontmatterKey("id", frontmatterFormatting)] =
			task.legacyId ? task.legacyId : task.id;
	if (task.priority && task.priority > 0) {
		frontmatterObj[
			getCustomFrontmatterKey("priority", frontmatterFormatting)
		] = getPriorityNameForTaskNote(task.priority) || "";
	}
	if (task.createdDate)
		frontmatterObj[
			getCustomFrontmatterKey("createdDate", frontmatterFormatting)
		] = task.createdDate;
	if (task.startDate)
		frontmatterObj[
			getCustomFrontmatterKey("startDate", frontmatterFormatting)
		] = task.startDate;
	if (task.scheduledDate)
		frontmatterObj[
			getCustomFrontmatterKey("scheduledDate", frontmatterFormatting)
		] = task.scheduledDate;
	if (task.due)
		frontmatterObj[getCustomFrontmatterKey("due", frontmatterFormatting)] =
			task.due;
	if (task.time)
		frontmatterObj[getCustomFrontmatterKey("time", frontmatterFormatting)] =
			task.time;
	if (task.reminder)
		frontmatterObj[
			getCustomFrontmatterKey("reminder", frontmatterFormatting)
		] = task.reminder;
	if (task.dependsOn && task.dependsOn.length > 0)
		frontmatterObj[
			getCustomFrontmatterKey("dependsOn", frontmatterFormatting)
		] = task.dependsOn.join(", ");

	if (task.cancelledDate)
		frontmatterObj[
			getCustomFrontmatterKey("cancelledDate", frontmatterFormatting)
		] = task.cancelledDate;
	if (task.completion)
		frontmatterObj[
			getCustomFrontmatterKey("completion", frontmatterFormatting)
		] = task.completion;

	// Order the frontmatter properties based on index values
	const orderedFrontmatter = orderFrontmatterProperties(frontmatterObj, frontmatterFormatting);
	
	return createYamlFromObject(orderedFrontmatter);
}

/**
 * Update existing frontmatter object with task properties
 * @param existingFrontmatter - Existing frontmatter object
 * @param task - Task item with updated properties
 * @returns object - Updated frontmatter object
 */
export function updateFrontmatterProperties(
	plugin: TaskBoard,
	existingFrontmatter: customFrontmatterCache | undefined,
	task: taskItem
): Partial<customFrontmatterCache> {
	const frontmatterFormatting: frontmatterFormatting[] =
		plugin.settings.data.globalSettings.frontmatterFormatting;
	
	// Step 1: Build a temporary object with all the updated values
	const tempUpdates: Record<string, any> = {};

	if (task.title) {
		tempUpdates[getCustomFrontmatterKey("title", frontmatterFormatting)] = task.title;
	} else {
		tempUpdates[getCustomFrontmatterKey("title", frontmatterFormatting)] = "";
	}

	// Ensure taskNote tag exists
	const tagsKey = getCustomFrontmatterKey("tags", frontmatterFormatting);
	const existingTags = existingFrontmatter?.[tagsKey];
	if (!existingTags) {
		tempUpdates[tagsKey] = [
			plugin.settings.data.globalSettings.taskNoteIdentifierTag,
			...task.tags,
		];
	} else if (Array.isArray(existingTags)) {
		tempUpdates[tagsKey] = [
			plugin.settings.data.globalSettings.taskNoteIdentifierTag,
			...existingTags,
			...task.tags,
		];
	}
	// Remove duplicate tags
	if (tempUpdates[tagsKey]) {
		tempUpdates[tagsKey] = Array.from(new Set(tempUpdates[tagsKey]));
	}

	// Update or add unique ID
	if (plugin.settings.data.globalSettings.autoAddUniqueID) {
		const idKey = getCustomFrontmatterKey("id", frontmatterFormatting);
		if (!existingFrontmatter?.[idKey]) {
			tempUpdates[idKey] = task.legacyId ? task.legacyId : generateTaskId(plugin);
		} else {
			// Preserve existing ID
			tempUpdates[idKey] = existingFrontmatter[idKey];
		}
	}

	// Update time property
	const timeKey = getCustomFrontmatterKey("time", frontmatterFormatting);
	if (task.time) {
		tempUpdates[timeKey] = task.time;
	}

	// Update date properties
	const createdDateKey = getCustomFrontmatterKey("createdDate", frontmatterFormatting);
	if (task.createdDate) {
		tempUpdates[createdDateKey] = task.createdDate;
	}

	const startDateKey = getCustomFrontmatterKey("startDate", frontmatterFormatting);
	if (task.startDate) {
		tempUpdates[startDateKey] = task.startDate;
	}

	const scheduledDateKey = getCustomFrontmatterKey("scheduledDate", frontmatterFormatting);
	if (task.scheduledDate) {
		tempUpdates[scheduledDateKey] = task.scheduledDate;
	}

	const dueKey = getCustomFrontmatterKey("due", frontmatterFormatting);
	if (task.due) {
		tempUpdates[dueKey] = task.due;
	}

	const cancelledDateKey = getCustomFrontmatterKey("cancelledDate", frontmatterFormatting);
	if (task.cancelledDate) {
		tempUpdates[cancelledDateKey] = task.cancelledDate;
	}

	const completionKey = getCustomFrontmatterKey("completion", frontmatterFormatting);
	if (task.completion) {
		tempUpdates[completionKey] = task.completion;
	}

	const priorityKey = getCustomFrontmatterKey("priority", frontmatterFormatting);
	if (task.priority && task.priority > 0) {
		tempUpdates[priorityKey] = getPriorityNameForTaskNote(task.priority) || "";
	}

	const statusKey = getCustomFrontmatterKey("status", frontmatterFormatting);
	if (task.status && task.status !== " ") {
		const statusKeyName = Object.keys(taskStatuses).find(
			(key) =>
				taskStatuses[key as keyof typeof taskStatuses] === task.status
		);
		tempUpdates[statusKey] = statusKeyName ?? `"${task.status}"`;
	}

	const reminderKey = getCustomFrontmatterKey("reminder", frontmatterFormatting);
	if (task.reminder) {
		tempUpdates[reminderKey] = task.reminder;
	}

	const dependsOnKey = getCustomFrontmatterKey("dependsOn", frontmatterFormatting);
	if (task.dependsOn) {
		tempUpdates[dependsOnKey] = task.dependsOn;
	}

	// Step 2: Order the frontmatter properties and add additional properties from existing frontmatter
	const orderedFrontmatter = orderFrontmatterProperties(
		tempUpdates, 
		frontmatterFormatting, 
		existingFrontmatter
	);

	return orderedFrontmatter;
}

/**
 * Create YAML string from object (simple implementation)
 * @param obj - Frontmatter object to convert to YAML string
 * @returns string - YAML string
 */
export function createYamlFromObject(
	obj: Partial<customFrontmatterCache>
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
