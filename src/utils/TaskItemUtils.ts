import TaskBoard from "main";
import { taskItem } from "src/interfaces/TaskItem";
import { bugReporter } from "src/services/OpenModals";
import { updateTaskInFile } from "./taskLine/TaskLineUtils";
import {
	isTaskNotePresentInTags,
	updateFrontmatterInMarkdownFile,
} from "./taskNote/TaskNoteUtils";
import { extractTaskId } from "src/managers/VaultScanner";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";

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
	id: string | number
): Promise<taskItem | null> => {
	try {
		let foundTask: taskItem | undefined | null;

		// Search in Pending tasks
		const pendingTasksObj = plugin.vaultScanner.tasksCache?.Pending ?? {};
		for (const tasks of Object.values(pendingTasksObj)) {
			if (id) {
				foundTask = tasks.find(
					(task) => task.legacyId === id || task.id === id
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
					(task) => task.legacyId === id || task.id === id
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
			"TaskItemUtils.ts/getTaskFromId"
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
 * @return {string} a random unique ID for a task
 */
export function generateRandomTempTaskId(): string {
	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	return String(array[0]);
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
	plugin.saveSettings();
	// Return the current counter value and then increment it for the next ID
	return String(plugin.settings.data.uniqueIdCounter);
}

/**
 * Applies a new id to the task in a file if it does not have one already. This function will force an id to be added to the task.
 * @param plugin - The TaskBoard plugin instance.
 * @param task - The taskItem object representing the task to which an id needs to be applied.
 * @returns A promise that resolves to the new id if applied, or undefined if the task already has an id or if an error occurs.
 *
 * @throws Will throw an error if there are issues updating the task in the file.
 */
export const applyIdToTaskItem = async (
	plugin: TaskBoard,
	task: taskItem
): Promise<string | undefined> => {
	if (
		isTaskNotePresentInTags(
			plugin.settings.data.taskNoteIdentifierTag,
			task.tags
		)
	) {
		let newId;
		if (task.legacyId === "") {
			newId = generateTaskId(plugin);
			task.legacyId = newId;
		}
		updateFrontmatterInMarkdownFile(plugin, task, true);

		return newId;
	} else {
		if (extractTaskId(task.title) !== "") return undefined;

		const newIdToReturn = await updateTaskInFile(plugin, task, task, true);
		return newIdToReturn;
	}
	// .then((newId) => {
	// 	newIdToReturn = newId;
	// })
	// .catch((error) => {
	// 	bugReporterManagerInsatance.showNotice(
	// 		83,
	// 		"Error while applying ID to the selected child task in its parent note. Below error message might give more information on this issue. Report the issue if it needs developers attention.",
	// 		String(error),
	// 		"TaskItemUtils.ts/applyIdToTaskItem"
	// 	);
	// 	return undefined;
	// });
	// return newIdToReturn;
	// }
};
