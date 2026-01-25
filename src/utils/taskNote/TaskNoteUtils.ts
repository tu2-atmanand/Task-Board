// /src/utils/TaskNoteUtils.ts

import TaskBoard from "main";
import {
	updateFrontmatterProperties,
	createYamlFromObject,
	extractFrontmatterFromContent,
} from "./FrontmatterOperations";
import { customFrontmatterCache, taskItem } from "src/interfaces/TaskItem";
import {
	CustomStatus,
	frontmatterFormatting,
	globalSettingsData,
	PluginDataJson,
} from "src/interfaces/GlobalSettings";
import { Notice, normalizePath } from "obsidian";
import { bugReporter } from "src/services/OpenModals";
import { defaultTaskStatuses } from "src/interfaces/Enums";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";

/**
 * Check if a note is a Task Note by looking for TASK_NOTE_IDENTIFIER_TAG tag in frontmatter
 * @param frontmatter - The frontmatter object from a file
 * @returns boolean - True if the note contains TASK_NOTE_IDENTIFIER_TAG tag
 */
export function isTaskNotePresentInFrontmatter(
	taskNoteIdentifierTag: string,
	frontmatter: Partial<customFrontmatterCache> | undefined
): boolean {
	if (!frontmatter || !frontmatter.tags) {
		return false;
	}

	let tags: string[] = [];

	if (Array.isArray(frontmatter.tags)) {
		tags = frontmatter.tags.map((tag: any) => String(tag).trim());
	} else if (typeof frontmatter.tags === "string") {
		tags = frontmatter.tags.split(",").map((tag: string) => tag.trim());
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
	tags: string[]
): boolean {
	return tags
		? tags.some((tag) =>
				tag.toLowerCase().includes(taskNoteIdentifierTag.toLowerCase())
		  )
		: false;
}

/**
 * Extract task note properties from frontmatter
 * @param frontmatter - The frontmatter object
 * @param filePath - The file path
 * @returns Partial taskItem with properties mapped from frontmatter
 */
export function extractTaskNoteProperties(
	frontmatter: Partial<customFrontmatterCache> | undefined,
	filePath: string,
	settings: PluginDataJson
): Partial<taskItem> {
	if (!frontmatter) {
		return {};
	}

	const frontmatterFormatting: frontmatterFormatting[] =
		settings.data.globalSettings.frontmatterFormatting;

	return {
		id:
			frontmatter[getCustomFrontmatterKey("id", frontmatterFormatting)] ||
			"",
		title:
			frontmatter[
				getCustomFrontmatterKey("title", frontmatterFormatting)
			] || "",
		tags: Array.isArray(
			frontmatter[getCustomFrontmatterKey("tags", frontmatterFormatting)]
		)
			? frontmatter[
					getCustomFrontmatterKey("tags", frontmatterFormatting)
			  ]
			: typeof frontmatter[
					getCustomFrontmatterKey("tags", frontmatterFormatting)
			  ] === "string"
			? frontmatter[
					getCustomFrontmatterKey("tags", frontmatterFormatting)
			  ]
					.split(",")
					.map((tag: string) => tag.trim())
			: [],
		time:
			frontmatter[
				getCustomFrontmatterKey("time", frontmatterFormatting)
			] || "",
		createdDate:
			frontmatter[
				getCustomFrontmatterKey("createdDate", frontmatterFormatting)
			] || "",
		startDate:
			frontmatter[
				getCustomFrontmatterKey("startDate", frontmatterFormatting)
			] || "",
		scheduledDate:
			frontmatter[
				getCustomFrontmatterKey("scheduledDate", frontmatterFormatting)
			] || "",
		due:
			frontmatter[
				getCustomFrontmatterKey("due", frontmatterFormatting)
			] || "",
		cancelledDate:
			frontmatter[
				getCustomFrontmatterKey("cancelledDate", frontmatterFormatting)
			] || "",
		completion:
			frontmatter[
				getCustomFrontmatterKey("icompletiond", frontmatterFormatting)
			] || "",
		priority: mapPriorityNameFromFrontmatter(
			frontmatter[
				getCustomFrontmatterKey("priority", frontmatterFormatting)
			]
		),
		status: getStatusSymbolFromStatusName(
			frontmatter[
				getCustomFrontmatterKey("status", frontmatterFormatting)
			],
			settings
		),
		dependsOn:
			frontmatter[
				getCustomFrontmatterKey("dependsOn", frontmatterFormatting)
			] || [],
		reminder:
			frontmatter[
				getCustomFrontmatterKey("reminder", frontmatterFormatting)
			] || "",
		filePath: filePath,
	};
}

/**
 * Map priority emoji from frontmatter to priority number
 * @param priorityValue - Priority value from frontmatter
 * @returns number - Priority number (0-5)
 */
export function mapPriorityNameFromFrontmatter(priorityValue: any): number {
	if (!priorityValue) return 0;

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
 * Get priority emoji from priority number
 * @param priority - Priority number (1-5)
 * @returns string - Priority emoji
 */
export function getPriorityNameForTaskNote(priority: number): string {
	const priorityNames: { [key: number]: string } = {
		0: "None",
		1: "highest",
		2: "high",
		3: "medium",
		4: "low",
		5: "lowest",
	};
	return priorityNames[priority] || "URGENT";
}

export function getCustomFrontmatterKey(
	taskItemKey: string,
	frontmatterFormatting: frontmatterFormatting[]
): string {
	// Find the custom mapping for this task item key
	const customMapping = frontmatterFormatting.find(
		(mapping) => mapping.taskItemKey === taskItemKey
	);

	// Return custom frontmatter key if found, otherwise return the original key
	return customMapping?.key || taskItemKey;
}

/**
 * Map status string to status symbol
 * Eg. statusValue="Pending" then output will be " ".
 * @param statusName - Status value from frontmatter
 * @returns string - Status symbol
 */
export function getStatusSymbolFromStatusName(
	statusName: string | undefined,
	settings: PluginDataJson
): string {
	if (!statusName) return " ";

	// const statusStr = statusValue.trim().toLowerCase();

	// // Handle both symbol and name formats
	// if (Object.prototype.hasOwnProperty.call(taskStatuses, statusStr)) {
	// 	return (taskStatuses as Record<string, string>)[statusStr];
	// }
	// return " ";

	const tasksPluginStatusConfigs =
		settings.data.globalSettings.customStatuses;
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
	globalSettings: globalSettingsData
): string {
	if (!statusSymbol) return "pending";

	if (globalSettings) {
		const tasksPluginStatusConfigs = globalSettings.customStatuses;
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
 * Format the entire task note content with updated frontmatter
 * @param plugin - TaskBoard plugin instance
 * @param updatedTask - Task item with updated properties
 * @param oldNoteContent - Existing content of the note
 * @returns string - New content of the note with updated frontmatter
 */
export function formatTaskNoteContent(
	plugin: TaskBoard,
	updatedTask: taskItem,
	oldNoteContent: string
): {
	newContent: string;
	newFrontmatter: string;
	contentWithoutFrontmatter: string;
} {
	try {
		const existingFrontmatter = extractFrontmatterFromContent(
			plugin,
			oldNoteContent
		);

		// Update frontmatter properties based on updatedTask
		const updatedFrontmatter = updateFrontmatterProperties(
			plugin,
			existingFrontmatter,
			updatedTask
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
		console.error("Error updating task note frontmatter:", error);
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
 */
export async function updateFrontmatterInMarkdownFile(
	plugin: TaskBoard,
	task: taskItem,
	forceId?: boolean
): Promise<void> {
	try {
		const file = plugin.app.vault.getFileByPath(task.filePath);
		if (!file) {
			throw new Error(`File not found: ${task.filePath}`);
		}

		// Method 1 - Using Obsidian's filemanager API.
		await plugin.app.fileManager.processFrontMatter(file, (existing) => {
			const updated = updateFrontmatterProperties(
				plugin,
				existing,
				task,
				forceId
			);
			console.log(
				"updateFrontmatterInMarkdownFile...\nUpdated frontmatter",
				updated,
				"\nold frontmatter",
				existing
			);
			for (const key of Object.keys(updated)) {
				existing[key] = updated[key];
			}
		});

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
		console.error("Error updating task note frontmatter:", error);
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
	filePath: string
): Promise<void> {
	try {
		const file = plugin.app.vault.getFileByPath(filePath);
		if (!file) {
			bugReporterManagerInsatance.showNotice(
				64,
				"There was an issue while deleting the task note.",
				`File not found at path: ${filePath}`,
				"deleteTaskNote"
			);
			return;
		}

		await plugin.app.vault.trash(file, true);
		new Notice(`Task note deleted: ${file.name}`);
	} catch (error) {
		console.error("Error deleting task note:", error);
		bugReporterManagerInsatance.showNotice(
			65,
			"There was an issue while deleting the task note.",
			String(error),
			"deleteTaskNote"
		);
		throw error;
	}
}

/**
 * Archive a task note by moving it to the archived folder
 * @param plugin - TaskBoard plugin instance
 * @param filePath - Path to the file to archive
 */
export async function archiveTaskNote(
	plugin: TaskBoard,
	filePath: string
): Promise<void> {
	try {
		const file = plugin.app.vault.getFileByPath(filePath);
		if (!file) {
			bugReporterManagerInsatance.showNotice(
				66,
				"There was an issue while archiving the task note.",
				`File not found at path: ${filePath}`,
				"archiveTaskNote"
			);
			return;
		}

		// Get the archive folder path from settings
		const archiveFolderPath =
			plugin.settings.data.globalSettings.archivedTBNotesFolderPath;

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
			`${normalizedArchivePath}/${file.name}`
		);

		// Check if a file with the same name already exists in the archive folder
		if (await plugin.app.vault.adapter.exists(newFilePath)) {
			// Add timestamp to make filename unique
			const timestamp = new Date().getTime();
			const nameWithoutExt = file.basename;
			const ext = file.extension;
			const uniqueFilePath = normalizePath(
				`${normalizedArchivePath}/${nameWithoutExt}-${timestamp}.${ext}`
			);
			await plugin.app.vault.rename(file, uniqueFilePath);
			new Notice(
				`Task note archived as: ${nameWithoutExt}-${timestamp}.${ext}`
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
		console.error("Error archiving task note:", error);
		bugReporterManagerInsatance.showNotice(
			67,
			"There was an issue while archiving the task note.",
			String(error),
			"archiveTaskNote"
		);
		// throw error;
	}
}
