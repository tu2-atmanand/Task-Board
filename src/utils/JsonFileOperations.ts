// /src/utils/JsonFileOperations.ts

import {
	jsonCacheData,
	taskItem,
	taskJsonMerged,
} from "src/interfaces/TaskItem";

import { Board } from "../interfaces/BoardConfigs";
import type TaskBoard from "main";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";
import { App } from "obsidian";

// --------------- Operations with data.json ---------------

// Load only the globalSettings part from the data.json
export const loadGlobalSettings = async (plugin: TaskBoard) => {
	try {
		await plugin.loadSettings();
		const globalSettings = plugin.settings.data.globalSettings || {};
		return globalSettings;
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			68,
			"Failed to load global settings from data.json",
			String(error),
			"JsonFileOperations.ts/loadGlobalSettings",
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
		bugReporterManagerInsatance.showNotice(
			69,
			"Failed to load board configurations from data.json",
			String(error),
			"JsonFileOperations.ts/loadBoardsData",
		);
		throw error;
	}
};

// Function to save boards data to the JSON file
export const saveBoardsData = async (
	plugin: TaskBoard,
	updatedBoards: Board[],
) => {
	try {
		// Fetch current settings
		await plugin.loadSettings();

		// Update the boardConfigs in settings
		plugin.settings.data.boardConfigs = updatedBoards;

		// Save updated settings
		await plugin.saveSettings();
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			70,
			"Failed to save board configurations to data.json",
			String(error),
			"JsonFileOperations.ts/saveBoardsData",
		);
		throw error;
	}
};

// ------------  Operations with tasks.json ----------------

// load tasks from plugin.vaultScanner.tasksCache
export const loadJsonCacheData = async (
	plugin: TaskBoard,
): Promise<jsonCacheData> => {
	try {
		return plugin.vaultScanner.tasksCache;
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			71,
			"Failed to load tasks from tasks.json",
			String(error),
			"JsonFileOperations.ts/loadJsonCacheData",
		);
		return {
			VaultName: plugin.app.vault.getName(),
			Modified_at: "INVALID",
			Pending: {},
			Completed: {},
		};
	}
};

// load tasks from disk.
export const loadJsonCacheDataFromDisk = async (
	plugin: TaskBoard,
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
		bugReporterManagerInsatance.addToLogs(
			159,
			`No need to worry if this is shown on a fresh install.\n${String(error)}`,
			"TaskNoteUtils.ts/updateFrontmatterInMarkdownFile",
		);
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

// Helper function to write file with retry logic for timeout scenarios
const writeFileWithRetry = async (
	plugin: TaskBoard,
	path: string,
	content: string,
	maxRetries: number = 3,
	baseDelay: number = 1000,
): Promise<void> => {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			await plugin.app.vault.adapter.write(path, content);
			// Log successful recovery if it was a retry
			// if (attempt > 1) {
			// 	console.log(
			// 		`Task Board: File write succeeded on attempt ${attempt}`
			// 	);
			// }
			return; // Success, exit the function
		} catch (error) {
			const errorMessage = String(error);
			const isTimeoutError =
				errorMessage.toLowerCase().includes("timeout") ||
				errorMessage.toLowerCase().includes("timed out");

			// If this is the last attempt or not a timeout error, throw the error
			if (attempt === maxRetries || !isTimeoutError) {
				throw error;
			}

			// Wait with exponential backoff before retry
			const delay = baseDelay * Math.pow(2, attempt - 1);
			console.warn(
				`Task Board: File write timeout (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`,
			);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
};

// Function to write tasks data to disk
export const writeJsonCacheDataToDisk = async (
	plugin: TaskBoard,
	tasksData: jsonCacheData,
): Promise<boolean> => {
	try {
		let path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
		if (plugin.settings.data.globalSettings.tasksCacheFilePath !== "") {
			path = plugin.settings.data.globalSettings.tasksCacheFilePath;
		}

		// const cleanedTasksData = tasksData; //await dataCleanup(tasksData);

		await writeFileWithRetry(
			plugin,
			path,
			JSON.stringify(tasksData, null, 4),
		);

		return true;
	} catch (error) {
		const errorMessage = String(error);
		const isTimeoutError =
			errorMessage.toLowerCase().includes("timeout") ||
			errorMessage.toLowerCase().includes("timed out");

		// Provide more specific error message for timeout scenarios
		const userMessage = isTimeoutError
			? "Failed to write tasks to tasks.json file due to file system timeout. This may occur when using external drives that go idle. The operation was retried but still failed."
			: "Failed to write tasks to tasks.json file. Or failed to create the a new file. Maybe write permission is not granted.";

		if (!isTimeoutError) {
			bugReporterManagerInsatance.showNotice(
				72,
				userMessage,
				errorMessage,
				"JsonFileOperations.ts/writeJsonCacheDataFromDisk",
			);
		}

		return false;
	}
};

// Function to move the file from old path to new path
export const moveTasksCacheFileToNewPath = (
	app: App,
	oldPath: string,
	newPath: string,
) => {
	return new Promise<boolean>(async (resolve, reject) => {
		if (
			oldPath === newPath ||
			(newPath !== "" && newPath.endsWith(".json") === false) ||
			(oldPath !== "" && oldPath.endsWith(".json") === false)
		) {
			resolve(true);
			return true;
		}

		// Check if the directory exists, create if not
		const parts = newPath.split("/");
		if (parts.length > 1) {
			const dirPath = parts.slice(0, -1).join("/").trim();
			if (!(await app.vault.adapter.exists(dirPath))) {
				await app.vault.createFolder(dirPath);
			}
		}

		console.log(
			"moveTasksCacheFileToNewPath...\nOld path :",
			oldPath,
			"\nNew path :",
			newPath,
		);
		if (newPath === "")
			newPath = `${app.vault.configDir}/plugins/task-board/tasks.json`;
		if (oldPath === "")
			oldPath = `${app.vault.configDir}/plugins/task-board/tasks.json`;
		app.vault.adapter
			.rename(oldPath, newPath)
			// .then(() => {
			// 	// Update the tasksCacheFilePath in globalSettings
			// 	plugin.settings.data.globalSettings.tasksCacheFilePath =
			// 		newPath;
			// 	// Save the updated settings
			// 	return plugin.saveSettings();
			// })
			.then(() => resolve(true))
			.catch((error) => {
				bugReporterManagerInsatance.showNotice(
					73,
					"Failed to move tasks.json file to new path",
					String(error),
					"JsonFileOperations.ts/moveTasksCacheFileToNewPath",
				);
				reject(error);
				return false;
			});
	});
};

// Helper function to load tasks from tasks.json and merge them
export const loadTasksAndMerge = async (
	plugin: TaskBoard,
	hardRefresh: boolean,
): Promise<taskJsonMerged> => {
	try {
		let allTasks: jsonCacheData;
		if (hardRefresh) {
			allTasks = await loadJsonCacheDataFromDisk(plugin);
		} else {
			allTasks = await loadJsonCacheData(plugin);
		}
		// const pendingTasks: taskItem[] = [];
		// const completedTasks: taskItem[] = [];

		// // Separate pending tasks
		// for (const [filePath, tasks] of Object.entries(
		// 	allTasks.Pending || {}
		// )) {
		// 	tasks.forEach((task: any) =>
		// 		pendingTasks.push({ ...task, filePath })
		// 	);
		// }

		// // Separate completed tasks
		// for (const [filePath, tasks] of Object.entries(
		// 	allTasks.Completed || {}
		// )) {
		// 	tasks.forEach((task: any) =>
		// 		completedTasks.push({ ...task, filePath })
		// 	);
		// }

		// const allTasksMerged: taskJsonMerged = {
		// 	Pending: pendingTasks,
		// 	Completed: completedTasks,
		// };

		const mergeTasks = (tasks: typeof allTasks.Pending) =>
			Object.entries(tasks || {}).flatMap(([filePath, tasks]) =>
				tasks.map((task: taskItem) => ({ ...task, filePath })),
			);

		const allTasksMerged: taskJsonMerged = {
			Pending: mergeTasks(allTasks.Pending),
			Completed: mergeTasks(allTasks.Completed),
		};

		return allTasksMerged;
	} catch (error) {
		// console.error("Failed to load tasks from tasks.json:", error);
		// bugReporterManagerInsatance.showNotice(
		// 	74,
		// 	"Failed to load tasks from tasks.json file. If this is your fresh install kindly run the scan vault using the top right corner button and open the board again. If the issue persists, please report it to the developer using steps mentioned below.",
		// 	String(error),
		// 	"JsonFileOperations.ts/loadTasksAndMerge"
		// );
		console.log("Is this running..");
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
