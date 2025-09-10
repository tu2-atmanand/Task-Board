import TaskBoard from "main";
import { FrontMatterCache, TFile } from "obsidian";
import {
	priorityEmojis,
	taskItem,
	taskStatuses,
} from "src/interfaces/TaskItem";
import { getLocalDateTimeString } from "./TimeCalculations";

export interface customFrontmatterCache extends FrontMatterCache {
	tags?: string[] | string;
	title?: string;
	"created-date"?: string;
	"start-date"?: string;
	"schedule-date"?: string;
	"due-date"?: string;
	"cancelled-date"?: string;
	"completion-date"?: string;
	priority?: string | number;
	status?: string;
	reminder?: string;
}

/**
 * Extract frontmatter from file content
 * @param plugin - TaskBoard plugin instance
 * @param file - Obsidian file
 * @returns any - Frontmatter object or null if not found
 */
export function extractFrontmatter(
	plugin: TaskBoard,
	file: TFile
): Partial<customFrontmatterCache> | undefined {
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
export function createFrontmatterFromTask(task: taskItem): string {
	const statusKey = Object.keys(taskStatuses).find(
		(key) => taskStatuses[key as keyof typeof taskStatuses] === task.status
	);

	const frontmatterObj: Partial<customFrontmatterCache> = {
		title: task?.title || "",
		status: statusKey ?? `"${task.status}"`,
		tags: [
			"#taskNote",
			...(task?.tags?.filter((tag) => tag !== "#taskNote") ?? []),
		],
	};

	if (task.id) frontmatterObj.id = task.id;
	if (task.priority && task.priority > 0) {
		frontmatterObj.priority = priorityEmojis[task.priority || 0];
	}
	if (task.createdDate) frontmatterObj["created-date"] = task.createdDate;
	if (task.startDate) frontmatterObj["start-date"] = task.startDate;
	if (task.scheduledDate)
		frontmatterObj["schedule-date"] = task.scheduledDate;
	if (task.due) frontmatterObj["due-date"] = task.due;
	if (task.time) frontmatterObj["time"] = task.time;
	if (task.reminder) frontmatterObj.reminder = task.reminder;

	if (task.cancelledDate)
		frontmatterObj["cancelled-date"] = task.cancelledDate;
	if (task.completion) frontmatterObj["completion-date"] = task.completion;

	return createYamlFromObject(frontmatterObj);
}

/**
 * Update existing frontmatter object with task properties
 * @param existingFrontmatter - Existing frontmatter object
 * @param task - Task item with updated properties
 * @returns object - Updated frontmatter object
 */
export function updateFrontmatterProperties(
	existingFrontmatter: customFrontmatterCache | undefined,
	task: taskItem
): Partial<customFrontmatterCache> {
	const updated: customFrontmatterCache = existingFrontmatter
		? { ...existingFrontmatter }
		: {
				index__(key: string): any {
					return undefined;
				},
		  };

	if (task.title) {
		updated.title = task.title;
	} else {
		updated.title = getLocalDateTimeString();
	}

	// Ensure taskNote tag exists
	if (!updated.tags) {
		updated.tags = ["#taskNote"];
	} else if (Array.isArray(updated.tags)) {
		if (
			!updated.tags.some(
				(tag: string) => tag === "taskNote" || tag === "#taskNote"
			)
		) {
			updated.tags.push("#taskNote");
		}
	}

	// Update properties
	if (task.createdDate) {
		updated["created-date"] = task.createdDate;
	} else {
		delete updated["created-date"];
	}

	if (task.startDate) {
		updated["start-date"] = task.startDate;
	} else {
		delete updated["start-date"];
	}

	if (task.scheduledDate) {
		updated["schedule-date"] = task.scheduledDate;
	} else {
		delete updated["schedule-date"];
	}

	if (task.due) {
		updated["due-date"] = task.due;
	} else {
		delete updated["due-date"];
	}

	if (task.cancelledDate) {
		updated["cancelled-date"] = task.cancelledDate;
	} else {
		delete updated["cancelled-date"];
	}

	if (task.completion) {
		updated["completion-date"] = task.completion;
	} else {
		delete updated["completion-date"];
	}

	if (task.priority && task.priority > 0) {
		updated.priority = priorityEmojis[task.priority || 0];
	} else {
		delete updated.priority;
	}

	if (task.status) {
		const statusKey = Object.keys(taskStatuses).find(
			(key) =>
				taskStatuses[key as keyof typeof taskStatuses] === task.status
		);
		updated.status = statusKey ?? `"${task.status}"`;
	} else if (task.status === " ") {
		delete updated.status;
	}

	if (task.reminder) {
		updated.reminder = task.reminder;
	} else {
		delete updated.reminder;
	}

	return updated;
}

/**
 * Create YAML string from object (simple implementation)
 * @param obj - Object to convert to YAML
 * @returns string - YAML string
 */
export function createYamlFromObject(
	obj: Partial<customFrontmatterCache>
): string {
	console.log("createYamlFromObject called with:", obj);
	// Simple YAML serialization (handles strings, numbers, arrays)
	const lines: string[] = [];

	for (const [key, value] of Object.entries(obj)) {
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) {
				const newItem = item.startsWith('"') ? item : `"${item}"`;
				lines.push(`  - ${newItem}`);
			}
		} else if (typeof value === "string") {
			// Escape quotes and handle multiline
			const escapedValue =
				value.includes("\n") || value.includes('"')
					? `"${value.replace(/"/g, '\\"')}"`
					: value;
			lines.push(`${key}: ${escapedValue}`);
		} else {
			lines.push(`${key}: ${value}`);
		}
	}

	return lines.join("\n");
}
