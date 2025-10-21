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

	return createYamlFromObject(frontmatterObj);
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
	const updatedFrontmatter: customFrontmatterCache = existingFrontmatter
		? { ...existingFrontmatter }
		: {
				index__(key: string): any {
					return undefined;
				},
		  };

	if (task.title) {
		updatedFrontmatter[
			getCustomFrontmatterKey("title", frontmatterFormatting)
		] = task.title;
	} else {
		updatedFrontmatter[
			getCustomFrontmatterKey("title", frontmatterFormatting)
		] = "";
	}

	// Ensure taskNote tag exists
	if (
		!updatedFrontmatter[
			getCustomFrontmatterKey("tags", frontmatterFormatting)
		]
	) {
		updatedFrontmatter[
			getCustomFrontmatterKey("tags", frontmatterFormatting)
		] = [
			plugin.settings.data.globalSettings.taskNoteIdentifierTag,
			...task.tags,
		];
	} else if (
		Array.isArray(
			updatedFrontmatter[
				getCustomFrontmatterKey("tags", frontmatterFormatting)
			]
		)
	) {
		updatedFrontmatter[
			getCustomFrontmatterKey("tags", frontmatterFormatting)
		] = [
			plugin.settings.data.globalSettings.taskNoteIdentifierTag,
			...updatedFrontmatter[
				getCustomFrontmatterKey("tags", frontmatterFormatting)
			],
			...task.tags,
		];
	}
	// Remove duplicate tags
	updatedFrontmatter[getCustomFrontmatterKey("tags", frontmatterFormatting)] =
		Array.from(
			new Set(
				updatedFrontmatter[
					getCustomFrontmatterKey("tags", frontmatterFormatting)
				]
			)
		);

	// Update or add unique ID
	if (plugin.settings.data.globalSettings.autoAddUniqueID) {
		if (
			!updatedFrontmatter[
				getCustomFrontmatterKey("id", frontmatterFormatting)
			]
		) {
			updatedFrontmatter[
				getCustomFrontmatterKey("id", frontmatterFormatting)
			] = task.legacyId ? task.legacyId : generateTaskId(plugin);
		}
	}

	// Update time property
	if (task.time) {
		updatedFrontmatter[
			getCustomFrontmatterKey("time", frontmatterFormatting)
		] = task.time;
	} else {
		delete updatedFrontmatter[
			getCustomFrontmatterKey("time", frontmatterFormatting)
		];
	}

	// Update properties
	if (task.createdDate) {
		updatedFrontmatter[
			getCustomFrontmatterKey("createdDate", frontmatterFormatting)
		] = task.createdDate;
	} else {
		delete updatedFrontmatter[
			getCustomFrontmatterKey("createdDate", frontmatterFormatting)
		];
	}

	if (task.startDate) {
		updatedFrontmatter[
			getCustomFrontmatterKey("startDate", frontmatterFormatting)
		] = task.startDate;
	} else {
		delete updatedFrontmatter[
			getCustomFrontmatterKey("startDate", frontmatterFormatting)
		];
	}

	if (task.scheduledDate) {
		updatedFrontmatter[
			getCustomFrontmatterKey("scheduledDate", frontmatterFormatting)
		] = task.scheduledDate;
	} else {
		delete updatedFrontmatter[
			getCustomFrontmatterKey("scheduledDate", frontmatterFormatting)
		];
	}

	if (task.due) {
		updatedFrontmatter[
			getCustomFrontmatterKey("due", frontmatterFormatting)
		] = task.due;
	} else {
		delete updatedFrontmatter[
			getCustomFrontmatterKey("due", frontmatterFormatting)
		];
	}

	if (task.cancelledDate) {
		updatedFrontmatter[
			getCustomFrontmatterKey("cancelledDate", frontmatterFormatting)
		] = task.cancelledDate;
	} else {
		delete updatedFrontmatter[
			getCustomFrontmatterKey("cancelledDate", frontmatterFormatting)
		];
	}

	if (task.completion) {
		updatedFrontmatter[
			getCustomFrontmatterKey("completion", frontmatterFormatting)
		] = task.completion;
	} else {
		delete updatedFrontmatter[
			getCustomFrontmatterKey("completion", frontmatterFormatting)
		];
	}

	if (task.priority && task.priority > 0) {
		updatedFrontmatter[
			getCustomFrontmatterKey("priority", frontmatterFormatting)
		] = getPriorityNameForTaskNote(task.priority) || "";
	} else {
		delete updatedFrontmatter[
			getCustomFrontmatterKey("priority", frontmatterFormatting)
		];
	}

	if (task.status) {
		const statusKey = Object.keys(taskStatuses).find(
			(key) =>
				taskStatuses[key as keyof typeof taskStatuses] === task.status
		);
		updatedFrontmatter[
			getCustomFrontmatterKey("status", frontmatterFormatting)
		] = statusKey ?? `"${task.status}"`;
	} else if (task.status === " ") {
		delete updatedFrontmatter[
			getCustomFrontmatterKey("status", frontmatterFormatting)
		];
	}

	if (task.reminder) {
		updatedFrontmatter[
			getCustomFrontmatterKey("reminder", frontmatterFormatting)
		] = task.reminder;
	} else {
		delete updatedFrontmatter[
			getCustomFrontmatterKey("reminder", frontmatterFormatting)
		];
	}

	// Update properties
	if (task.dependsOn) {
		updatedFrontmatter[
			getCustomFrontmatterKey("dependsOn", frontmatterFormatting)
		] = task.dependsOn;
	} else {
		delete updatedFrontmatter[
			getCustomFrontmatterKey("dependsOn", frontmatterFormatting)
		];
	}

	return updatedFrontmatter;
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
