/**
 * @deprecated Since version `1.3.0`, Task Board no longer updates the cache data directly after user events. Now the task is updated first in the file and then immediately after some delay the file is re-scanned to updated the cache automatically and refresh the view.
 *
 * @file TaskItemCacheOperations.ts
 * @author tu2-atmanand
 * @description This file contains functions for adding, updating, and deleting tasks from the task list in the JSON file/cache file.
 */

import TaskBoard from "../../main.js";
import {
	jsonCacheData,
	taskItem,
	taskItemWithCustomProperties,
} from "../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../core/managers/BugReporter.js";
import { eventEmitter } from "../services/EventEmitter.js";
import { getCurrentLocalDateTimeString } from "./DateTimeCalculations.js";
import {
	loadJsonCacheDataFromDisk,
	writeJsonCacheDataToDisk,
} from "./JsonFileOperations.js";
import {
	extractFrontmatterFromFile,
	extractFrontmatterTags,
} from "./task_note/FrontmatterOperations.js";
import { DEFAULT_TASK_CACHE_KEYS } from "../interfaces/Enums.js";


/**
 * @deprecated Since version `1.3.0`, Task Board no longer updates the cache data directly after user events. Now the task is updated first in the file and then immediately after some delay the file is re-scanned to updated the cache automatically and refresh the view.
 * 
 * Move a task from Pending to Completed in the tasks.json file (cache file).
 * @param plugin - The Taskboard plugin instance.
 * @param task - The task to move from Pending to Completed.
 * @returns A promise that resolves with the updated task item.
 */
export const moveFromPendingToCompleted = async (
	plugin: TaskBoard,
	task: taskItemWithCustomProperties,
) => {
	try {
		const allTasks = await loadJsonCacheDataFromDisk(plugin);

		// Move task from Pending to Completed
		if (allTasks.Pending[task[DEFAULT_TASK_CACHE_KEYS.FilePath]]) {
			allTasks.Pending[task[DEFAULT_TASK_CACHE_KEYS.FilePath]] = (
				allTasks.Pending[task[DEFAULT_TASK_CACHE_KEYS.FilePath]] || []
			).filter((t: taskItemWithCustomProperties) => t[DEFAULT_TASK_CACHE_KEYS.ID] !== task[DEFAULT_TASK_CACHE_KEYS.ID]);

			if (!allTasks.Completed[task[DEFAULT_TASK_CACHE_KEYS.FilePath]]) {
				allTasks.Completed[task[DEFAULT_TASK_CACHE_KEYS.FilePath]] = [];
			}
			allTasks.Completed[task[DEFAULT_TASK_CACHE_KEYS.FilePath]].push(task);
		}

		// Write the updated data back to the JSON file
		await writeJsonCacheDataToDisk(plugin, allTasks);
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			78,
			"Error updating task in tasks.json",
			error as string,
			"TaskItemUtils.ts/moveFromPendingToCompleted",
		);
	}

	eventEmitter.emit("SOFT_REFRESH");
};

/**
 * @deprecated Since version `1.3.0`, Task Board no longer updates the cache data directly after user events. Now the task is updated first in the file and then immediately after some delay the file is re-scanned to updated the cache automatically and refresh the view.
 * 
 * Move a task from Completed to Pending in the tasks.json file (cache file).
 * @param plugin - The Taskboard plugin instance.
 * @param task - The task to move from Completed to Pending.
 * @returns A promise that resolves with the updated task item.
 */
export const moveFromCompletedToPending = async (
	plugin: TaskBoard,
	task: taskItemWithCustomProperties,
) => {
	try {
		const allTasks = await loadJsonCacheDataFromDisk(plugin);

		// Move task from Completed to Pending
		if (allTasks.Completed[task[DEFAULT_TASK_CACHE_KEYS.FilePath]]) {
			allTasks.Completed[task[DEFAULT_TASK_CACHE_KEYS.FilePath]] = (
				allTasks.Completed[task[DEFAULT_TASK_CACHE_KEYS.FilePath]] || []
			).filter((t: taskItemWithCustomProperties) => t[DEFAULT_TASK_CACHE_KEYS.ID] !== task[DEFAULT_TASK_CACHE_KEYS.ID]);

			if (!allTasks.Pending[task[DEFAULT_TASK_CACHE_KEYS.FilePath]]) {
				allTasks.Pending[task[DEFAULT_TASK_CACHE_KEYS.FilePath]] = [];
			}
			allTasks.Pending[task[DEFAULT_TASK_CACHE_KEYS.FilePath]].push(task);
		}

		// Write the updated data back to the JSON file
		await writeJsonCacheDataToDisk(plugin, allTasks);
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			79,
			"Error updating task in tasks.json",
			error as string,
			"TaskItemUtils.ts/moveFromCompletedToPending",
		);
	}

	eventEmitter.emit("SOFT_REFRESH");
};

/**
 * @deprecated Since version `1.3.0`, Task Board no longer updates the cache data directly after user events. Now the task is updated first in the file and then immediately after some delay the file is re-scanned to updated the cache automatically and refresh the view.
 * 
 * Adds a new task to the task list in the tasks.json file (cache file).
 * @param {plugin} plugin - plugin instance
 * @param {newTask} newTask - taskItem object that needs to be added to the file
 */
export const addTaskInJson = async (plugin: TaskBoard, newTask: taskItem) => {
	const allTasks = await loadJsonCacheDataFromDisk(plugin);

	const file = plugin.app.vault.getFileByPath(newTask[DEFAULT_TASK_CACHE_KEYS.FilePath]);
	const frontmatter = file ? extractFrontmatterFromFile(plugin, file) : {};
	const frontmatterTags = extractFrontmatterTags(frontmatter);

	const newTaskWithId = {
		...newTask,
		id: plugin.vaultScanner.generateTaskId(),
		filePath: newTask[DEFAULT_TASK_CACHE_KEYS.FilePath],
		completed: "",
		frontmatterTags: frontmatterTags,
	};

	// Update the task list (assuming it's a file-based task structure)
	if (!allTasks.Pending[newTask[DEFAULT_TASK_CACHE_KEYS.FilePath]]) {
		allTasks.Pending[newTask[DEFAULT_TASK_CACHE_KEYS.FilePath]] = [];
	}

	allTasks.Pending[newTask[DEFAULT_TASK_CACHE_KEYS.FilePath]].push(newTaskWithId);

	await writeJsonCacheDataToDisk(plugin, allTasks);

	eventEmitter.emit("SOFT_REFRESH");
};

/**
 * @deprecated Since version `1.3.0`, Task Board no longer updates the cache data directly after user events. Now the task is updated first in the file and then immediately after some delay the file is re-scanned to updated the cache automatically and refresh the view.
 * 
 * Function to update tasks in both Pending and Completed categories in the tasks.json file (cache file)
 * @param updatedPendingTasks - Updated Pending tasks
 * @param updatedCompletedTasks - Updated Completed tasks
 * @returns - Updated data object with both updated Pending and Completed tasks
 */
export const updateTaskInJson = async (
	plugin: TaskBoard,
	updatedTask: taskItemWithCustomProperties,
) => {
	try {
		const allTasks = await loadJsonCacheDataFromDisk(plugin);

		// Function to update a task in a given task category (Pending or Completed)
		const updateTasksInCategory = (taskCategory: {
			[filePath: string]: taskItemWithCustomProperties[];
		}) => {
			return Object.entries(taskCategory).reduce(
				(
					acc: { [filePath: string]: taskItemWithCustomProperties[] },
					[filePath, tasks]: [string, taskItemWithCustomProperties[]],
				) => {
					acc[filePath] = tasks.map((task: taskItemWithCustomProperties) =>
						task[DEFAULT_TASK_CACHE_KEYS.ID] === updatedTask[DEFAULT_TASK_CACHE_KEYS.ID] ? updatedTask : task,
					);
					return acc;
				},
				{} as { [filePath: string]: taskItemWithCustomProperties[] }, // Set the initial accumulator type
			);
		};

		// Update tasks in both Pending and Completed categories
		const updatedPendingTasks = updateTasksInCategory(allTasks.Pending);
		const updatedCompletedTasks = updateTasksInCategory(allTasks.Completed);

		// Create the updated data object with both updated Pending and Completed tasks
		const updatedData: jsonCacheData = {
			VaultName: plugin.app.vault.getName(),
			Modified_at: getCurrentLocalDateTimeString(),
			Pending: updatedPendingTasks,
			Completed: updatedCompletedTasks,
		};
		// Write the updated data back to the JSON file using the new function
		await writeJsonCacheDataToDisk(plugin, updatedData);

		eventEmitter.emit("SOFT_REFRESH");
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			80,
			"Error updating task in tasks.json",
			String(error),
			"TaskItemUtils.ts/updateTaskInJson",
		);
	}
};

/**
 * @deprecated Since version `1.3.0`, Task Board no longer updates the cache data directly after user events. Now the task is updated first in the file and then immediately after some delay the file is re-scanned to updated the cache automatically and refresh the view.
 * 
 * Deletes a task from the tasks.json file (cache file)
 * @param plugin - The Taskboard plugin instance
 * @param task - The task item object that needs to be deleted from the file
 * @returns A promise that resolves with a boolean indicating whether the task was found and deleted from the file
 */
export const deleteTaskFromJson = async (plugin: TaskBoard, task: taskItem) => {
	try {
		const allTasks = await loadJsonCacheDataFromDisk(plugin);

		// Remove task from Pending or Completed in tasks.json
		if (allTasks.Pending[task[DEFAULT_TASK_CACHE_KEYS.FilePath]]) {
			allTasks.Pending[task[DEFAULT_TASK_CACHE_KEYS.FilePath]] = allTasks.Pending[
				task[DEFAULT_TASK_CACHE_KEYS.FilePath]
			].filter((t: taskItem) => t[DEFAULT_TASK_CACHE_KEYS.ID] !== task[DEFAULT_TASK_CACHE_KEYS.ID]);
		}
		if (allTasks.Completed[task[DEFAULT_TASK_CACHE_KEYS.FilePath]]) {
			allTasks.Completed[task[DEFAULT_TASK_CACHE_KEYS.FilePath]] = allTasks.Completed[
				task[DEFAULT_TASK_CACHE_KEYS.FilePath]
			].filter((t: taskItem) => t[DEFAULT_TASK_CACHE_KEYS.ID] !== task[DEFAULT_TASK_CACHE_KEYS.ID]);
		}

		await writeJsonCacheDataToDisk(plugin, allTasks);

		eventEmitter.emit("SOFT_REFRESH");
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			81,
			"Error deleting task from tasks.json",
			String(error),
			"TaskItemUtils.ts/deleteTaskFromJson",
		);
	}
};
