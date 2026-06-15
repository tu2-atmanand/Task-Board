// /src/utils/TaskItemUtils.ts

import TaskBoard from "../../main.js";
import { taskItem } from "../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../managers/BugReporter.js";
import { extractTaskId } from "../managers/VaultScanner.js";
import { updateTaskInFile } from "./taskLine/TaskLineUtils.js";
import {
	isTaskNotePresentInTags,
	updateFrontmatterInMarkdownFile,
} from "./taskNote/TaskNoteUtils.js";

/**
 * Combines both the normal task.tags and frontmatter tags of a taskItem and return it as a single array.
 * @param task - Task item with updated properties
 * @returns string[] - Array of tags
 */
export const getAllTaskTags = (task: taskItem): string[] => {
	const lineTags = task.tags || [];
	const frontmatterTags = task.frontmatterTags || [];
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
					(task) => task.legacyId === id || task.id === id,
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
					(task) => task.legacyId === id || task.id === id,
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
	if (task.legacyId && String(task.legacyId).trim() !== "") {
		return String(task.legacyId);
	}

	// If it's a task note, ensure frontmatter has an ID and return it.
	if (
		isTaskNotePresentInTags(
			plugin.settings.data.taskNoteIdentifierTag,
			task.tags,
		)
	) {
		let newId = task.legacyId;
		if (!newId || String(newId).trim() === "") {
			newId = generateTaskId(plugin);
			task.legacyId = newId;
		}
		void updateFrontmatterInMarkdownFile(plugin, task, true);

		return newId;
	}

	// Try to extract an ID from the title (legacy inline format)
	const extractedTaskId = extractTaskId(task.title)?.[1];
	if (extractedTaskId) return extractedTaskId;

	// Otherwise, update the task line in the file which should return a new ID
	const newIdToReturn = await updateTaskInFile(plugin, task, task, true);
	return newIdToReturn;
};
