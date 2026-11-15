// /src/utils/TaskNoteUtils.ts

import { Notice, normalizePath } from "obsidian";
import TaskBoard from "../../../main.js";
import {
	PluginDataJson,
	CustomStatus,
	SupportedPropertiesConfig,
} from "../../interfaces/GlobalSettings.js";
import {
	coerceCustomTaskPropertyValue,
	customFrontmatterCache,
	taskItem,
} from "../../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../../core/managers/BugReporter.js";
import {
	extractFrontmatterFromContent,
	updateFrontmatterProperties,
	createYamlFromObject,
	extractFrontmatterTags,
} from "./FrontmatterOperations.js";
import { DEFAULT_TASK_CACHE_KEYS } from "../../interfaces/Enums.js";
import {
	getPriorityNumberUsingPriorityName,
	getStatusSymbolFromStatusName,
} from "../TaskItemUtils.js";

/**
 * Check if a note is a Task Note by looking for TASK_NOTE_IDENTIFIER_TAG tag in frontmatter
 * @param frontmatter - The frontmatter object from a file
 * @returns boolean - True if the note contains TASK_NOTE_IDENTIFIER_TAG tag
 */
export function isTaskNotePresentInFrontmatter(
	taskNoteIdentifierTag: string,
	frontmatter: Partial<customFrontmatterCache> | undefined,
	tagsPropertyKey: string = DEFAULT_TASK_CACHE_KEYS.Tags,
): boolean {
	const tagValue = frontmatter?.[tagsPropertyKey];
	if (!tagValue) {
		return false;
	}

	let tags: string[] = [];

	if (Array.isArray(tagValue)) {
		tags = tagValue.map((tag: unknown) => String(tag).trim());
	} else if (typeof tagValue === "string") {
		tags = tagValue.split(",").map((tag: string) => tag.trim());
	}

	// Check for TASK_NOTE_IDENTIFIER_TAG tag (with or without #)
	return isTaskNotePresentInTags(taskNoteIdentifierTag, tags);
}

/**
 * Check if a note is a Task Note by looking for #TASK_NOTE_IDENTIFIER_TAG tag in tags
 * @param tags - The tags array from a file
 * @returns boolean - True if the note contains #TASK_NOTE_IDENTIFIER_TAG tag
 */
export function isTaskNotePresentInTags(
	taskNoteIdentifierTag: string,
	tags: string[],
): boolean {
	return tags
		? tags.some((tag) =>
				tag.toLowerCase().includes(taskNoteIdentifierTag.toLowerCase()),
			)
		: false;
}

export function validateFrontmatterValue(
	frontmatter: Partial<customFrontmatterCache>,
	customKey: string,
	valueType: "string" | "number" | "array",
): string | number | string[] | undefined {
	const value = (frontmatter[customKey] as unknown) ?? "";

	if (value && typeof value === valueType) {
		return value as string | number | string[];
	}
	return undefined;
}

/**
 * Extract task note properties from frontmatter
 * @param frontmatter - The frontmatter object
 * @param filePath - The file path
 * @returns Partial taskItem with properties mapped from frontmatter
 */
export function extractTaskNoteProperties(
	frontmatter: Partial<customFrontmatterCache> | undefined,
	settings: PluginDataJson,
): Partial<taskItem> {
	if (!frontmatter) {
		return {};
	}

	const taskProperties = settings.data.taskProperties;
	let taskItemData: Partial<taskItem> = {};

	const taskPropertiesByKey = taskItemData as Record<string, unknown>;
	for (const property of taskProperties) {
		if (!property.id || !property.key) continue;
		const rawValue = frontmatter[property.id];
		if (rawValue === undefined || rawValue === null) continue;

		switch (property.key) {
			case DEFAULT_TASK_CACHE_KEYS.Tags:
				taskPropertiesByKey[property.key] = extractFrontmatterTags(
					frontmatter,
					property.id,
				);
				break;
			case DEFAULT_TASK_CACHE_KEYS.Status:
				if (typeof rawValue === "string") {
					taskPropertiesByKey[property.key] =
						getStatusSymbolFromStatusName(rawValue, settings);
				}
				break;
			case DEFAULT_TASK_CACHE_KEYS.Priority:
				if (
					typeof rawValue === "string" ||
					typeof rawValue === "number"
				) {
					taskPropertiesByKey[property.key] =
						getPriorityNumberUsingPriorityName(
							String(rawValue),
							settings.data.customPriorities ?? [],
						);
				}
				break;
			case DEFAULT_TASK_CACHE_KEYS.Dependencies:
				taskPropertiesByKey[property.key] =
					coerceCustomTaskPropertyValue(rawValue, property.type) ??
					(typeof rawValue === "string" && rawValue.trim()
						? rawValue.split(",").map((item) => item.trim())
						: undefined);
				break;
			default: {
				const value = coerceCustomTaskPropertyValue(
					rawValue,
					property.type,
				);
				if (value !== undefined)
					taskPropertiesByKey[property.key] = value;
			}
		}
	}

	return taskItemData;
}

export function getCustomFrontmatterKey(
	taskItemKey: string,
	taskProperties: SupportedPropertiesConfig[],
): string {
	const property = taskProperties.find(
		(configuredProperty) => configuredProperty.key === taskItemKey,
	);
	return property?.id || taskItemKey;
}

/**
 * Format the entire task note content with updated frontmatter
 * @param plugin - TaskBoard plugin instance
 * @param updatedTask - Task item with updated properties
 * @param oldNoteContent - Existing content of the note
 * @returns string - New content of the note with updated frontmatter
 */
export function formatTaskNoteContent(
	plugin: TaskBoard,
	updatedTask: taskItem,
	oldNoteContent: string,
): {
	newContent: string;
	newFrontmatter: string;
	contentWithoutFrontmatter: string;
} {
	try {
		const existingFrontmatter = extractFrontmatterFromContent(
			plugin,
			oldNoteContent,
		);

		// Update frontmatter properties based on updatedTask
		const updatedFrontmatter = updateFrontmatterProperties(
			plugin,
			existingFrontmatter,
			updatedTask,
		);
		const newFrontmatter = createYamlFromObject(updatedFrontmatter);

		const frontmatterMatch = oldNoteContent.match(/^---\n([\s\S]*?)\n---/);
		const contentWithoutFrontmatter = frontmatterMatch
			? oldNoteContent.replace(frontmatterMatch[0], "")
			: oldNoteContent;
		const newContent = `---\n${newFrontmatter}---${
			contentWithoutFrontmatter || ""
		}`; // I hope the content returned from the stringifyYaml API will always have a newline at the end.
		return { newContent, newFrontmatter, contentWithoutFrontmatter };
	} catch (error) {
		bugReporterManagerInsatance.addToLogs(
			157,
			String(error),
			"TaskNoteUtils.ts/formatTaskNoteContent",
		);
		return {
			newContent: "",
			newFrontmatter: "",
			contentWithoutFrontmatter: "",
		}; // Return empty content on error
	}
}

/**
 * Update frontmatter properties from task item
 * @param plugin - TaskBoard plugin instance
 * @param task - Task item with updated properties
 * @param forceId (Optional) - Whether to forcefully add ID property in frontmatter
 * @returns Promise<void>
 *
 * @error_code 158
 */
export async function updateFrontmatterInMarkdownFile(
	plugin: TaskBoard,
	task: taskItem,
	forceId?: boolean,
): Promise<void> {
	try {
		const file = plugin.app.vault.getFileByPath(
			task[DEFAULT_TASK_CACHE_KEYS.FilePath],
		);
		if (!file) {
			throw new Error(
				`File not found: ${task[DEFAULT_TASK_CACHE_KEYS.FilePath]}`,
			);
		}

		// Method 1 - Using Obsidian's filemanager API.
		await plugin.app.fileManager.processFrontMatter(
			file,
			(existing: customFrontmatterCache) => {
				const updated = updateFrontmatterProperties(
					plugin,
					existing,
					task,
					forceId,
				);
				for (const key of Object.keys(updated)) {
					existing[key] = updated[key] as unknown;
				}
			},
		);

		return;

		// METHOD 2 - Using custom logic

		// const fileContent = await readDataOfVaultFile(plugin, task.filePath);
		// const existingFrontmatter =
		// 	plugin.app.metadataCache.getFileCache(file)?.frontmatter;
		// // const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);

		// if (!existingFrontmatter) {
		// 	// No frontmatter exists, create new one
		// 	const newFrontmatter = createFrontmatterFromTask(plugin, task);
		// 	const newContent = `---\n${newFrontmatter}\n---\n${fileContent}`;
		// 	await writeDataToVaultFile(plugin, task.filePath, newContent);
		// 	return;
		// }

		// // Parse existing frontmatter and update properties
		// const updatedFrontmatter = updateFrontmatterProperties(
		// 	plugin,
		// 	existingFrontmatter,
		// 	task
		// );

		// // Reconstruct the file content with updated frontmatter
		// const frontmatterYaml = createYamlFromObject(updatedFrontmatter);
		// const contentAfterFrontmatter = fileContent.replace(
		// 	/^---\n[\s\S]*?\n---\n/,
		// 	""
		// );
		// const newContent = `---\n${frontmatterYaml}\n---\n${contentAfterFrontmatter}`;

		// await writeDataToVaultFile(plugin, task.filePath, newContent);
	} catch (error) {
		bugReporterManagerInsatance.addToLogs(
			158,
			String(error),
			"TaskNoteUtils.ts/updateFrontmatterInMarkdownFile",
		);
		throw error;
	}
}

/**
 * Delete a task note file
 * @param plugin - TaskBoard plugin instance
 * @param filePath - Path to the file to delete
 */
export async function deleteTaskNote(
	plugin: TaskBoard,
	filePath: string,
): Promise<void> {
	try {
		const file = plugin.app.vault.getFileByPath(filePath);
		if (!file) {
			bugReporterManagerInsatance.showNotice(
				64,
				"There was an issue while deleting the task note.",
				`File not found at path: ${filePath}`,
				"deleteTaskNote",
			);
			return;
		}

		await plugin.app.fileManager.trashFile(file);
		new Notice(`Task note deleted: ${file.name}`);
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			65,
			"There was an issue while deleting the task note.",
			String(error),
			"deleteTaskNote",
		);
		throw error;
	}
}

/**
 * Archive a task-note by moving it to the archived folder
 * @param plugin - TaskBoard plugin instance
 * @param filePath - Path to the file to archive
 */
export async function archiveTaskNote(
	plugin: TaskBoard,
	filePath: string,
): Promise<void> {
	try {
		const file = plugin.app.vault.getFileByPath(filePath);
		if (!file) {
			bugReporterManagerInsatance.showNotice(
				66,
				"There was an issue while archiving the task note.",
				`File not found at path: ${filePath}`,
				"archiveTaskNote",
			);
			return;
		}

		// Get the archive folder path from settings
		const archiveFolderPath =
			plugin.settings.data.archivedTBNotesFolderPath;

		if (!archiveFolderPath || archiveFolderPath.trim() === "") {
			new Notice("Archive folder path is not configured in settings");
			return;
		}

		// Normalize the archive folder path
		const normalizedArchivePath = normalizePath(archiveFolderPath);

		// Ensure the archive folder exists
		if (!(await plugin.app.vault.adapter.exists(normalizedArchivePath))) {
			await plugin.app.vault.createFolder(normalizedArchivePath);
		}

		// Construct the new file path
		const newFilePath = normalizePath(
			`${normalizedArchivePath}/${file.name}`,
		);

		// Check if a file with the same name already exists in the archive folder
		if (await plugin.app.vault.adapter.exists(newFilePath)) {
			// Add timestamp to make filename unique
			const timestamp = new Date().getTime();
			const nameWithoutExt = file.basename;
			const ext = file.extension;
			const uniqueFilePath = normalizePath(
				`${normalizedArchivePath}/${nameWithoutExt}-${timestamp}.${ext}`,
			);
			await plugin.app.vault.rename(file, uniqueFilePath);
			new Notice(
				`Task note archived as: ${nameWithoutExt}-${timestamp}.${ext}`,
			);
		} else {
			await plugin.app.vault.rename(file, newFilePath);
			new Notice(`Task note archived: ${file.name}`);
		}

		if (plugin.vaultScanner.tasksCache.Pending[filePath])
			delete plugin.vaultScanner.tasksCache.Pending[filePath];

		if (plugin.vaultScanner.tasksCache.Completed[filePath])
			delete plugin.vaultScanner.tasksCache.Completed[filePath];
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			67,
			"There was an issue while archiving the task note.",
			String(error),
			"archiveTaskNote",
		);
		// throw error;
	}
}
