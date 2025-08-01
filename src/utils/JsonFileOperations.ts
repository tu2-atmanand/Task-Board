// /src/utils/JsonFileOperations.ts

import {
	jsonCacheData,
	taskItem,
	taskJsonMerged,
} from "src/interfaces/TaskItem";

import { Board } from "../interfaces/BoardConfigs";
import TaskBoard from "main";
import { bugReporter } from "src/services/OpenModals";

// --------------- Operations with data.json ---------------

// Load only the globalSettings part from the data.json
export const loadGlobalSettings = async (plugin: TaskBoard) => {
	try {
		await plugin.loadSettings();
		const globalSettings = plugin.settings.data.globalSettings || {};
		return globalSettings;
	} catch (error) {
		bugReporter(
			plugin,
			"Failed to load global settings from data.json",
			String(error),
			"JsonFileOperations.ts/loadGlobalSettings"
		);
		return {};
	}
};

// Function to load boards data from the JSON file
export const loadBoardsData = async (plugin: TaskBoard): Promise<Board[]> => {
	try {
		// Fetch settings via Obsidian's loadData method
		await plugin.loadSettings();

		const boardConfigs = plugin.settings.data.boardConfigs || [];

		return boardConfigs;
	} catch (error) {
		bugReporter(
			plugin,
			"Failed to load board configurations from data.json",
			String(error),
			"JsonFileOperations.ts/loadBoardsData"
		);
		throw error;
	}
};

// Function to save boards data to the JSON file
export const saveBoardsData = async (
	plugin: TaskBoard,
	updatedBoards: Board[]
) => {
	try {
		// Fetch current settings
		await plugin.loadSettings();

		// Update the boardConfigs in settings
		plugin.settings.data.boardConfigs = updatedBoards;

		// Save updated settings
		await plugin.saveSettings();
	} catch (error) {
		bugReporter(
			plugin,
			"Failed to save board configurations to data.json",
			String(error),
			"JsonFileOperations.ts/saveBoardsData"
		);
		throw error;
	}
};

// ------------  Operations with tasks.json ----------------

// load tasks from disk.
export const loadJsonCacheDataFromDisk = async (
	plugin: TaskBoard
): Promise<jsonCacheData> => {
	try {
		let path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		if (plugin.settings.data.globalSettings.tasksCacheFilePath !== "") {
			path = plugin.settings.data.globalSettings.tasksCacheFilePath;
		}
		const data: string = await plugin.app.vault.adapter.read(path);
		const cacheData: jsonCacheData = JSON.parse(data);
		// const allTasks = {
		// 	Pending: cacheData.Pending,
		// 	Completed: cacheData.Completed,
		// 	Notes: cacheData.Notes || [], // Ensure Notes is always an array
		// };
		return cacheData;
	} catch (error) {
		console.error("Error reading tasks.json from disk:", error); // This error will be shown for a fresh install hence dont use the bugReporter here.
		throw error;
	}
};

// Helper function to clean up the empty entries in tasks.json
// export const dataCleanup = async (
// 	oldTaskData: jsonCacheData
// ): Promise<jsonCacheData> => {
// 	// Function to remove keys with empty arrays from a specified section
// 	const removeEmptyKeys = (section: any) => {
// 		Object.keys(section).forEach((key) => {
// 			console.log(
// 				"Checking key:",
// 				key,
// 				"in section:",
// 				section,
// 				"\nSection[key]:",
// 				section[key]
// 			);
// 			if (Array.isArray(section[key]) && section[key].length === 0) {
// 				delete section[key];
// 			}
// 		});
// 	};

// 	// Remove empty arrays from "Pending" and "Completed" sections
// 	removeEmptyKeys(oldTaskData.Pending);
// 	removeEmptyKeys(oldTaskData.Completed);

// 	return oldTaskData;
// };

// Function to write tasks data to disk
export const writeJsonCacheDataFromDisk = async (
	plugin: TaskBoard,
	tasksData: jsonCacheData
): Promise<void> => {
	try {
		let path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		if (plugin.settings.data.globalSettings.tasksCacheFilePath !== "") {
			path = plugin.settings.data.globalSettings.tasksCacheFilePath;
		}

		// const cleanedTasksData = tasksData; //await dataCleanup(tasksData);

		await plugin.app.vault.adapter.write(
			path,
			JSON.stringify(tasksData, null, 4)
		);
	} catch (error) {
		bugReporter(
			plugin,
			"Failed to write tasks to tasks.json file. Or failed to create the a new file. Maybe write permission is not granted.",
			String(error),
			"JsonFileOperations.ts/writetasksJsonDataDataToDisk"
		);
	}
};

// Function to move the file from old path to new path
export const moveTasksCacheFileToNewPath = (
	plugin: TaskBoard,
	oldPath: string,
	newPath: string
) => {
	return new Promise<void>((resolve, reject) => {
		if (
			oldPath === newPath ||
			(newPath !== "" && newPath.endsWith(".json") === false) ||
			(oldPath !== "" && oldPath.endsWith(".json") === false)
		) {
			resolve();
			return;
		}

		if (newPath === "")
			newPath = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		if (oldPath === "")
			oldPath = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		plugin.app.vault.adapter
			.rename(oldPath, newPath)
			// .then(() => {
			// 	// Update the tasksCacheFilePath in globalSettings
			// 	plugin.settings.data.globalSettings.tasksCacheFilePath =
			// 		newPath;
			// 	// Save the updated settings
			// 	return plugin.saveSettings();
			// })
			.then(() => resolve())
			.catch((error) => {
				bugReporter(
					plugin,
					"Failed to move tasks.json file to new path",
					String(error),
					"JsonFileOperations.ts/moveTasksCacheFileToNewPath"
				);
				reject(error);
			});
	});
};

// Helper function to load tasks from tasks.json and merge them
export const loadTasksAndMerge = async (
	plugin: TaskBoard
): Promise<taskJsonMerged> => {
	try {
		const allTasks: jsonCacheData = await loadJsonCacheDataFromDisk(plugin);
		const pendingTasks: taskItem[] = [];
		const completedTasks: taskItem[] = [];

		// Separate pending tasks
		for (const [filePath, tasks] of Object.entries(
			allTasks.Pending || {}
		)) {
			tasks.forEach((task: any) =>
				pendingTasks.push({ ...task, filePath })
			);
		}

		// Separate completed tasks
		for (const [filePath, tasks] of Object.entries(
			allTasks.Completed || {}
		)) {
			tasks.forEach((task: any) =>
				completedTasks.push({ ...task, filePath })
			);
		}

		const allTasksMerged: taskJsonMerged = {
			Pending: pendingTasks,
			Completed: completedTasks,
		};

		return allTasksMerged;
	} catch (error) {
		// console.error("Failed to load tasks from tasks.json:", error);
		// bugReporter(
		// 	plugin,
		// 	"Failed to load tasks from tasks.json file. If this is your fresh install kindly run the scan vault using the top right corner button and open the board again. If the issue persists, please report it to the developer using steps mentioned below.",
		// 	String(error),
		// 	"JsonFileOperations.ts/loadTasksAndMerge"
		// );
		throw error;
	}
};

// export async function loadTasksProcessed(plugin: TaskBoard) {
// 	return loadTasksAndMerge(plugin)
// 		.then(({ allTasksMerged }) => {
// 			return allTasksMerged; // Ensure it returns the merged tasks
// 		})
// 		.catch((error) => {
// 			console.error("Error while loading tasks:", error);
// 			// Return an empty taskJsonMerged object to avoid 'undefined'
// 			return { Pending: [], Completed: [] };
// 		});
// }
