// /src/utils/JsonFileOperations.ts

import { dataFilePath, tasksPath } from "src/interfaces/GlobalVariables";
import {
	taskItem,
	taskJsonMerged,
	tasksJson,
} from "src/interfaces/TaskItemProps";

import { Board } from "../interfaces/BoardConfigs";
import TaskBoard from "main";
import fs from "fs";
import { loadTasksRaw } from "./tasksCache";

// Operations with data.json

// Load only the globalSettings part from the data.json
export const loadGlobalSettings = async (plugin: TaskBoard) => {
	try {
		await plugin.loadSettings();
		const globalSettings = plugin.settings.data.globalSettings || {};
		return globalSettings;
	} catch (error) {
		console.error("Error loading globalSettings:", error);
		return {};
	}
};

// NOTE : This is very inefficient method, remove it before release
export const loadBoardConfigsUsinFS = async () => {
	try {
		const settingsData = fs.readFileSync(dataFilePath, "utf8");
		return JSON.parse(settingsData).data.boardConfigs;
	} catch (error) {
		console.error("Error loading boardConfigs:", error);
		throw error;
	}
};

// Function to load boards data from the JSON file
export const loadBoardsData = async (plugin: TaskBoard): Promise<Board[]> => {
	try {
		console.log(
			"loadBoardsData: Loading board configurations. I hope this is running only once......"
		);

		// Fetch settings via Obsidian's loadData method
		await plugin.loadSettings();

		const boardConfigs = plugin.settings.data.boardConfigs || [];

		return boardConfigs;
	} catch (error) {
		console.error("Error loading board configurations:", error);
		throw error;
	}
};

// Function to save boards data to the JSON file
export const saveBoardsData = async (
	plugin: TaskBoard,
	updatedBoards: Board[]
) => {
	try {
		console.log("saveBoardsData: Saving board configurations...");

		// Fetch current settings
		await plugin.loadSettings();

		// Update the boardConfigs in settings
		plugin.settings.data.boardConfigs = updatedBoards;

		// Save updated settings
		await plugin.saveSettings();

		console.log("Board configurations saved successfully.");
	} catch (error) {
		console.error("Error saving board configurations:", error);
		throw error;
	}
};

// Operations with tasks.json

export const loadTasksAndMerge = async (
	plugin: TaskBoard
): Promise<{ allTasksMerged: taskJsonMerged }> => {
	const path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
	// console.log(
	// 	"loadTasksUsingObsidianMethod2 : Let me see how many times this is running..."
	// );
	try {
		// const data: string = await plugin.app.vault.adapter.read(path);
		// const allTasks: tasksJson = JSON.parse(data);

		const allTasks: tasksJson = await loadTasksRaw(plugin);
		console.log(
			"REFRESH_COLUMN : loadTasksAndMerge : Data recived from the sessionStorage function : ",
			allTasks
		);

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

		console.log(
			"I am going to return the following data : ",
			allTasksMerged
		);

		return { allTasksMerged };
	} catch (error) {
		console.error("Failed to load tasks from tasks.json:", error);
		throw error;
	}
};

export async function loadTasksProcessed(plugin: TaskBoard) {
	// console.log(
	// 	"loadTasksProcessed : Let me see how many times this is running..."
	// );
	return loadTasksAndMerge(plugin)
		.then(({ allTasksMerged }) => {
			return allTasksMerged; // Ensure it returns the merged tasks
		})
		.catch((error) => {
			console.error("Error while loading tasks:", error);
			// Return an empty taskJsonMerged object to avoid 'undefined'
			return { Pending: [], Completed: [] };
		});
}

// export const loadTasksRaw = async (plugin: TaskBoard): Promise<tasksJson> => {
// 	try {
// 		const path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
// 		const data: string = await plugin.app.vault.adapter.read(path);
// 		const allTasks: tasksJson = JSON.parse(data);
// 		return allTasks;
// 	} catch (error) {
// 		console.error("Error reading tasks.json:", error);
// 		throw error;
// 	}
// };

// export const writeTasksJson = async (
// 	plugin: TaskBoard,
// 	updatedData: tasksJson
// ): Promise<void> => {
// 	try {
// 		const path = `${plugin.app.vault.configDir}/plugins/task-board/tasks.json`;
// 		await plugin.app.vault.adapter.write(
// 			path,
// 			JSON.stringify(updatedData, null, 2)
// 		);
// 		console.log("Successfully updated tasks.json.");
// 	} catch (error) {
// 		console.error("Error writing to tasks.json:", error);
// 		throw error;
// 	}
// };

// Operations with fileStack.json
